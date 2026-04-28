import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:booking-items');

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
    .from('booking_items')
    .select('*')
    .eq('booking_id', id)
    .order('sort_order', { ascending: true })
    .order('start_date', { ascending: true });

  if (error) {
    logger.error('list', 'Failed to fetch items', { bookingId: id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { item_type, label, start_date, end_date, cost_price, sell_price, supplier_status, supplier_reference, supplier_notes, details, sort_order } = body;

  if (!item_type || !label) {
    return NextResponse.json({ error: 'item_type and label are required' }, { status: 400 });
  }

  logger.info('create', 'Adding booking item', { bookingId: id, item_type, label });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_items')
    .insert({
      booking_id: id,
      item_type,
      label,
      start_date: start_date || null,
      end_date: end_date || null,
      cost_price: cost_price ?? null,
      sell_price: sell_price ?? null,
      supplier_status: supplier_status || 'pending',
      supplier_reference: supplier_reference || null,
      supplier_notes: supplier_notes || null,
      details: details || {},
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    logger.error('create', 'Failed to add item', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'item_added',
    details: { item_id: data.id, item_type, label },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { item_id, ...updates } = body;

  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: old } = await supabase.from('booking_items').select('supplier_status, label').eq('id', item_id).single();

  // If marking as confirmed, auto-set confirmed_at
  if (updates.supplier_status === 'confirmed' && old?.supplier_status !== 'confirmed') {
    updates.supplier_confirmed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('booking_items')
    .update(updates)
    .eq('id', item_id)
    .select()
    .single();

  if (error) {
    logger.error('update', 'Failed to update item', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logDetails: Record<string, unknown> = { item_id, label: data.label };
  if (updates.supplier_status && old?.supplier_status !== updates.supplier_status) {
    logDetails.old_status = old?.supplier_status;
    logDetails.new_status = updates.supplier_status;
  }

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'item_updated',
    details: logDetails,
  });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('item_id');
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: item } = await supabase.from('booking_items').select('label, item_type').eq('id', itemId).single();

  const { error } = await supabase.from('booking_items').delete().eq('id', itemId);

  if (error) {
    logger.error('delete', 'Failed to delete item', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: 'item_removed',
    details: { item_id: itemId, label: item?.label, item_type: item?.item_type },
  });

  return NextResponse.json({ success: true });
}
