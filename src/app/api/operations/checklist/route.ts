import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET() {
  const auth = await withAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const threeDaysOut = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const items: Array<{
    id: string;
    category: string;
    label: string;
    booking_id: string;
    client_name: string;
    due_info: string;
    item_type?: string;
  }> = [];

  // 1. Items needing confirmation (start_date within 3 days, status=pending)
  const { data: pendingConfirmation } = await supabase
    .from('booking_items')
    .select('id, label, item_type, start_date, booking_id, bookings!inner(id, title, clients(full_name))')
    .eq('supplier_status', 'pending')
    .lte('start_date', threeDaysOut)
    .gte('start_date', today)
    .order('start_date');

  for (const item of pendingConfirmation || []) {
    const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
    items.push({
      id: `confirm-${item.id}`,
      category: 'confirmation',
      label: item.label,
      booking_id: item.booking_id,
      client_name: (booking as any)?.clients?.full_name || 'Guest',
      due_info: `Travel ${item.start_date}`,
      item_type: item.item_type,
    });
  }

  // 2. Overdue follow-ups (confirmation_requested > 48h ago, no recent follow-up)
  const { data: overdueFollowups } = await supabase
    .from('booking_items')
    .select('id, label, item_type, booking_id, last_followup_at, vendor_name, bookings!inner(id, title, clients(full_name))')
    .eq('supplier_status', 'confirmation_requested')
    .or(`last_followup_at.is.null,last_followup_at.lt.${twoDaysAgo}`);

  for (const item of overdueFollowups || []) {
    const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
    items.push({
      id: `followup-${item.id}`,
      category: 'follow_up',
      label: `${item.label} — ${item.vendor_name || 'Vendor'}`,
      booking_id: item.booking_id,
      client_name: (booking as any)?.clients?.full_name || 'Guest',
      due_info: item.last_followup_at ? `Last follow-up ${new Date(item.last_followup_at).toLocaleDateString()}` : 'No follow-up sent',
      item_type: item.item_type,
    });
  }

  // 3. Payments due today (from booking_payments)
  const { data: paymentsDue } = await supabase
    .from('booking_payments')
    .select('id, amount, direction, due_date, booking_id, bookings!inner(id, title, clients(full_name))')
    .eq('due_date', today)
    .in('status', ['pending', 'partial']);

  for (const payment of paymentsDue || []) {
    const booking = Array.isArray(payment.bookings) ? payment.bookings[0] : payment.bookings;
    items.push({
      id: `payment-${payment.id}`,
      category: payment.direction === 'payable' ? 'supplier_payment' : 'client_payment',
      label: `${payment.direction === 'payable' ? 'Pay supplier' : 'Collect from client'} — ${(booking as any)?.title || 'Booking'}`,
      booking_id: payment.booking_id,
      client_name: (booking as any)?.clients?.full_name || 'Guest',
      due_info: `₹${Number(payment.amount).toLocaleString('en-IN')}`,
    });
  }

  // 4. Check-ins today
  const { data: checkIns } = await supabase
    .from('booking_items')
    .select('id, label, item_type, booking_id, checked_in_at, bookings!inner(id, title, clients(full_name))')
    .eq('start_date', today)
    .is('checked_in_at', null);

  for (const item of checkIns || []) {
    const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
    items.push({
      id: `checkin-${item.id}`,
      category: 'check_in',
      label: item.label,
      booking_id: item.booking_id,
      client_name: (booking as any)?.clients?.full_name || 'Guest',
      due_info: 'Pending check-in',
      item_type: item.item_type,
    });
  }

  // 5. Check-outs today
  const { data: checkOuts } = await supabase
    .from('booking_items')
    .select('id, label, item_type, booking_id, checked_in_at, checked_out_at, bookings!inner(id, title, clients(full_name))')
    .eq('end_date', today)
    .not('checked_in_at', 'is', null)
    .is('checked_out_at', null);

  for (const item of checkOuts || []) {
    const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
    items.push({
      id: `checkout-${item.id}`,
      category: 'check_out',
      label: item.label,
      booking_id: item.booking_id,
      client_name: (booking as any)?.clients?.full_name || 'Guest',
      due_info: 'Pending check-out',
      item_type: item.item_type,
    });
  }

  return NextResponse.json({ items });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
