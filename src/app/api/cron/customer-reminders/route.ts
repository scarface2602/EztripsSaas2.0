import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Cron: Customer Payment Reminders
 * Runs daily. Finds bookings where:
 * - Travel starts within 7 days AND customer balance > 0
 * Logs reminders for agent follow-up.
 *
 * Vercel cron: { "path": "/api/cron/customer-reminders", "schedule": "0 10 * * *" }
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Find bookings with travel starting within 7 days where balance remains
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, title, sell_price, total_paid, travel_start, clients(full_name, email)')
    .gte('travel_start', today)
    .lte('travel_start', in7days)
    .in('status', ['pending', 'in_progress', 'confirmed', 'blocked']);

  if (error) {
    console.error('Customer reminders error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ message: 'No upcoming bookings with balance', count: 0 });
  }

  let reminded = 0;

  for (const booking of bookings) {
    const balance = Number(booking.sell_price || 0) - Number(booking.total_paid || 0);
    if (balance <= 0) continue;

    const daysUntilTravel = Math.ceil((new Date(booking.travel_start!).getTime() - now.getTime()) / 86400000);
    const isUrgent = daysUntilTravel <= 2;

    await supabase.from('booking_logs').insert({
      booking_id: booking.id,
      action: isUrgent ? 'customer_payment_urgent' : 'customer_payment_reminder',
      details: {
        client: (booking.clients as unknown as { full_name: string } | null)?.full_name || 'Guest',
        balance: balance,
        travel_start: booking.travel_start,
        days_until_travel: daysUntilTravel,
      },
    });

    reminded++;
  }

  return NextResponse.json({
    message: `Customer reminders sent: ${reminded} bookings with balance due`,
    reminded,
  });
}
