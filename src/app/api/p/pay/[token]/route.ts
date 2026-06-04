import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Look up payment link
  const { data: link, error } = await supabase
    .from('payment_links')
    .select('id, token, amount, currency, label, status, booking_id')
    .eq('token', token)
    .single();

  if (error || !link) {
    return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  }

  if (link.status !== 'active') {
    return NextResponse.json({ error: `This payment link has been ${link.status}` }, { status: 400 });
  }

  // Get booking to find proposal share_token and pax counts
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, proposal_id')
    .eq('id', link.booking_id)
    .single();

  let shareToken: string | null = null;
  let paxAdults = 1;
  let paxChildren = 0;

  if (booking?.proposal_id) {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('share_token, pax_adults, pax_children')
      .eq('id', booking.proposal_id)
      .single();

    if (proposal) {
      shareToken = proposal.share_token;
      paxAdults = proposal.pax_adults || 1;
      paxChildren = proposal.pax_children || 0;
    }
  }

  return NextResponse.json({
    id: link.id,
    token: link.token,
    amount: link.amount,
    currency: link.currency,
    label: link.label,
    status: link.status,
    booking_id: link.booking_id,
    share_token: shareToken,
    pax_adults: paxAdults,
    pax_children: paxChildren,
  });
}
