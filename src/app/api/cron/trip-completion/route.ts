import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Verify cron secret to prevent unauthorized access
function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) return false;
  return true;
}

/**
 * Closes the trip lifecycle: ACTIVE_BOOKING trips whose travel_end passed
 * more than a day ago become COMPLETED. Runs daily.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);
  const cutoffDate = cutoff.toISOString().split('T')[0];

  const { data: dueTrips, error } = await supabase
    .from('trips')
    .select('id, trip_id, travel_end, booking_id')
    .eq('status', 'ACTIVE_BOOKING')
    .not('travel_end', 'is', null)
    .lt('travel_end', cutoffDate);

  if (error) {
    console.error('trip-completion query failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let completed = 0;
  for (const trip of dueTrips || []) {
    const { error: updateError } = await supabase
      .from('trips')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('id', trip.id);

    if (updateError) {
      console.error(`trip-completion failed for ${trip.trip_id}:`, updateError);
      continue;
    }
    completed++;

    if (trip.booking_id) {
      await supabase.from('booking_logs').insert({
        booking_id: trip.booking_id,
        action: 'trip_completed',
        details: { trip_id: trip.trip_id, travel_end: trip.travel_end },
      });
    }
  }

  return NextResponse.json({ status: 'ok', checked: dueTrips?.length || 0, completed });
}
