import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: supplierId } = await params;
  const supabase = createServiceClient();

  // Fetch supplier
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, name, type, contact_name, contact_email')
    .eq('id', supplierId)
    .single();

  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

  // Fetch payables (old system — linked to proposals)
  const { data: oldPayables } = await supabase
    .from('payables')
    .select('id, description, amount, due_date, status, paid_at, reference, notes, proposal_id')
    .eq('supplier_id', supplierId)
    .order('due_date', { ascending: false });

  // Fetch booking_payments (new system — payable direction only)
  const { data: bookingPayments } = await supabase
    .from('booking_payments')
    .select('id, amount, due_date, paid_date, status, payment_mode, reference_number, notes, booking_id, bookings(title)')
    .eq('supplier_id', supplierId)
    .eq('direction', 'payable')
    .order('due_date', { ascending: false });

  // Merge into unified list
  const allPayables = [
    ...(oldPayables || []).map((p: any) => ({
      id: p.id,
      source: 'proposal',
      description: p.description,
      amount: Number(p.amount),
      due_date: p.due_date,
      status: p.status,
      paid_date: p.paid_at,
      payment_mode: null,
      reference: p.reference,
      notes: p.notes,
      booking_title: null,
    })),
    ...(bookingPayments || []).map((p: any) => ({
      id: p.id,
      source: 'booking',
      description: (p.bookings as any)?.title || 'Booking payment',
      amount: Number(p.amount),
      due_date: p.due_date,
      status: p.status,
      paid_date: p.paid_date,
      payment_mode: p.payment_mode,
      reference: p.reference_number,
      notes: p.notes,
      booking_title: (p.bookings as any)?.title,
    })),
  ];

  // Compute summary
  const totalOwed = allPayables.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = allPayables.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const outstanding = totalOwed - totalPaid;

  // Split into paid and upcoming
  const paidHistory = allPayables.filter(p => p.status === 'paid').sort((a, b) =>
    (b.paid_date || b.due_date || '').localeCompare(a.paid_date || a.due_date || '')
  );
  const upcomingDues = allPayables.filter(p => p.status !== 'paid').sort((a, b) =>
    (a.due_date || '').localeCompare(b.due_date || '')
  );

  return NextResponse.json({
    supplier,
    summary: { total_owed: totalOwed, total_paid: totalPaid, outstanding },
    paid_history: paidHistory,
    upcoming_dues: upcomingDues,
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
