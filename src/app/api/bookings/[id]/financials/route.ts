import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  // Fetch booking with proposal_id
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, proposal_id, sell_price, cost_price, currency, title, destination, travel_start, travel_end, clients(full_name, email)')
    .eq('id', bookingId)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  // Fetch all data sources in parallel
  const proposalId = booking.proposal_id;

  const [
    receivablesRes,
    payablesRes,
    packagesRes,
  ] = await Promise.all([
    // Collections (money IN from client) — via proposal_id
    proposalId
      ? supabase.from('receivables').select('*').eq('proposal_id', proposalId).order('due_date')
      : Promise.resolve({ data: [] }),
    // Supplier payments (money OUT) — via proposal_id
    proposalId
      ? supabase.from('payables').select('*, suppliers(name)').eq('proposal_id', proposalId).order('due_date')
      : Promise.resolve({ data: [] }),
    // Package payments (supplier payment schedule) — via booking_id
    supabase
      .from('booking_packages')
      .select('*, booking_package_payments(*), suppliers(name)')
      .eq('booking_id', bookingId)
      .order('created_at'),
  ]);

  const receivables = receivablesRes.data || [];
  const payables = payablesRes.data || [];
  const packages = packagesRes.data || [];

  // --- Aggregate calculations ---
  const sellPrice = Number(booking.sell_price) || 0;
  const costPrice = Number(booking.cost_price) || 0;

  // Collections (from receivables)
  const totalReceivable = receivables.reduce((s, r) => s + Number(r.amount), 0);
  const totalCollected = receivables
    .filter(r => r.status === 'paid')
    .reduce((s, r) => s + Number(r.amount), 0);
  const totalTcs = receivables.reduce((s, r) => s + Number(r.tcs_amount || 0), 0);
  const pendingFromClient = totalReceivable - totalCollected;

  // Supplier payments (from payables)
  const totalPayable = payables.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaidToSuppliers = payables
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalBankCharges = payables.reduce((s, p) => s + Number(p.bank_charges || 0), 0);
  const pendingToSuppliers = totalPayable - totalPaidToSuppliers;

  // Package-based payments (alternative/supplementary tracking)
  const packagePayments = packages.flatMap(pkg =>
    (pkg.booking_package_payments || []).map((p: Record<string, unknown>) => ({
      ...p,
      package_type: pkg.type,
      supplier_name: pkg.suppliers?.name || null,
    }))
  );
  const totalPaidViaPackages = packagePayments
    .filter((p: Record<string, unknown>) => p.status === 'paid')
    .reduce((s: number, p: Record<string, unknown>) => s + Number(p.amount_paid || 0), 0);

  // P&L
  const projectedRevenue = sellPrice;
  const projectedCost = costPrice;
  const projectedProfit = projectedRevenue - projectedCost;
  const projectedMarginPct = projectedRevenue > 0 ? (projectedProfit / projectedRevenue * 100) : 0;

  const actualRevenue = totalCollected;
  const actualCost = totalPaidToSuppliers + totalBankCharges;
  // Use package payments as fallback if no payables exist
  const effectiveActualCost = actualCost > 0 ? actualCost : totalPaidViaPackages;
  const actualProfit = actualRevenue - effectiveActualCost;
  const variance = actualProfit - projectedProfit;

  // Cash flow entries (date-wise)
  type CashFlowEntry = { date: string; type: 'in' | 'out'; amount: number; description: string; ref?: string };
  const cashFlow: CashFlowEntry[] = [];

  for (const r of receivables.filter(r => r.status === 'paid' && r.paid_at)) {
    cashFlow.push({
      date: r.paid_at.split('T')[0],
      type: 'in',
      amount: Number(r.amount),
      description: r.description,
      ref: r.payment_method || r.razorpay_payment_id || undefined,
    });
  }
  for (const p of payables.filter(p => p.status === 'paid' && p.paid_at)) {
    cashFlow.push({
      date: p.paid_at.split('T')[0],
      type: 'out',
      amount: Number(p.amount) + Number(p.bank_charges || 0),
      description: p.description,
      ref: p.reference || undefined,
    });
  }
  // Add package payments as cash flow
  for (const p of packagePayments.filter((p: Record<string, unknown>) => p.status === 'paid' && p.paid_date)) {
    cashFlow.push({
      date: String(p.paid_date),
      type: 'out',
      amount: Number(p.amount_paid || 0),
      description: `Package payment #${p.sequence}${p.supplier_name ? ` — ${p.supplier_name}` : ''}`,
      ref: p.reference_number ? String(p.reference_number) : undefined,
    });
  }

  cashFlow.sort((a, b) => a.date.localeCompare(b.date));

  // Group payables by supplier for the supplier breakdown
  const supplierGroups: Record<string, { name: string; totalCost: number; paid: number; balance: number; bankCharges: number; items: typeof payables }> = {};
  for (const p of payables) {
    const suppId = p.supplier_id || 'unknown';
    const suppName = p.suppliers?.name || 'Unknown Supplier';
    if (!supplierGroups[suppId]) {
      supplierGroups[suppId] = { name: suppName, totalCost: 0, paid: 0, balance: 0, bankCharges: 0, items: [] };
    }
    const amt = Number(p.amount);
    supplierGroups[suppId].totalCost += amt;
    supplierGroups[suppId].bankCharges += Number(p.bank_charges || 0);
    if (p.status === 'paid') {
      supplierGroups[suppId].paid += amt;
    } else {
      supplierGroups[suppId].balance += amt;
    }
    supplierGroups[suppId].items.push(p);
  }

  return NextResponse.json({
    summary: {
      sellPrice,
      costPrice,
      totalCollected,
      pendingFromClient,
      totalPaidToSuppliers: Math.max(totalPaidToSuppliers, totalPaidViaPackages),
      pendingToSuppliers,
      totalBankCharges,
      totalTcs,
      projectedProfit,
      projectedMarginPct: Math.round(projectedMarginPct * 10) / 10,
      actualProfit,
      variance,
    },
    collections: receivables,
    supplierPayments: payables,
    supplierGroups: Object.values(supplierGroups),
    packagePayments,
    pnl: {
      projected: { revenue: projectedRevenue, cost: projectedCost, profit: projectedProfit },
      actual: { revenue: actualRevenue, cost: effectiveActualCost, profit: actualProfit },
      variance,
    },
    cashFlow,
    currency: booking.currency || 'INR',
  });
}
