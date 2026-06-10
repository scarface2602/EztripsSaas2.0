import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { generateTripIdFromDb } from '@/lib/utils/generateId';
import { getTripIdConfig } from '@/lib/utils/getTripIdConfig';
import { ensureTripFolder, appendProposalToTrip } from '@/lib/trips';

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    source_proposal_id,
    enquiry_id,
    client_id,
    title,
    destination,
    travel_start,
    travel_end,
    pax_adults,
    pax_children,
    children_ages,
    trip_cities,
    currency,
  } = body;

  if (!source_proposal_id) {
    return NextResponse.json({ error: 'source_proposal_id is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch source proposal
  const { data: source, error: sourceErr } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', source_proposal_id)
    .single();

  if (sourceErr || !source) {
    return NextResponse.json({ error: 'Source proposal not found' }, { status: 404 });
  }

  // Fetch all related records from source
  const [
    { data: srcHotels },
    { data: srcFlights },
    { data: srcDays },
    { data: srcActivities },
    { data: srcLineItems },
  ] = await Promise.all([
    supabase.from('hotels').select('*').eq('proposal_id', source_proposal_id).order('sort_order'),
    supabase.from('flights').select('*').eq('proposal_id', source_proposal_id).order('sort_order'),
    supabase.from('itinerary_days').select('*').eq('proposal_id', source_proposal_id).order('day_number'),
    supabase.from('itinerary_activities').select('*').eq('proposal_id', source_proposal_id).order('sort_order'),
    supabase.from('line_items').select('*').eq('proposal_id', source_proposal_id).order('sort_order'),
  ]);

  // Calculate date offset for adjusting cloned dates
  const srcStart = source.travel_start ? new Date(source.travel_start).getTime() : 0;
  const newStart = travel_start ? new Date(travel_start).getTime() : srcStart;
  const dateOffsetMs = newStart - srcStart;

  function shiftDate(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const d = new Date(new Date(dateStr).getTime() + dateOffsetMs);
    return d.toISOString().split('T')[0];
  }

  // Cloning for a lead keeps the lead's trip_id (same trip, alternate proposal);
  // cloning without an enquiry is a genuinely new trip and gets a fresh ID.
  let cloneTripId: string | null = null;
  if (enquiry_id) {
    const { data: enquiry } = await supabase
      .from('website_enquiries')
      .select('trip_id')
      .eq('id', enquiry_id)
      .single();
    cloneTripId = enquiry?.trip_id || null;
  }
  if (!cloneTripId) {
    const { data: cloneUserData } = await supabase.from('users').select('org_id').eq('id', user.id).single();
    const tripIdConfig = await getTripIdConfig(supabase, cloneUserData?.org_id);
    cloneTripId = await generateTripIdFromDb(supabase, 'PKG', tripIdConfig);
  }

  await ensureTripFolder(supabase, cloneTripId, {
    status: 'PROPOSING',
    client_id: client_id || null,
    destination: destination || source.destination || null,
    travel_start: travel_start || source.travel_start || null,
    travel_end: travel_end || source.travel_end || null,
    pax_adults: pax_adults ?? source.pax_adults ?? 1,
    pax_children: pax_children ?? source.pax_children ?? 0,
    created_by: user.id,
  });

  // Create new proposal
  const { data: newProposal, error: createErr } = await supabase
    .from('proposals')
    .insert({
      created_by: user.id,
      client_id: client_id || null,
      enquiry_id: enquiry_id || null,
      parent_proposal_id: source_proposal_id,
      status: 'draft',
      trip_id: cloneTripId,
      pricing_mode: source.pricing_mode,
      quote_type: source.quote_type,
      title: title || source.title,
      destination: destination || source.destination,
      travel_start: travel_start || source.travel_start,
      travel_end: travel_end || source.travel_end,
      pax_adults: pax_adults ?? source.pax_adults,
      pax_children: pax_children ?? source.pax_children,
      children_ages: children_ages || source.children_ages,
      currency: currency || source.currency,
      trip_cities: trip_cities || source.trip_cities,
      gst_enabled: source.gst_enabled,
      gst_rate: source.gst_rate,
      tcs_enabled: source.tcs_enabled,
      tcs_rate: source.tcs_rate,
      rounding_unit: source.rounding_unit,
      payment_terms: source.payment_terms,
    })
    .select()
    .single();

  if (createErr || !newProposal) {
    return NextResponse.json({ error: 'Failed to create proposal', details: createErr?.message }, { status: 500 });
  }

  const newId = newProposal.id;
  await appendProposalToTrip(supabase, cloneTripId, newId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function stripMeta(row: any) {
    const { id, proposal_id, created_at, ...rest } = row;
    void id; void proposal_id; void created_at;
    return rest;
  }

  // Clone hotels
  if (srcHotels?.length) {
    const hotels = srcHotels.map(h => ({
      ...stripMeta(h),
      proposal_id: newId,
      check_in: shiftDate(h.check_in),
      check_out: shiftDate(h.check_out),
    }));
    await supabase.from('hotels').insert(hotels);
  }

  // Clone flights
  if (srcFlights?.length) {
    const flights = srcFlights.map(f => ({
      ...stripMeta(f),
      proposal_id: newId,
      departure_at: f.departure_at ? new Date(new Date(f.departure_at).getTime() + dateOffsetMs).toISOString() : null,
      arrival_at: f.arrival_at ? new Date(new Date(f.arrival_at).getTime() + dateOffsetMs).toISOString() : null,
    }));
    await supabase.from('flights').insert(flights);
  }

  // Clone itinerary days and map old IDs to new IDs for activities
  const oldDayIdToNew = new Map<string, string>();
  if (srcDays?.length) {
    const days = srcDays.map(d => ({
      ...stripMeta(d),
      proposal_id: newId,
      date: shiftDate(d.date),
    }));
    const { data: insertedDays } = await supabase.from('itinerary_days').insert(days).select('id');
    if (insertedDays) {
      srcDays.forEach((d, i) => {
        if (insertedDays[i]) {
          oldDayIdToNew.set(d.id, insertedDays[i].id);
        }
      });
    }
  }

  // Clone itinerary activities
  if (srcActivities?.length) {
    const activities = srcActivities.map(a => ({
      ...stripMeta(a),
      proposal_id: newId,
      itinerary_day_id: oldDayIdToNew.get(a.itinerary_day_id) || a.itinerary_day_id,
    }));
    await supabase.from('itinerary_activities').insert(activities);
  }

  // Clone line items
  if (srcLineItems?.length) {
    const items = srcLineItems.map(li => ({
      ...stripMeta(li),
      proposal_id: newId,
      date: shiftDate(li.date),
    }));
    await supabase.from('line_items').insert(items);
  }

  return NextResponse.json({ id: newId });
}
