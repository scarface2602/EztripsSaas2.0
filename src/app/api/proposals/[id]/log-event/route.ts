import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const ALLOWED_EVENTS = ['tc_accepted', 'visa_acknowledged', 'addon_selected', 'tier_selected'] as const;
type AllowedEvent = typeof ALLOWED_EVENTS[number];

/**
 * Public (unauthenticated) endpoint for logging client-side acceptance events.
 * Looks up proposal by share_token or UUID.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const body = await request.json();
  const eventType: AllowedEvent = body.event_type;

  if (!ALLOWED_EVENTS.includes(eventType)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
  }

  // id may be UUID or share_token
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, version')
    .eq(isUUID ? 'id' : 'share_token', id)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  await supabase.from('proposal_acceptance_log').insert({
    proposal_id: proposal.id,
    version: proposal.version || 1,
    event_type: eventType,
    ip_address: ip,
    user_agent: userAgent,
    metadata: body.metadata || null,
  });

  return NextResponse.json({ success: true });
}
