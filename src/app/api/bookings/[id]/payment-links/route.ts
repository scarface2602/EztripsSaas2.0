import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('payment_links')
    .select('*')
    .eq('booking_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(undefined, { permission: 'payments.manage' });
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = createServiceClient();
  const body = await req.json();

  const schema = z.object({
    amount: z.number().min(1),
    label: z.string().max(200).optional(),
    link_type: z.enum(['payment', 'fare_difference']).default('payment'),
    reason: z.string().max(500).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Get booking to find the proposal share_token for the URL
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, proposal_id, currency')
    .eq('id', id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const isFareDifference = parsed.data.link_type === 'fare_difference';
  if (isFareDifference && !parsed.data.reason) {
    return NextResponse.json({ error: 'A reason is required for fare-difference links' }, { status: 400 });
  }

  const { data: link, error } = await supabase
    .from('payment_links')
    .insert({
      booking_id: id,
      amount: parsed.data.amount,
      label: parsed.data.label || (isFareDifference ? `Fare difference — ${parsed.data.reason}` : null),
      link_type: parsed.data.link_type,
      reason: parsed.data.reason || null,
      currency: booking.currency || 'INR',
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isFareDifference) {
    // A fare difference is a price change after acceptance — it always gets
    // explicit re-consent, recorded on both the booking and the proposal.
    await supabase.from('booking_logs').insert({
      booking_id: id,
      user_id: auth.user.id,
      action: 'fare_difference_requested',
      details: { amount: parsed.data.amount, reason: parsed.data.reason, token: link.token },
    });
    if (booking.proposal_id) {
      const { data: proposalRow } = await supabase
        .from('proposals')
        .select('version')
        .eq('id', booking.proposal_id)
        .single();
      await supabase.from('proposal_acceptance_log').insert({
        proposal_id: booking.proposal_id,
        version: proposalRow?.version || 1,
        event_type: 'fare_difference_requested',
        metadata: { amount: parsed.data.amount, reason: parsed.data.reason, payment_link_token: link.token },
      });
    }
  }

  return NextResponse.json({ link });
}
