import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const destination = searchParams.get('destination');
  const duration = searchParams.get('duration');
  const citiesParam = searchParams.get('cities'); // comma-separated

  if (!destination) {
    return NextResponse.json({ error: 'destination is required' }, { status: 400 });
  }

  const cities = citiesParam ? citiesParam.split(',').map(c => c.trim()).filter(Boolean) : [];
  const durationInt = duration ? parseInt(duration, 10) : null;

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('find_similar_proposals', {
    p_destination: destination,
    p_duration: durationInt,
    p_cities: cities,
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch suggestions', details: error.message }, { status: 500 });
  }

  // Extract lightweight preview data from published_data to avoid sending huge payloads
  const suggestions = (data || []).map((row: {
    id: string;
    title: string;
    destination: string;
    route_signature: string;
    trip_cities: Array<{ city: string; nights: number }>;
    published_data: {
      itinerary_days?: Array<{ day_number: number; heading: string; city: string; day_type: string }>;
      hotels?: Array<{ name: string; city: string; nights: number; star_rating: number; meal_plan: string }>;
      proposal?: { pax_adults?: number; pax_children?: number; quote_type?: string; currency?: string };
    };
    cities_visited: string[];
    match_type: string;
    created_at: string;
  }) => {
    const pub = row.published_data || {};
    return {
      id: row.id,
      title: row.title,
      destination: row.destination,
      route_signature: row.route_signature,
      trip_cities: row.trip_cities,
      cities_visited: row.cities_visited,
      match_type: row.match_type,
      created_at: row.created_at,
      preview: {
        itinerary: (pub.itinerary_days || []).map((d) => ({
          day_number: d.day_number,
          heading: d.heading,
          city: d.city,
          day_type: d.day_type,
        })),
        hotels: (pub.hotels || []).map((h) => ({
          name: h.name,
          city: h.city,
          nights: h.nights,
          star_rating: h.star_rating,
          meal_plan: h.meal_plan,
        })),
        pax_adults: pub.proposal?.pax_adults,
        pax_children: pub.proposal?.pax_children,
        quote_type: pub.proposal?.quote_type,
        currency: pub.proposal?.currency,
      },
    };
  });

  return NextResponse.json(suggestions);
}
