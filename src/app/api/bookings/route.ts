import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/with-auth';
import { createLogger } from '@/lib/logger';
import { createBookingsFromProposal } from '@/lib/bookings';
import { createBookingSchema, updateBookingSchema } from '@/lib/schemas/bookings';

const logger = createLogger('api:bookings');

// GET /api/bookings — list all bookings
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const proposalId = searchParams.get('proposal_id');

    const supabase = createServiceClient();
    let query = supabase
      .from('bookings')
      .select('*, clients(full_name, phone, email), suppliers(name), proposals(title, quote_type)')
      .order('created_at', { ascending: false });

    // Ownership filter: agents only see their own bookings
    if (auth.user.role !== 'super_admin') {
      query = query.eq('created_by', auth.authUser.id);
    }

    if (status) query = query.eq('status', status);
    if (proposalId) query = query.eq('proposal_id', proposalId);
    if (search) query = query.or(`title.ilike.%${search}%,destination.ilike.%${search}%`);

    const { data, error } = await query;

    if (error) {
      logger.error('list', 'Failed to fetch bookings', { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/bookings — auto-create bookings from a confirmed proposal
export async function POST(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'proposals.manage' });
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { proposal_id } = createBookingSchema.parse(body);

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

    const createdBookings = await createBookingsFromProposal(supabase, proposal, auth.authUser.id);

    return NextResponse.json({ bookings: createdBookings }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/bookings — update booking
export async function PATCH(request: NextRequest) {
  try {
    const auth = await withAuth(request, { permission: 'bookings.manage' });
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { id, ...updates } = updateBookingSchema.parse(body);

    const supabase = createServiceClient();

    // Ownership check
    if (auth.user.role !== 'super_admin') {
      const { data: booking } = await supabase.from('bookings').select('created_by').eq('id', id).single();
      if (!booking || booking.created_by !== auth.authUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

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
        user_id: auth.authUser.id,
        action: 'status_changed',
        details: { old_status: old?.status, new_status: updates.status },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 });
    }
    console.error('Route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
