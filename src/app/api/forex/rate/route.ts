import { NextRequest, NextResponse } from 'next/server';
import { fetchLiveRate } from '@/lib/utils/forex';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { from_currency, proposal_id } = await request.json();

  try {
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
  } catch {
    return NextResponse.json({ error: 'Failed to fetch rate' }, { status: 500 });
  }
}
