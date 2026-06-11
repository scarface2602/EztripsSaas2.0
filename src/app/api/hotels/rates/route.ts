import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { getHotelProvider } from '@/lib/providers';

export const maxDuration = 30;

const schema = z.object({
  city_name: z.string().trim().min(1),
  country_code: z.string().trim().length(2).optional(),
  hotel_name: z.string().trim().optional(),
  check_in: z.string(),
  check_out: z.string(),
  adults: z.number().int().min(1).max(20).default(2),
  children_ages: z.array(z.number().int().min(0).max(17)).default([]),
});

// POST /api/hotels/rates — live availability + indicative rates from the
// configured hotel provider. Agent-facing only; prices are prefills the
// agent overwrites with B2B rates.
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth instanceof NextResponse) return auth;

  const provider = getHotelProvider();
  if (!provider) {
    return NextResponse.json({ error: 'No hotel API configured', rates: [] }, { status: 200 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const p = parsed.data;

  try {
    const rates = await provider.searchRates({
      cityName: p.city_name,
      countryCode: p.country_code,
      hotelName: p.hotel_name,
      checkIn: p.check_in,
      checkOut: p.check_out,
      rooms: [{ adults: p.adults, ...(p.children_ages.length ? { children: p.children_ages } : {}) }],
    });
    return NextResponse.json({ provider: provider.id, rates });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, rates: [] }, { status: 502 });
  }
}
