import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';
import { createBookingsFromProposal } from '@/lib/bookings';

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
  const proposalId = searchParams.get('proposal_id');

  const supabase = createServiceClient();
  let query = supabase
    .from('bookings')
    .select('*, clients(full_name, phone, email), suppliers(name), proposals(title, quote_type)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (proposalId) query = query.eq('proposal_id', proposalId);
  if (search) query = query.or(`title.ilike.%${search}%,destination.ilike.%${search}%`);

  const { data, error } = await query;

  if (error) {
    logger.error('list', 'Failed to fetch bookings', { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/bookings — auto-create bookings from a confirmed proposal
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { proposal_id } = body;

  if (!proposal_id) {
    return NextResponse.json({ error: 'proposal_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: proposal, error: pErr } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposal_id)
    .single();

  if (pErr || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  // Check if bookings already exist for this proposal
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('proposal_id', proposal_id);

  if (count && count > 0) {
    return NextResponse.json({ error: 'Bookings already created for this proposal' }, { status: 400 });
  }

  const createdBookings = await createBookingsFromProposal(supabase, proposal, user.id);

  return NextResponse.json({ bookings: createdBookings }, { status: 201 });
}

// PATCH /api/bookings — update booking
export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: old } = await supabase.from('bookings').select('status').eq('id', id).single();

  const { data, error } = await supabase
    .from('bookings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (updates.status && old?.status !== updates.status) {
    await supabase.from('booking_logs').insert({
      booking_id: id,
      user_id: user.id,
      action: 'status_changed',
      details: { old_status: old?.status, new_status: updates.status },
    });
  }

  return NextResponse.json(data);
}
