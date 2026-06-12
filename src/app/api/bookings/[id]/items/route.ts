import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api/with-auth';
import type { Permission } from '@/lib/auth/permissions';
import { createLogger } from '@/lib/logger';
import { validateStatusTransition } from '@/lib/api/validate-status-transition';
import { deriveBookingStatus } from '@/lib/api/booking-status';
import type { SupplierStatus } from '@/lib/types/booking-items';

const logger = createLogger('api:booking-items');

async function getUser(permission?: Permission) {
  return getAuthUser(permission);
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
  const user = await getUser('ops.actions');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { item_type, label, start_date, end_date, cost_price, sell_price, supplier_status, supplier_reference, supplier_notes, vendor_name, vendor_email, portal_name, payment_due_date, details, sort_order } = body;

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
      vendor_name: vendor_name || null,
      vendor_email: vendor_email || null,
      portal_name: portal_name || null,
      payment_due_date: payment_due_date || null,
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
  const user = await getUser('ops.actions');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { item_id, ...updates } = body;

  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

  // The quoted baseline is immutable — ops edits actuals only.
  delete updates.quoted_cost;
  delete updates.quoted_vendor_name;

  const supabase = createServiceClient();

  const { data: old } = await supabase
    .from('booking_items')
    .select('supplier_status, label, cost_price, vendor_name, quoted_cost')
    .eq('id', item_id)
    .single();

  // Server-side status transition validation
  if (updates.supplier_status && old?.supplier_status && updates.supplier_status !== old.supplier_status) {
    const transition = validateStatusTransition(
      old.supplier_status as SupplierStatus,
      updates.supplier_status as SupplierStatus
    );
    if (!transition.valid) {
      return NextResponse.json({ error: transition.error }, { status: 400 });
    }
  }

  // If marking as confirmed, auto-set confirmed_at
  if (updates.supplier_status === 'confirmed' && old?.supplier_status !== 'confirmed') {
    updates.supplier_confirmed_at = new Date().toISOString();
  }

  // If cancelling, auto-set cancelled_at and refund_status
  if (updates.supplier_status === 'cancelled' && old?.supplier_status !== 'cancelled') {
    updates.cancelled_at = new Date().toISOString();
    // If cancellation_charge or refund_amount provided, set refund_status to pending for manager review
    if (updates.refund_amount && Number(updates.refund_amount) > 0) {
      updates.refund_status = 'pending';
    }
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
  // Negotiated cost / supplier changes — audit trail for margin tracking
  if (updates.cost_price !== undefined && Number(updates.cost_price) !== Number(old?.cost_price)) {
    logDetails.old_cost = old?.cost_price;
    logDetails.new_cost = updates.cost_price;
    if (old?.quoted_cost != null) {
      logDetails.margin_delta_vs_quote = Number(old.quoted_cost) - Number(updates.cost_price);
    }
  }
  if (updates.vendor_name !== undefined && updates.vendor_name !== old?.vendor_name) {
    logDetails.old_vendor = old?.vendor_name;
    logDetails.new_vendor = updates.vendor_name;
  }
  if (updates.cancellation_reason) logDetails.cancellation_reason = updates.cancellation_reason;
  if (updates.cancellation_charge) logDetails.cancellation_charge = updates.cancellation_charge;
  if (updates.refund_amount) logDetails.refund_amount = updates.refund_amount;

  const logAction = updates.supplier_status === 'cancelled' ? 'item_cancelled' : 'item_updated';

  await supabase.from('booking_logs').insert({
    booking_id: id,
    user_id: user.id,
    action: logAction,
    details: logDetails,
  });

  // Auto-derive booking status from all items
  if (updates.supplier_status) {
    const { data: allItems } = await supabase
      .from('booking_items')
      .select('supplier_status')
      .eq('booking_id', id);

    if (allItems && allItems.length > 0) {
      const newBookingStatus = deriveBookingStatus(
        allItems.map(i => i.supplier_status as SupplierStatus)
      );
      await supabase.from('bookings').update({ status: newBookingStatus }).eq('id', id);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser('ops.actions');
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
