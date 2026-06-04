import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Public GET endpoint to fetch sanitized proposal data for client link.
 * CRITICAL: All cost-price, supplier, and internal fields are stripped.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, destination, travel_start, travel_end, pax_adults, pax_children, currency, status, published_data, total_sp, share_token, created_by')
    .eq('share_token', token)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  // Fetch agent info for branding
  const { data: agent } = await supabase
    .from('users')
    .select('full_name, agency_name, logo_url')
    .eq('id', proposal.created_by)
    .single();

  // Fetch booking items if this proposal has been confirmed
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('proposal_id', proposal.id)
    .single();

  let safeItems: any[] = [];

  if (booking) {
    const { data: items } = await supabase
      .from('booking_items')
      .select('id, item_type, label, start_date, end_date, booking_id')
      .eq('booking_id', booking.id)
      .order('start_date');

    // SECURITY: Strip ALL sensitive fields — only safe display fields
    safeItems = (items || []).map(item => ({
      id: item.id,
      type: item.item_type,
      service_name: item.label,
      start_date: item.start_date,
      end_date: item.end_date,
    }));
  }

  // Extract safe itinerary from published_data
  const snap = proposal.published_data as Record<string, unknown> | null;
  let safeHotels: any[] = [];
  let safeFlights: any[] = [];
  let safeItinerary: any[] = [];

  if (snap) {
    // Hotels — strip all CP fields
    safeHotels = ((snap.hotels as any[]) || []).map(h => ({
      id: h.id,
      name: h.name || h.hotel_name,
      city: h.city,
      check_in: h.check_in || h.check_in_date,
      check_out: h.check_out || h.check_out_date,
      room_type: h.room_type,
      meal_plan: h.meal_plan,
      nights: h.nights,
      sp_per_night: h.sp_per_night,
      sp_total: h.sp_total,
    }));

    // Flights — strip CP
    safeFlights = ((snap.flights as any[]) || []).map(f => ({
      id: f.id,
      airline: f.airline,
      flight_number: f.flight_number,
      from_city: f.from_city || f.departure_city,
      to_city: f.to_city || f.arrival_city,
      departure_date: f.departure_date,
      departure_time: f.departure_time,
      arrival_time: f.arrival_time,
      sp_total: f.sp_total,
    }));

    // Itinerary
    safeItinerary = ((snap.itinerary_days || snap.itineraryDays) as any[]) || [];
  }

  return NextResponse.json({
    proposal: {
      id: proposal.id,
      title: proposal.title,
      destination: proposal.destination,
      travel_start: proposal.travel_start,
      travel_end: proposal.travel_end,
      pax_adults: proposal.pax_adults,
      pax_children: proposal.pax_children,
      currency: proposal.currency,
      status: proposal.status,
      total_selling_price: proposal.total_sp,
      share_token: proposal.share_token,
    },
    items: safeItems,
    hotels: safeHotels,
    flights: safeFlights,
    itinerary: safeItinerary,
    agent: agent ? {
      name: agent.full_name,
      agency: agent.agency_name,
      logo_url: agent.logo_url,
    } : null,
    booking_id: booking?.id || null,
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
