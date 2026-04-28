import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { fetchLiveRate } from '@/lib/utils/forex';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';

const forexRateSchema = z.object({
  from_currency: z.string().length(3),
  proposal_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { from_currency, proposal_id } = forexRateSchema.parse(body);

    const supabase = createServiceClient();
    const rate = await fetchLiveRate(from_currency);

    // Lock to proposal if provided
    if (proposal_id) {
      await supabase.from('forex_locks').upsert({
        proposal_id,
        from_currency,
        to_currency: 'INR',
        locked_rate: rate,
        locked_at: new Date().toISOString(),
      }, { onConflict: 'proposal_id,from_currency' });
    }

    return NextResponse.json({ rate, from_currency, to_currency: 'INR' });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
