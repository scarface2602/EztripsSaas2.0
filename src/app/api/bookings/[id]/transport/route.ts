import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:booking-transport');

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
    .from('booking_transport')
    .select('*, suppliers(name, contact_email, contact_phone)')
    .eq('booking_id', params.id)
    .order('sort_order');

  if (error) {
    logger.error('list', 'Failed to fetch transport', { bookingId: params.id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  body.booking_id = params.id;

  logger.info('create', 'Adding transport to booking', { bookingId: params.id, type: body.type });

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('booking_transport').insert(body).select().single();

  if (error) {
    logger.error('create', 'Failed to add transport', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: params.id,
    user_id: user.id,
    action: 'transport_added',
    details: { component_id: data.id, type: data.type, from: data.from_location, to: data.to_location },
  });

  logger.info('create', 'Transport added', { bookingId: params.id, transportId: data.id });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { component_id, ...updates } = body;

  if (!component_id) return NextResponse.json({ error: 'component_id required' }, { status: 400 });

  logger.info('update', 'Updating transport', { bookingId: params.id, transportId: component_id });

  const supabase = createServiceClient();

  const { data: old } = await supabase.from('booking_transport').select('status').eq('id', component_id).single();

  const { data, error } = await supabase
    .from('booking_transport')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', component_id)
    .select()
    .single();

  if (error) {
    logger.error('update', 'Failed to update transport', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updates.status && old?.status !== updates.status) {
    await supabase.from('booking_logs').insert({
      booking_id: params.id,
      user_id: user.id,
      action: 'transport_status_changed',
      details: { component_id, old_status: old?.status, new_status: updates.status },
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

  logger.info('delete', 'Deleting transport', { bookingId: params.id, transportId: componentId });

  const supabase = createServiceClient();

  const { data: transport } = await supabase.from('booking_transport').select('type, from_location, to_location').eq('id', componentId).single();

  const { error } = await supabase.from('booking_transport').delete().eq('id', componentId);

  if (error) {
    logger.error('delete', 'Failed to delete transport', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: params.id,
    user_id: user.id,
    action: 'transport_removed',
    details: { component_id: componentId, type: transport?.type },
  });

  return NextResponse.json({ success: true });
}
