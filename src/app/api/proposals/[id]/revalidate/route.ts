import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const now = new Date();
  const flightExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24h
  const landExpiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days

  const { error: updateErr } = await supabase
    .from('proposals')
    .update({
      flight_expires_at: flightExpiry,
      land_expires_at: landExpiry,
      updated_at: now.toISOString(),
    })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to revalidate proposal', details: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    flight_expires_at: flightExpiry,
    land_expires_at: landExpiry,
  });
}
