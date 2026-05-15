import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { sendShareLinkEmail } from '@/lib/email/mailer';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get current proposal
  const { data: proposal, error: proposalErr } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single();

  if (proposalErr || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  // Build snapshot of current state
  const [
    { data: hotels },
    { data: flights },
    { data: itineraryDays },
    { data: activities },
    { data: lineItems },
    { data: contentBlocks },
  ] = await Promise.all([
    supabase.from('hotels').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('flights').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('itinerary_days').select('*').eq('proposal_id', id).order('day_number'),
    supabase.from('itinerary_activities').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('line_items').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('proposal_content_blocks').select('*').eq('proposal_id', id).order('sort_order'),
  ]);

  const snapshot = {
    proposal: { ...proposal },
    hotels: hotels || [],
    flights: flights || [],
    itinerary_days: itineraryDays || [],
    activities: activities || [],
    line_items: lineItems || [],
    content_blocks: contentBlocks || [],
  };

  // If already published, snapshot current published_data to proposal_versions
  if (proposal.published_data) {
    await supabase.from('proposal_versions').insert({
      proposal_id: id,
      version: proposal.version || 1,
      snapshot: proposal.published_data,
      published_by: authUser.id,
    });
  }

  // Build new published_data from the fresh DB snapshot.
  // Never use draft_data here — it uses camelCase keys and may be incomplete.
  const publishedData = snapshot;

  // Generate new share_token
  const shareToken = crypto.randomBytes(16).toString('hex');

  // Calculate TTL resets
  const now = new Date();
  const flightExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24h
  const landExpiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days

  // Promote: increment version, set published_data, new share_token, reset TTL
  const newVersion = (proposal.version || 1) + (proposal.published_data ? 1 : 0);
  const { error: updateErr } = await supabase
    .from('proposals')
    .update({
      published_data: publishedData,
      draft_data: null,
      draft_differs_from_published: false,
      share_token: shareToken,
      version: newVersion,
      status: 'sent',
      flight_expires_at: flightExpiry,
      land_expires_at: landExpiry,
      updated_at: now.toISOString(),
    })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to publish', details: updateErr.message }, { status: 500 });
  }

  // If proposal was created from an enquiry, mark it as 'proposal_sent' now
  if (proposal.enquiry_id) {
    await supabase
      .from('enquiries')
      .update({ status: 'proposal_sent', updated_at: now.toISOString() })
      .eq('id', proposal.enquiry_id);
  }

  // Send share link email to client (fire-and-forget — don't block the response)
  try {
    const [{ data: clientData }, { data: agentData }] = await Promise.all([
      proposal.client_id
        ? supabase.from('clients').select('full_name, email').eq('id', proposal.client_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('users').select('full_name, agency_name').eq('id', authUser.id).single(),
    ]);
    if (clientData?.email) {
      await sendShareLinkEmail({
        to: clientData.email,
        clientName: clientData.full_name || 'Valued Client',
        agentName: agentData?.full_name || '',
        agencyName: agentData?.agency_name || '',
        proposalTitle: proposal.title || 'Travel Proposal',
        destination: proposal.destination || '',
        shareUrl: `/p/${shareToken}`,
      });
    }
  } catch {
    // Email failure should not block the publish response
  }

  return NextResponse.json({
    success: true,
    version: newVersion,
    share_token: shareToken,
    share_url: `/p/${shareToken}`,
    flight_expires_at: flightExpiry,
    land_expires_at: landExpiry,
  });
}
