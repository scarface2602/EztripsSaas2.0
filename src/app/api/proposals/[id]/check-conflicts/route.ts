import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';

/**
 * POST /api/proposals/[id]/check-conflicts
 *
 * Scans all itinerary activities for a proposal and detects:
 * 1. Time overlaps — two activities on the same day with overlapping time windows
 * 2. Impossible transitions — consecutive-day activities in different cities where
 *    travel_time_cache says the transition can't happen in time
 *
 * Updates conflict_flagged and conflict_note directly on itinerary_activities rows.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  // Fetch all activities with their day info
  const { data: activities, error } = await supabase
    .from('itinerary_activities')
    .select('id, itinerary_day_id, type, start_time, end_time, location, details, conflict_flagged, conflict_acknowledged, sort_order, itinerary_days!inner(day_number, date, city)')
    .eq('proposal_id', id)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!activities || activities.length === 0) {
    return NextResponse.json({ conflicts: 0 });
  }

  // Fetch travel time cache for city-pair lookups
  const { data: travelTimes } = await supabase
    .from('travel_time_cache')
    .select('city_a, city_b, estimated_minutes');

  const travelTimeMap = new Map<string, number>();
  (travelTimes || []).forEach((t: { city_a: string; city_b: string; estimated_minutes: number }) => {
    const key1 = `${t.city_a.toLowerCase()}|${t.city_b.toLowerCase()}`;
    const key2 = `${t.city_b.toLowerCase()}|${t.city_a.toLowerCase()}`;
    travelTimeMap.set(key1, t.estimated_minutes);
    travelTimeMap.set(key2, t.estimated_minutes);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ActivityRow = (typeof activities)[number] & { itinerary_days: any };

  // Group activities by day
  const byDay = new Map<number, ActivityRow[]>();
  for (const act of activities as ActivityRow[]) {
    const dayNum = act.itinerary_days?.day_number;
    if (dayNum == null) continue;
    if (!byDay.has(dayNum)) byDay.set(dayNum, []);
    byDay.get(dayNum)!.push(act);
  }

  const updates: { id: string; conflict_flagged: boolean; conflict_note: string | null }[] = [];

  // Check 1: Time overlaps within the same day
  for (const dayActivities of Array.from(byDay.values())) {
    for (let i = 0; i < dayActivities.length; i++) {
      const a = dayActivities[i];
      let flagged = false;
      let note = '';

      if (a.start_time && a.end_time) {
        for (let j = 0; j < dayActivities.length; j++) {
          if (i === j) continue;
          const b = dayActivities[j];
          if (!b.start_time || !b.end_time) continue;

          if (timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) {
            flagged = true;
            note = `Time overlap with "${b.location || b.type}" (${b.start_time}–${b.end_time})`;
            break;
          }
        }
      }

      if (flagged !== a.conflict_flagged || (flagged && note !== (a as ActivityRow & { conflict_note?: string }).conflict_note)) {
        updates.push({
          id: a.id,
          conflict_flagged: flagged,
          conflict_note: flagged ? note : null,
        });
      }
    }
  }

  // Check 2: Impossible city transitions between consecutive days
  const sortedDays = Array.from(byDay.keys()).sort((a, b) => a - b);
  for (let d = 0; d < sortedDays.length - 1; d++) {
    const todayActs = byDay.get(sortedDays[d])!;
    const tomorrowActs = byDay.get(sortedDays[d + 1])!;

    // Get last activity of today and first activity of tomorrow
    const lastToday = todayActs[todayActs.length - 1];
    const firstTomorrow = tomorrowActs[0];

    const cityToday = lastToday.itinerary_days?.city?.toLowerCase();
    const cityTomorrow = firstTomorrow.itinerary_days?.city?.toLowerCase();

    if (cityToday && cityTomorrow && cityToday !== cityTomorrow) {
      const travelMinutes = travelTimeMap.get(`${cityToday}|${cityTomorrow}`);

      // If we have travel time data and it's > 12 hours, flag as conflict
      if (travelMinutes != null && travelMinutes > 720) {
        // Flag the first activity of the next day
        const alreadyUpdated = updates.find(u => u.id === firstTomorrow.id);
        if (!alreadyUpdated) {
          updates.push({
            id: firstTomorrow.id,
            conflict_flagged: true,
            conflict_note: `City transition ${cityToday} → ${cityTomorrow} requires ~${Math.round(travelMinutes / 60)}h travel, which may be impossible same-day`,
          });
        }
      }

      // Also flag if last activity ends late and first activity starts early
      if (lastToday.end_time && firstTomorrow.start_time) {
        const endMinutes = timeToMinutes(lastToday.end_time);
        const startMinutes = timeToMinutes(firstTomorrow.start_time);
        const transit = travelMinutes || 120; // default 2h if unknown

        if (endMinutes + transit > startMinutes + 1440) {
          // Can't make it even with overnight
          const alreadyUpdated = updates.find(u => u.id === firstTomorrow.id);
          if (!alreadyUpdated) {
            updates.push({
              id: firstTomorrow.id,
              conflict_flagged: true,
              conflict_note: `Tight transition: previous day ends at ${lastToday.end_time} in ${cityToday}, but this starts at ${firstTomorrow.start_time} in ${cityTomorrow}`,
            });
          }
        }
      }
    }
  }

  // Apply updates
  let conflictsFound = 0;
  for (const u of updates) {
    await supabase
      .from('itinerary_activities')
      .update({
        conflict_flagged: u.conflict_flagged,
        conflict_note: u.conflict_note,
      })
      .eq('id', u.id);

    if (u.conflict_flagged) conflictsFound++;
  }

  // Clear flags on activities that are no longer conflicting
  // (activities not in the updates list but currently flagged)
  const flaggedIds = updates.filter(u => u.conflict_flagged).map(u => u.id);
  const clearedIds = updates.filter(u => !u.conflict_flagged).map(u => u.id);
  if (clearedIds.length > 0) {
    // Already handled in the loop above
  }

  return NextResponse.json({
    conflicts: conflictsFound,
    updated: updates.length,
    flagged_ids: flaggedIds,
  });
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a0 = timeToMinutes(aStart);
  const a1 = timeToMinutes(aEnd);
  const b0 = timeToMinutes(bStart);
  const b1 = timeToMinutes(bEnd);
  return a0 < b1 && b0 < a1;
}

function timeToMinutes(time: string): number {
  // Handles "HH:mm", "HH:mm:ss", or ISO datetime
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}
