import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api/with-auth';
import type { Permission } from '@/lib/auth/permissions';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:customer-payments');

async function getUser(permission?: Permission) {
  return getAuthUser(permission);
}

// GET /api/bookings/[id]/customer-payments — list customer payments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('customer_payments')
    .select('*, payment_accounts(account_name, bank_name)')
    .eq('booking_id', id)
    .order('received_date', { ascending: false });

  if (error) {
    logger.error('list', 'Failed to fetch customer payments', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/bookings/[id]/customer-payments — record a customer payment or refund
// Body: { amount, payment_type?, payment_mode, reference_number?, received_in_account_id?, received_date?, notes? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser('payments.manage');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { amount, payment_type, payment_mode, reference_number, received_in_account_id, received_date, notes } = body;

  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'amount is required and must be positive' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify booking exists
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, sell_price, total_paid, clients(full_name)')
    .eq('id', id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const paymentType = payment_type || 'payment';

  const { data: payment, error } = await supabase
    .from('customer_payments')
    .insert({
      booking_id: id,
      amount: Number(amount),
      payment_type: paymentType,
      payment_mode: payment_mode || null,
      reference_number: reference_number || null,
      received_in_account_id: received_in_account_id || null,
      received_date: received_date || new Date().toISOString().split('T')[0],
      notes: notes || null,
      recorded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    logger.error('create', 'Failed to record customer payment', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update booking total_paid
  const { data: allPayments } = await supabase
    .from('customer_payments')
    .select('amount, payment_type')
    .eq('booking_id', id);

  const newTotalPaid = (allPayments || []).reduce((sum, p) => {
    return sum + (p.payment_type === 'refund' ? -Number(p.amount) : Number(p.amount));
  }, 0);

  await supabase
    .from('bookings')
    .update({ total_paid: newTotalPaid })
    .eq('id', id);

  // Record in client_ledger for audit trail
  const clientName = (booking.clients as unknown as { full_name: string } | null)?.full_name || 'Guest';

  // Get client_id from booking
  const { data: bookingFull } = await supabase
    .from('bookings')
    .select('client_id, proposal_id')
    .eq('id', id)
    .single();

  await supabase.from('client_ledger').insert({
    client_id: bookingFull?.client_id || null,
    proposal_id: bookingFull?.proposal_id || null,
    type: paymentType === 'refund' ? 'debit' : 'credit',
    amount: Number(amount),
    description: paymentType === 'refund'
      ? `Refund — ${reference_number || 'No ref'}`
      : `Payment received — ${payment_mode || ''} ${reference_number || ''}`.trim(),
    reference: reference_number || null,
    created_by: user.id,
  });

  // Log
  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: paymentType === 'refund' ? 'refund_processed' : 'customer_payment_received',
    details: {
      payment_id: payment.id,
      amount: Number(amount),
      payment_type: paymentType,
      payment_mode,
      reference_number,
      client: clientName,
    },
  });

  return NextResponse.json(payment, { status: 201 });
}
