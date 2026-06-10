import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: bookingId } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  // Fetch booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, proposal_id, sell_price, cost_price, currency, title, destination, travel_start, travel_end, clients(full_name, email)')
    .eq('id', bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  // Fetch packages with their payments — single source of truth
  const { data: packages } = await supabase
    .from('booking_packages')
    .select('*, booking_package_payments(*), suppliers(name)')
    .eq('booking_id', bookingId)
    .order('created_at');

  const allPackages = packages || [];

  // Flatten all package payments with parent context
  const allPayments = allPackages.flatMap(pkg =>
    (pkg.booking_package_payments || []).map((p: any) => ({
      ...p,
      package_id: pkg.id,
      package_type: pkg.type,
      supplier_name: pkg.suppliers?.name || null,
      supplier_id: pkg.supplier_id || null,
    }))
  );

  // Split by direction
  const collections = allPayments.filter((p: any) => p.direction === 'receivable');
  const supplierPayments = allPayments.filter((p: any) => p.direction === 'payable');

  // --- Aggregate calculations ---
  const sellPrice = Number(booking.sell_price) || 0;
  const costPrice = Number(booking.cost_price) || 0;

  // Collections (money IN from client)
  const totalReceivable = collections.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalCollected = collections
    .filter((r: any) => r.status === 'paid')
    .reduce((s: number, r: any) => s + Number(r.amount_paid || r.amount), 0);
  const totalTcs = collections.reduce((s: number, r: any) => s + Number(r.tcs_amount || 0), 0);
  // Supplier payments (money OUT)
  const totalPayable = supplierPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalPaidToSuppliers = supplierPayments
    .filter((p: any) => p.status === 'paid')
    .reduce((s: number, p: any) => s + Number(p.amount_paid || p.amount), 0);
  const totalBankCharges = supplierPayments.reduce((s: number, p: any) => s + Number(p.bank_charges || 0), 0);
  const pendingToSuppliers = totalPayable - totalPaidToSuppliers;

  // Use sell price as receivable total if no explicit receivable payments exist
  const effectiveReceivable = totalReceivable > 0 ? totalReceivable : sellPrice;
  const pendingFromClient = effectiveReceivable - totalCollected;

  // P&L
  const projectedProfit = sellPrice - costPrice;
  const projectedMarginPct = sellPrice > 0 ? (projectedProfit / sellPrice * 100) : 0;
  const actualProfit = totalCollected - (totalPaidToSuppliers + totalBankCharges);
  const variance = actualProfit - projectedProfit;

  // Cash flow entries (date-wise)
  type CashFlowEntry = { date: string; type: 'in' | 'out'; amount: number; description: string; ref?: string };
  const cashFlow: CashFlowEntry[] = [];

  for (const r of collections.filter((r: any) => r.status === 'paid' && (r.paid_at || r.paid_date))) {
    cashFlow.push({
      date: (r.paid_at || r.paid_date).split('T')[0],
      type: 'in',
      amount: Number(r.amount_paid || r.amount),
      description: r.label || `Collection #${r.sequence || ''}`,
      ref: r.payment_method || r.reference_number || undefined,
    });
  }

  for (const p of supplierPayments.filter((p: any) => p.status === 'paid' && (p.paid_at || p.paid_date))) {
    cashFlow.push({
      date: (p.paid_at || p.paid_date).split('T')[0],
      type: 'out',
      amount: Number(p.amount_paid || p.amount) + Number(p.bank_charges || 0),
      description: p.supplier_name ? `Payment — ${p.supplier_name}` : `Supplier payment #${p.sequence || ''}`,
      ref: p.reference_number || undefined,
    });
  }

  cashFlow.sort((a, b) => a.date.localeCompare(b.date));

  // Group supplier payments by supplier
  const supplierGroupMap: Record<string, { name: string; totalCost: number; paid: number; balance: number; bankCharges: number; items: any[] }> = {};
  for (const p of supplierPayments) {
    const suppId = p.supplier_id || p.package_id || 'unknown';
    const suppName = p.supplier_name || 'Unknown Supplier';
    if (!supplierGroupMap[suppId]) {
      supplierGroupMap[suppId] = { name: suppName, totalCost: 0, paid: 0, balance: 0, bankCharges: 0, items: [] };
    }
    const amt = Number(p.amount);
    supplierGroupMap[suppId].totalCost += amt;
    supplierGroupMap[suppId].bankCharges += Number(p.bank_charges || 0);
    if (p.status === 'paid') {
      supplierGroupMap[suppId].paid += amt;
    } else {
      supplierGroupMap[suppId].balance += amt;
    }
    supplierGroupMap[suppId].items.push(p);
  }

  return NextResponse.json({
    summary: {
      sellPrice,
      costPrice,
      totalCollected,
      pendingFromClient,
      totalPaidToSuppliers,
      pendingToSuppliers,
      totalBankCharges,
      totalTcs,
      projectedProfit,
      projectedMarginPct: Math.round(projectedMarginPct * 10) / 10,
      actualProfit,
      variance,
    },
    collections,
    supplierPayments,
    supplierGroups: Object.values(supplierGroupMap),
    packagePayments: allPayments,
    pnl: {
      projected: { revenue: sellPrice, cost: costPrice, profit: projectedProfit },
      actual: { revenue: totalCollected, cost: totalPaidToSuppliers + totalBankCharges, profit: actualProfit },
      variance,
    },
    cashFlow,
    currency: booking.currency || 'INR',
  });
}

// PATCH: Update a specific booking_package_payment status
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id: bookingId } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const body = await req.json();
  const { paymentId, packageId, status, payment_method, reference_number, bank_charges, amount_paid } = body;

  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
  }

  // Verify the payment belongs to this booking
  const { data: pkg } = await supabase
    .from('booking_packages')
    .select('id, booking_id')
    .eq('id', packageId || '')
    .single();

  // If packageId provided, verify it matches
  if (pkg && pkg.booking_id !== bookingId) {
    return NextResponse.json({ error: 'Payment does not belong to this booking' }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (payment_method) updateData.payment_method = payment_method;
  if (reference_number) updateData.reference_number = reference_number;
  if (bank_charges !== undefined) updateData.bank_charges = Number(bank_charges);
  if (amount_paid !== undefined) updateData.amount_paid = Number(amount_paid);
  if (status === 'paid') updateData.paid_at = new Date().toISOString();

  const { error } = await supabase
    .from('booking_package_payments')
    .update(updateData)
    .eq('id', paymentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
