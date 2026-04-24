import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:booking-flights');

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
    .from('booking_flights')
    .select('*, suppliers(name, contact_email, contact_phone)')
    .eq('booking_id', params.id)
    .order('sort_order');

  if (error) {
    logger.error('list', 'Failed to fetch flights', { bookingId: params.id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  body.booking_id = params.id;

  logger.info('create', 'Adding flight to booking', { bookingId: params.id, flight: body.flight_number });

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('booking_flights').insert(body).select().single();

  if (error) {
    logger.error('create', 'Failed to add flight', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: params.id,
    user_id: user.id,
    action: 'flight_added',
    details: { component_id: data.id, airline: data.airline, flight_number: data.flight_number },
  });

  logger.info('create', 'Flight added', { bookingId: params.id, flightId: data.id });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { component_id, ...updates } = body;

  if (!component_id) return NextResponse.json({ error: 'component_id required' }, { status: 400 });

  logger.info('update', 'Updating flight', { bookingId: params.id, flightId: component_id });

  const supabase = createServiceClient();

  const { data: old } = await supabase.from('booking_flights').select('status').eq('id', component_id).single();

  const { data, error } = await supabase
    .from('booking_flights')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', component_id)
    .select()
    .single();

  if (error) {
    logger.error('update', 'Failed to update flight', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updates.status && old?.status !== updates.status) {
    await supabase.from('booking_logs').insert({
      booking_id: params.id,
      user_id: user.id,
      action: 'flight_status_changed',
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

  logger.info('delete', 'Deleting flight', { bookingId: params.id, flightId: componentId });

  const supabase = createServiceClient();

  const { data: flight } = await supabase.from('booking_flights').select('airline, flight_number').eq('id', componentId).single();

  const { error } = await supabase.from('booking_flights').delete().eq('id', componentId);

  if (error) {
    logger.error('delete', 'Failed to delete flight', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: params.id,
    user_id: user.id,
    action: 'flight_removed',
    details: { component_id: componentId, airline: flight?.airline, flight_number: flight?.flight_number },
  });

  return NextResponse.json({ success: true });
}
