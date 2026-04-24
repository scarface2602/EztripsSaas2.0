import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:bookings');

async function getUser() {
  const authClient = await createClient();
  const { data } = await authClient.auth.getUser();
  return data.user;
}

// GET /api/bookings — list all bookings
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  logger.info('list', 'Fetching bookings', { status, search, userId: user.id });

  const supabase = createServiceClient();
  let query = supabase
    .from('bookings')
    .select('*, clients(full_name, phone, email)')
    .order('travel_start', { ascending: true });

  if (status) query = query.eq('status', status);
  if (search) query = query.or(`title.ilike.%${search}%,destination.ilike.%${search}%`);

  const { data, error } = await query;

  if (error) {
    logger.error('list', 'Failed to fetch bookings', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logger.info('list', `Fetched ${data?.length || 0} bookings`);
  return NextResponse.json(data);
}

// POST /api/bookings — create booking (optionally from a proposal)
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  logger.info('create', 'Creating booking', { proposalId: body.proposal_id, title: body.title, userId: user.id });

  const supabase = createServiceClient();

  // If creating from a proposal, fetch proposal data
  if (body.proposal_id) {
    const { data: proposal, error: pErr } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', body.proposal_id)
      .single();

    if (pErr || !proposal) {
      logger.error('create', 'Proposal not found', { proposalId: body.proposal_id, error: pErr?.message });
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Auto-populate from proposal
    body.title = body.title || proposal.title || 'Untitled Booking';
    body.destination = body.destination || proposal.destination;
    body.travel_start = body.travel_start || proposal.travel_start;
    body.travel_end = body.travel_end || proposal.travel_end;
    body.pax_adults = body.pax_adults ?? proposal.pax_adults;
    body.pax_children = body.pax_children ?? proposal.pax_children;
    body.children_ages = body.children_ages || proposal.children_ages;
    body.client_id = body.client_id || proposal.client_id;
    body.total_sell_price = body.total_sell_price ?? proposal.total_sp ?? 0;
    body.currency = body.currency || proposal.currency || 'INR';
  }

  body.created_by = user.id;

  const { data, error } = await supabase.from('bookings').insert(body).select().single();

  if (error) {
    logger.error('create', 'Failed to create booking', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the creation
  await supabase.from('booking_logs').insert({
    booking_id: data.id,
    user_id: user.id,
    action: 'booking_created',
    details: { proposal_id: body.proposal_id, title: data.title },
  });

  // If from proposal, also copy hotels and flights
  if (body.proposal_id) {
    await copyProposalComponents(supabase, body.proposal_id, data.id, user.id);
  }

  logger.info('create', 'Booking created', { bookingId: data.id, title: data.title });
  return NextResponse.json(data, { status: 201 });
}

async function copyProposalComponents(
  supabase: ReturnType<typeof createServiceClient>,
  proposalId: string,
  bookingId: string,
  userId: string,
) {
  // Copy hotels from proposal
  const { data: hotels } = await supabase
    .from('hotels')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('sort_order');

  if (hotels && hotels.length > 0) {
    const hotelInserts = hotels.map((h, i) => ({
      booking_id: bookingId,
      supplier_id: h.supplier_id,
      hotel_name: h.name,
      city: h.city,
      check_in: h.check_in,
      check_out: h.check_out,
      room_type: h.room_type,
      meal_plan: ['EP','CP','MAP','AP','AI'].includes(h.meal_plan) ? h.meal_plan : null,
      star_rating: h.star_rating,
      room_view: h.room_view,
      cost_price: h.cp_per_night
        ? h.cp_per_night * Math.max(1, Math.round((new Date(h.check_out).getTime() - new Date(h.check_in).getTime()) / 86400000))
        : 0,
      sell_price: h.sp_per_night
        ? h.sp_per_night * Math.max(1, Math.round((new Date(h.check_out).getTime() - new Date(h.check_in).getTime()) / 86400000))
        : 0,
      sort_order: i,
    }));

    const { error } = await supabase.from('booking_hotels').insert(hotelInserts);
    if (error) {
      logger.warn('copyComponents', 'Failed to copy hotels', { error: error.message });
    } else {
      logger.info('copyComponents', `Copied ${hotelInserts.length} hotels from proposal`);
    }
  }

  // Copy flights from proposal
  const { data: flights } = await supabase
    .from('flights')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('sort_order');

  if (flights && flights.length > 0) {
    const flightInserts = flights.map((f, i) => ({
      booking_id: bookingId,
      supplier_id: f.supplier_id,
      airline: f.airline,
      flight_number: f.flight_number,
      origin_city: f.origin_city,
      origin_iata: f.origin_iata,
      destination_city: f.destination_city,
      destination_iata: f.destination_iata,
      departure_at: f.departure_at,
      arrival_at: f.arrival_at,
      cabin_class: f.cabin_class,
      baggage_allowance: f.baggage_allowance,
      cost_price: f.cp_total || 0,
      sell_price: f.sp_total || 0,
      sort_order: i,
    }));

    const { error } = await supabase.from('booking_flights').insert(flightInserts);
    if (error) {
      logger.warn('copyComponents', 'Failed to copy flights', { error: error.message });
    } else {
      logger.info('copyComponents', `Copied ${flightInserts.length} flights from proposal`);
    }
  }

  // Copy sightseeing/activities from itinerary_activities
  const { data: itinActivities } = await supabase
    .from('itinerary_activities')
    .select('*, itinerary_days(date, city)')
    .eq('proposal_id', proposalId)
    .order('sort_order');

  if (itinActivities && itinActivities.length > 0) {
    const actInserts = itinActivities
      .filter(a => ['sightseeing', 'activity'].includes(a.type))
      .map((a, i) => {
        const day = a.itinerary_days as Record<string, unknown> | null;
        return {
          booking_id: bookingId,
          activity_name: a.location || a.type || 'Activity',
          date: (day?.date as string) || null,
          location: (day?.city as string) || null,
          status: 'pending' as const,
          sort_order: i,
        };
      });
    if (actInserts.length > 0) {
      const { error } = await supabase.from('booking_activities').insert(actInserts);
      if (error) {
        logger.warn('copyComponents', 'Failed to copy activities', { error: error.message });
      }
    }
  }

  // Copy transfers from itinerary_activities
  if (itinActivities && itinActivities.length > 0) {
    const transferInserts = itinActivities
      .filter(a => a.type === 'transfer')
      .map((a, i) => {
        const day = a.itinerary_days as Record<string, unknown> | null;
        return {
          booking_id: bookingId,
          type: 'intercity' as const,
          from_location: a.location || '',
          date: (day?.date as string) || new Date().toISOString().split('T')[0],
          status: 'pending' as const,
          sort_order: i,
        };
      });
    if (transferInserts.length > 0) {
      const { error } = await supabase.from('booking_transport').insert(transferInserts);
      if (error) {
        logger.warn('copyComponents', 'Failed to copy transfers', { error: error.message });
      }
    }
  }

  // Log component copy
  await supabase.from('booking_logs').insert({
    booking_id: bookingId,
    user_id: userId,
    action: 'components_copied_from_proposal',
    details: {
      proposal_id: proposalId,
      hotels_copied: hotels?.length || 0,
      flights_copied: flights?.length || 0,
      activities_copied: itinActivities?.filter(a => ['sightseeing', 'activity'].includes(a.type)).length || 0,
      transfers_copied: itinActivities?.filter(a => a.type === 'transfer').length || 0,
    },
  });
}

// PATCH /api/bookings — update booking
export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  logger.info('update', 'Updating booking', { bookingId: id, fields: Object.keys(updates) });

  const supabase = createServiceClient();

  // Get old status for logging
  const { data: old } = await supabase.from('bookings').select('status').eq('id', id).single();

  const { data, error } = await supabase
    .from('bookings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('update', 'Failed to update booking', { bookingId: id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log status changes
  if (updates.status && old?.status !== updates.status) {
    await supabase.from('booking_logs').insert({
      booking_id: id,
      user_id: user.id,
      action: 'status_changed',
      details: { old_status: old?.status, new_status: updates.status },
    });
    logger.info('update', `Booking status changed: ${old?.status} → ${updates.status}`, { bookingId: id });
  }

  return NextResponse.json(data);
}
