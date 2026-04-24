import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api:booking-logs');

async function getUser() {
  const authClient = await createClient();
  const { data } = await authClient.auth.getUser();
  return data.user;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_logs')
    .select('*, users(full_name, email)')
    .eq('booking_id', params.id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('list', 'Failed to fetch logs', { bookingId: params.id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
