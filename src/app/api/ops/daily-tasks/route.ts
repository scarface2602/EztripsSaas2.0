import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET() {
  const auth = await withAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch scheduled_reminders with joined booking_items data
  const { data: reminders, error } = await supabase
    .from('scheduled_reminders')
    .select(`
      id, reminder_type, send_at, status,
      booking_id, booking_item_id,
      booking_items:booking_item_id (
        id, item_type, label, supplier_status, supplier_reference,
        vendor_name, vendor_email, portal_name, payment_due_date,
        start_date, end_date, cost_price,
        followup_count, last_followup_at, escalated,
        booking_id, assigned_to, checked_in_at, checked_out_at
      )
    `)
    .in('status', ['pending', 'failed'])
    .order('send_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch booking context
  const bookingIds = Array.from(new Set((reminders || []).map(r => r.booking_id).filter(Boolean)));
  const { data: bookings } = bookingIds.length > 0
    ? await supabase
        .from('bookings')
        .select('id, title, destination, travel_start, status, clients ( full_name )')
        .in('id', bookingIds)
    : { data: [] };

  const bookingMap: Record<string, any> = {};
  for (const b of bookings || []) {
    bookingMap[b.id] = b;
  }

  // Categorize into overdue, due_today, upcoming
  const overdue: any[] = [];
  const due_today: any[] = [];
  const upcoming: any[] = [];

  for (const reminder of reminders || []) {
    const sendAt = (reminder.send_at as string) || '';
    const scheduledDate = sendAt.includes('T') ? sendAt.split('T')[0] : sendAt.slice(0, 10);
    const item = Array.isArray(reminder.booking_items)
      ? reminder.booking_items[0]
      : reminder.booking_items;
    const booking = bookingMap[reminder.booking_id] || null;

    const task = {
      id: reminder.id,
      type: reminder.reminder_type,
      scheduled_for: reminder.send_at,
      status: reminder.status,
      booking_id: reminder.booking_id,
      booking_item: item || null,
      booking: booking
        ? {
            id: booking.id,
            title: booking.title,
            destination: booking.destination,
            client_name: booking.clients?.full_name || 'Guest',
          }
        : null,
    };

    if (scheduledDate < today) {
      overdue.push(task);
    } else if (scheduledDate === today) {
      due_today.push(task);
    } else {
      upcoming.push(task);
    }
  }

  return NextResponse.json({ overdue, due_today, upcoming });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
