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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_payments')
    .select('*, suppliers(name), clients(full_name)')
    .eq('booking_id', params.id)
    .order('due_date', { ascending: true });

  if (error) {
    logger.error('list', 'Failed to fetch payments', { bookingId: params.id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  body.booking_id = params.id;

  logger.info('create', 'Adding payment', { bookingId: params.id, direction: body.direction, amount: body.amount });

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('booking_payments').insert(body).select().single();

  if (error) {
    logger.error('create', 'Failed to add payment', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: params.id,
    user_id: user.id,
    action: 'payment_added',
    details: { component_id: data.id, direction: data.direction, amount: data.amount, status: data.status },
  });

  logger.info('create', 'Payment added', { bookingId: params.id, paymentId: data.id });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { component_id, ...updates } = body;

  if (!component_id) return NextResponse.json({ error: 'component_id required' }, { status: 400 });

  logger.info('update', 'Updating payment', { bookingId: params.id, paymentId: component_id });

  const supabase = createServiceClient();

  const { data: old } = await supabase.from('booking_payments').select('status').eq('id', component_id).single();

  const { data, error } = await supabase
    .from('booking_payments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', component_id)
    .select()
    .single();

  if (error) {
    logger.error('update', 'Failed to update payment', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updates.status && old?.status !== updates.status) {
    await supabase.from('booking_logs').insert({
      booking_id: params.id,
      user_id: user.id,
      action: 'payment_status_changed',
      details: { component_id, old_status: old?.status, new_status: updates.status, amount: data.amount },
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const componentId = searchParams.get('component_id');
  if (!componentId) return NextResponse.json({ error: 'component_id required' }, { status: 400 });

  logger.info('delete', 'Deleting payment', { bookingId: params.id, paymentId: componentId });

  const supabase = createServiceClient();

  const { error } = await supabase.from('booking_payments').delete().eq('id', componentId);

  if (error) {
    logger.error('delete', 'Failed to delete payment', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: params.id,
    user_id: user.id,
    action: 'payment_removed',
    details: { component_id: componentId },
  });

  return NextResponse.json({ success: true });
}
