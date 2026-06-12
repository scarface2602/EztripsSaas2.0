import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api/with-auth';
import type { Permission } from '@/lib/auth/permissions';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:booking-payments');

async function getUser(permission?: Permission) {
  return getAuthUser(permission);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_payments')
    .select('*')
    .eq('booking_id', id)
    .order('installment_number', { ascending: true });

  if (error) {
    logger.error('list', 'Failed to fetch payments', { bookingId: id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser('payments.manage');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  body.booking_id = id;

  logger.info('create', 'Adding payment installment', { bookingId: id, amount: body.amount });

  const supabase = createServiceClient();

  if (!(Number(body.amount) > 0)) {
    return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 });
  }

  // Error-prevention guard: don't silently collect more than the client
  // owes, or pay a vendor more than the booking costs. `override: true`
  // bypasses for legitimate cases (tips, fare difference, goodwill).
  const override = body.override === true;
  delete body.override;
  if (!override && (body.direction === 'receivable' || body.direction === 'payable')) {
    const [{ data: booking }, { data: existing }] = await Promise.all([
      supabase.from('bookings').select('sell_price, cost_price, currency').eq('id', id).single(),
      supabase
        .from('booking_payments')
        .select('amount')
        .eq('booking_id', id)
        .eq('direction', body.direction)
        .neq('status', 'cancelled'),
    ]);
    const cap = body.direction === 'receivable' ? Number(booking?.sell_price) : Number(booking?.cost_price);
    if (cap > 0) {
      const already = (existing ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const after = already + Number(body.amount);
      if (after > cap + 0.5) {
        const who = body.direction === 'receivable' ? 'the client owes' : 'this booking costs';
        return NextResponse.json(
          {
            error: `This would take total ${body.direction} payments to ${booking?.currency ?? 'INR'} ${after.toLocaleString('en-IN')} — more than ${who} (${booking?.currency ?? 'INR'} ${cap.toLocaleString('en-IN')}). Check the amount, or resend with override if intentional.`,
            code: 'OVERPAYMENT',
            cap,
            already,
          },
          { status: 409 },
        );
      }
    }
  }

  const { data, error } = await supabase.from('booking_payments').insert(body).select().single();

  if (error) {
    logger.error('create', 'Failed to add payment', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'payment_added',
    details: { payment_id: data.id, amount: data.amount, label: data.installment_label },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser('payments.manage');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { payment_id, ...updates } = body;

  if (!payment_id) return NextResponse.json({ error: 'payment_id required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: old } = await supabase.from('booking_payments').select('status').eq('id', payment_id).single();

  const { data, error } = await supabase
    .from('booking_payments')
    .update(updates)
    .eq('id', payment_id)
    .select()
    .single();

  if (error) {
    logger.error('update', 'Failed to update payment', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updates.status && old?.status !== updates.status) {
    await supabase.from('booking_logs').insert({
      booking_id: id,
      user_id: user.id,
      action: 'payment_status_changed',
      details: { payment_id, old_status: old?.status, new_status: updates.status, amount: data.amount },
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser('payments.manage');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get('payment_id');
  if (!paymentId) return NextResponse.json({ error: 'payment_id required' }, { status: 400 });

  const supabase = createServiceClient();

  const { error } = await supabase.from('booking_payments').delete().eq('id', paymentId);

  if (error) {
    logger.error('delete', 'Failed to delete payment', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'payment_removed',
    details: { payment_id: paymentId },
  });

  return NextResponse.json({ success: true });
}
