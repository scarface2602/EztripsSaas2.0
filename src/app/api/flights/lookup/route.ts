import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { withAuth } from '@/lib/api/with-auth';

const flightLookupSchema = z.object({
  flight_number: z.string().min(2).max(10),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { flight_number } = flightLookupSchema.parse(body);

    const apiKey = process.env.AVIATIONSTACK_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'AviationStack API key not configured' }, { status: 500 });
    }

    const res = await fetch(
      `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${encodeURIComponent(flight_number)}`
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to lookup flight' }, { status: 500 });
    }

    const data = await res.json();
    const flight = data.data?.[0];

    if (!flight) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 });
    }

    return NextResponse.json({
      airline: flight.airline?.name,
      origin_iata: flight.departure?.iata,
      origin_city: flight.departure?.airport,
      destination_iata: flight.arrival?.iata,
      destination_city: flight.arrival?.airport,
      departure_at: flight.departure?.scheduled,
      arrival_at: flight.arrival?.scheduled,
      aircraft_type: flight.aircraft?.registration || null,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
