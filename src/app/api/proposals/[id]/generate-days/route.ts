import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('travel_start, travel_end, trip_cities')
    .eq('id', id)
    .single();

  if (!proposal?.travel_start || !proposal?.travel_end) {
    return NextResponse.json({ error: 'Proposal has no travel dates' }, { status: 400 });
  }

  const tripCities = (proposal.trip_cities as Array<{ city: string; nights: number }>) || [];

  function getCityForDay(dayNum: number): string {
    if (!tripCities.length) return '';
    let acc = 0;
    for (const c of tripCities) {
      acc += c.nights;
      if (dayNum <= acc) return c.city;
    }
    return tripCities[tripCities.length - 1].city;
  }

  // Fetch existing days so we never overwrite
  const { data: existingDays } = await supabase
    .from('itinerary_days')
    .select('date')
    .eq('proposal_id', id);

  const existingDates = new Set((existingDays || []).map((d: { date: string }) => d.date));

  const start = new Date(proposal.travel_start);
  const end = new Date(proposal.travel_end);
  const newDays: Array<{ proposal_id: string; day_number: number; date: string; city?: string }> = [];
  let dayNum = 1;
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    if (!existingDates.has(dateStr)) {
      const city = getCityForDay(dayNum);
      newDays.push({
        proposal_id: id,
        day_number: dayNum,
        date: dateStr,
        ...(city ? { city } : {}),
      });
    }
    dayNum++;
    current.setDate(current.getDate() + 1);
  }

  if (newDays.length === 0) {
    return NextResponse.json({ message: 'No new days to create', created: 0 });
  }

  const { data: inserted, error } = await supabase
    .from('itinerary_days')
    .insert(newDays)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ created: inserted?.length || 0, days: inserted });
}
