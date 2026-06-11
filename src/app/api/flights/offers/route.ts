import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { getFlightProvider } from '@/lib/providers';

const schema = z.object({
  origin: z.string().trim().length(3),
  destination: z.string().trim().length(3),
  depart_date: z.string(),
  return_date: z.string().optional(),
  adults: z.number().int().min(1).max(20).default(1),
});

// POST /api/flights/offers — schedule + indicative-fare lookup from the
// configured flight provider. Fares are cached snapshots; agents verify
// with their consolidator and overwrite the cost.
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth instanceof NextResponse) return auth;

  const provider = getFlightProvider();
  if (!provider) {
    return NextResponse.json({ error: 'No flight API configured', offers: [] }, { status: 200 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Origin/destination must be IATA codes' }, { status: 400 });
  const p = parsed.data;

  try {
    const offers = await provider.searchOffers({
      origin: p.origin,
      destination: p.destination,
      departDate: p.depart_date,
      returnDate: p.return_date,
      adults: p.adults,
    });
    return NextResponse.json({ provider: provider.id, offers });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, offers: [] }, { status: 502 });
  }
}
