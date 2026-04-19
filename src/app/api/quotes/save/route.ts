import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ParsedQuote } from '@/lib/types/database';

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  const body = await request.json();
  const parsed = body.parsed_data as ParsedQuote | null;

  // Create proposal
  const { data: proposal, error: proposalError } = await supabase.from('proposals').insert({
    created_by: user.id,
    client_id: body.client_id,
    pricing_mode: body.pricing_mode || 'standard',
    quote_type: body.quote_type || 'itemised',
    title: body.title,
    destination: body.destination || parsed?.destination,
    travel_start: body.travel_start || parsed?.travel_start,
    travel_end: body.travel_end || parsed?.travel_end,
    pax_adults: body.pax_adults || parsed?.pax_adults || 1,
    pax_children: body.pax_children || parsed?.pax_children || 0,
    children_ages: body.children_ages || null,
    // Always default to INR — agent can change via currency selector after import
    currency: body.currency || 'INR',
    status: 'draft',
    trip_cities: body.trip_cities || null,
  }).select().single();

  if (proposalError || !proposal) {
    return NextResponse.json({ error: proposalError?.message || 'Failed to create proposal' }, { status: 500 });
  }

  // Insert hotels
  const hotelsToInsert = parsed?.hotels?.length ? parsed.hotels.map((h, i) => ({
    proposal_id: proposal.id,
    supplier_id: body.supplier_id || null,
    name: h.name,
    city: h.city,
    check_in: h.check_in || body.travel_start || new Date().toISOString().split('T')[0],
    check_out: h.check_out || body.travel_end || new Date().toISOString().split('T')[0],
    room_type: h.room_type,
    meal_plan: h.meal_plan,
    cp_per_night: h.cp_per_night,
    description: h.description,
    sort_order: i,
  })) : [];
  if (hotelsToInsert.length) {
    await supabase.from('hotels').insert(hotelsToInsert);
  }

  // Insert flights with refundable status
  if (parsed?.flights?.length) {
    const flights = parsed.flights.map((f, i) => {
      const fAny = f as unknown as Record<string, unknown>;
      return {
        proposal_id: proposal.id,
        supplier_id: body.supplier_id || null,
        flight_number: f.flight_number,
        cp_total: f.cp_total,
        refundable_status: (fAny.refundable_status as string) || 'non_refundable',
        cancellation_policy_text: (fAny.cancellation_policy_text as string) || null,
        is_non_refundable: fAny.refundable_status === 'non_refundable',
        sort_order: i,
      };
    });
    await supabase.from('flights').insert(flights);
  }

  // Create itinerary days from parsed data or date range
  // Use typed access directly — parsedAny cast only needed for cancellation_policy below
  const parsedAny = parsed as unknown as Record<string, unknown> | null;
  type ParsedDayRaw = {
    day_number: number;
    heading?: string | null;
    description?: string | null;
    city?: string | null;
    date?: string | null;
    day_type?: string | null;
    activities?: Array<{ type: string; description: string }>;
  };
  const parsedDays: ParsedDayRaw[] | undefined = (
    parsed?.itinerary_days as unknown as ParsedDayRaw[] | undefined
  ) ?? undefined;

  // Helper: auto-assign day_type based on position and city transitions
  function inferDayType(
    dayNum: number,
    totalDays: number,
    prevCity: string | null | undefined,
    thisCity: string | null | undefined,
  ): string {
    if (dayNum === 1) return 'arrival';
    if (dayNum === totalDays) return 'departure';
    if (prevCity && thisCity && prevCity.toLowerCase() !== thisCity.toLowerCase()) {
      return 'transfer'; // Flight detection skipped on server (no flight lookup at save time)
    }
    return 'tour';
  }

  // Helper: given a date string, find which hotel's stay covers it and return that hotel's city
  function inferCityFromHotels(dateStr: string): string {
    for (const h of hotelsToInsert) {
      if (h.check_in <= dateStr && h.check_out > dateStr) return h.city;
    }
    return '';
  }

  if (parsedDays?.length) {
    // Use parsed itinerary days with verbatim DMC descriptions
    const startDate = body.travel_start || parsed?.travel_start;
    const total = parsedDays.length;
    const days = parsedDays.map((d, i) => {
      const date = d.date || (startDate
        ? new Date(new Date(startDate).getTime() + (d.day_number - 1) * 86400000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]);
      // City: always prefer hotel-based inference over AI-extracted city (avoids day-trip misclassification)
      const cityFromHotel = inferCityFromHotels(date);
      const city = cityFromHotel || null;
      const prevParsedDay = i > 0 ? parsedDays[i - 1] : null;
      const prevCity = prevParsedDay
        ? (inferCityFromHotels(
            parsedDays[i - 1].date || (startDate
              ? new Date(new Date(startDate).getTime() + (parsedDays[i - 1].day_number - 1) * 86400000).toISOString().split('T')[0]
              : '')
          ) || prevParsedDay.city)
        : null;
      const validDayTypes = ['arrival', 'departure', 'tour', 'transfer', 'flight'];
      const dayType = (d.day_type && validDayTypes.includes(d.day_type))
        ? d.day_type
        : inferDayType(d.day_number, total, prevCity, city);
      return {
        proposal_id: proposal.id,
        day_number: d.day_number,
        date,
        city,
        heading: d.heading || '',
        description: d.description || '',
        day_type: dayType,
      };
    });
    const { data: insertedDays } = await supabase.from('itinerary_days').insert(days).select();

    // Insert activities for each day
    if (insertedDays) {
      const dayActivities: Array<Record<string, unknown>> = [];
      for (const insertedDay of insertedDays) {
        const parsedDay = parsedDays.find(pd => pd.day_number === insertedDay.day_number);
        if (parsedDay?.activities?.length) {
          for (let ai = 0; ai < parsedDay.activities.length; ai++) {
            const act = parsedDay.activities[ai];
            dayActivities.push({
              proposal_id: proposal.id,
              itinerary_day_id: insertedDay.id,
              type: ['transfer', 'sightseeing', 'activity', 'other'].includes(act.type) ? act.type : 'other',
              location: act.description,
              sort_order: ai,
            });
          }
        }
      }
      if (dayActivities.length > 0) {
        await supabase.from('itinerary_activities').insert(dayActivities);
      }
    }
  } else if (body.travel_start && body.travel_end) {
    const start = new Date(body.travel_start);
    const end = new Date(body.travel_end);
    const tripCities = body.trip_cities as Array<{ city: string; nights: number }> | null;
    const cityForDayNum = (dayNum: number): string => {
      if (!tripCities?.length) return '';
      let acc = 0;
      for (const c of tripCities) {
        acc += c.nights;
        if (dayNum <= acc) return c.city;
      }
      return tripCities[tripCities.length - 1].city;
    };
    type DayRow = { proposal_id: string; day_number: number; date: string; city: string };
    const allDays: DayRow[] = [];
    let dayNum = 1;
    const current = new Date(start);
    while (current <= end) {
      allDays.push({
        proposal_id: proposal.id,
        day_number: dayNum,
        date: current.toISOString().split('T')[0],
        city: cityForDayNum(dayNum),
      });
      dayNum++;
      current.setDate(current.getDate() + 1);
    }
    const total = allDays.length;
    const days = allDays.map((d, i) => {
      const prevCity = i > 0 ? allDays[i - 1].city : null;
      const dayType = inferDayType(d.day_number, total, prevCity, d.city);
      return { ...d, city: d.city || undefined, day_type: dayType };
    });
    if (days.length > 0) {
      await supabase.from('itinerary_days').insert(days);
    }
  }

  // Auto-generate trip_cities from hotels (always — hotels are the source of truth for stays)
  if (!body.trip_cities && hotelsToInsert.length) {
    const autoTripCities = hotelsToInsert.map((h, index) => ({
      city: h.city,
      nights: Math.round(
        (new Date(h.check_out).getTime() - new Date(h.check_in).getTime()) / (1000 * 60 * 60 * 24)
      ),
      order: index,
    }));
    if (autoTripCities.length) {
      await supabase.from('proposals').update({ trip_cities: autoTripCities }).eq('id', proposal.id);
    }
  }

  // Insert inclusions/exclusions as line_items
  if (parsed?.inclusions?.length) {
    const inclItems = parsed.inclusions.map((desc, i) => ({
      proposal_id: proposal.id,
      type: 'other',
      description: desc,
      is_included: true,
      sort_order: i,
    }));
    await supabase.from('line_items').insert(inclItems);
  }
  if (parsed?.exclusions?.length) {
    const exclItems = parsed.exclusions.map((desc, i) => ({
      proposal_id: proposal.id,
      type: 'other',
      description: desc,
      is_included: false,
      sort_order: (parsed?.inclusions?.length || 0) + i,
    }));
    await supabase.from('line_items').insert(exclItems);
  }

  // Store cancellation policy in proposal draft_data
  const cancellationPolicy = parsedAny?.cancellation_policy;
  if (cancellationPolicy) {
    await supabase.from('proposals').update({
      draft_data: { land_cancellation_slabs: cancellationPolicy },
    }).eq('id', proposal.id);
  }

  // Store payment terms
  if (parsed?.payment_terms) {
    await supabase.from('proposals').update({
      payment_terms: { deposit_pct: 25, balance_days_before: 30, notes: parsed.payment_terms },
    }).eq('id', proposal.id);
  }

  // Store raw quote
  if (parsed) {
    await supabase.from('raw_quotes').insert({
      proposal_id: proposal.id,
      supplier_id: body.supplier_id || null,
      source_type: 'text',
      parsed_json: parsed,
    });
  }

  return NextResponse.json({ id: proposal.id });
}
