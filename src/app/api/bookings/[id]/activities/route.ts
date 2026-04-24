import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:booking-activities');

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
    .from('booking_activities')
    .select('*, suppliers(name, contact_email, contact_phone)')
    .eq('booking_id', params.id)
    .order('sort_order');

  if (error) {
    logger.error('list', 'Failed to fetch activities', { bookingId: params.id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  body.booking_id = params.id;

  logger.info('create', 'Adding activity to booking', { bookingId: params.id, activity: body.activity_name });

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('booking_activities').insert(body).select().single();

  if (error) {
    logger.error('create', 'Failed to add activity', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: params.id,
    user_id: user.id,
    action: 'activity_added',
    details: { component_id: data.id, activity_name: data.activity_name },
  });

  logger.info('create', 'Activity added', { bookingId: params.id, activityId: data.id });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { component_id, ...updates } = body;

  if (!component_id) return NextResponse.json({ error: 'component_id required' }, { status: 400 });

  logger.info('update', 'Updating activity', { bookingId: params.id, activityId: component_id });

  const supabase = createServiceClient();

  const { data: old } = await supabase.from('booking_activities').select('status').eq('id', component_id).single();

  const { data, error } = await supabase
    .from('booking_activities')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', component_id)
    .select()
    .single();

  if (error) {
    logger.error('update', 'Failed to update activity', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updates.status && old?.status !== updates.status) {
    await supabase.from('booking_logs').insert({
      booking_id: params.id,
      user_id: user.id,
      action: 'activity_status_changed',
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

  logger.info('delete', 'Deleting activity', { bookingId: params.id, activityId: componentId });

  const supabase = createServiceClient();

  const { data: activity } = await supabase.from('booking_activities').select('activity_name').eq('id', componentId).single();

  const { error } = await supabase.from('booking_activities').delete().eq('id', componentId);

  if (error) {
    logger.error('delete', 'Failed to delete activity', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: params.id,
    user_id: user.id,
    action: 'activity_removed',
    details: { component_id: componentId, activity_name: activity?.activity_name },
  });

  return NextResponse.json({ success: true });
}
