import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:booking-payments');

async function getUser() {
  const authClient = await createClient();
  const { data } = await authClient.auth.getUser();
  return data.user;
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
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  body.booking_id = id;

  logger.info('create', 'Adding payment installment', { bookingId: id, amount: body.amount });

  const supabase = createServiceClient();
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
  const user = await getUser();
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
  const user = await getUser();
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
