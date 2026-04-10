import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ShareLinkClient } from './share-link-client';

export default async function PublicProposalPage({ params }: { params: Promise<{ share_token: string }> }) {
  const { share_token } = await params;
  const supabase = createServiceClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('share_token', share_token)
    .single();

  if (!proposal) notFound();

  // Increment view count
  await supabase.from('proposals').update({
    view_count: (proposal.view_count || 0) + 1,
    last_viewed_at: new Date().toISOString(),
  }).eq('id', proposal.id);

  // Log view event
  await supabase.from('proposal_acceptance_log').insert({
    proposal_id: proposal.id,
    version: proposal.version,
    event_type: 'viewed',
  });

  // Fetch all data
  const [
    { data: hotels },
    { data: flights },
    { data: itineraryDays },
    { data: activities },
    { data: lineItems },
    { data: versions },
    { data: client },
    { data: agent },
  ] = await Promise.all([
    supabase.from('hotels').select('*').eq('proposal_id', proposal.id).order('sort_order'),
    supabase.from('flights').select('*').eq('proposal_id', proposal.id).order('sort_order'),
    supabase.from('itinerary_days').select('*').eq('proposal_id', proposal.id).order('day_number'),
    supabase.from('itinerary_activities').select('*').eq('proposal_id', proposal.id).order('sort_order'),
    supabase.from('line_items').select('*').eq('proposal_id', proposal.id).order('sort_order'),
    supabase.from('proposal_versions').select('id, version, published_at').eq('proposal_id', proposal.id).order('version', { ascending: false }),
    proposal.client_id ? supabase.from('clients').select('full_name, email, phone').eq('id', proposal.client_id).single() : { data: null },
    proposal.created_by ? supabase.from('users').select('full_name, agency_name, whatsapp_number, logo_url, tc_content').eq('id', proposal.created_by).single() : { data: null },
  ]);

  return (
    <ShareLinkClient
      proposal={proposal}
      hotels={hotels || []}
      flights={flights || []}
      itineraryDays={itineraryDays || []}
      activities={activities || []}
      lineItems={lineItems || []}
      versions={versions || []}
      client={client}
      agent={agent}
    />
  );
}
