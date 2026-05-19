import { requireAuth } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ShareLinkClient } from '@/app/p/[share_token]/share-link-client';

/** Strip all cost-price fields before sending data to the client browser. */
function stripHotelCP(h: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cp_per_night, cwb_cp, cnb_cp, ...safe } = h;
  return safe;
}

function stripFlightCP(f: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cp_total, ...safe } = f;
  return safe;
}

export default async function ProposalPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single();

  if (!proposal) notFound();

  // Always use live DB data for preview (not published snapshot)
  const [
    { data: dbHotels },
    { data: dbFlights },
    { data: dbItineraryDays },
    { data: dbActivities },
    { data: dbLineItems },
  ] = await Promise.all([
    supabase.from('hotels').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('flights').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('itinerary_days').select('*').eq('proposal_id', id).order('day_number'),
    supabase.from('itinerary_activities').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('line_items').select('*').eq('proposal_id', id).order('sort_order'),
  ]);

  const safeHotels = (dbHotels || []).map(stripHotelCP);
  const safeFlights = (dbFlights || []).map(stripFlightCP);

  const [
    { data: versions },
    { data: client },
    { data: agent },
  ] = await Promise.all([
    supabase.from('proposal_versions').select('id, version, published_at').eq('proposal_id', id).order('version', { ascending: false }),
    proposal.client_id ? supabase.from('clients').select('full_name, email, phone').eq('id', proposal.client_id).single() : { data: null },
    proposal.created_by ? supabase.from('users').select('full_name, agency_name, whatsapp_number, logo_url, tc_content').eq('id', proposal.created_by).single() : { data: null },
  ]);

  return (
    <div>
      <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-center text-sm font-medium text-yellow-800">
        Preview Mode — This is how the client will see your proposal (using current draft data)
      </div>
      <ShareLinkClient
        proposal={proposal}
        hotels={safeHotels}
        flights={safeFlights}
        itineraryDays={dbItineraryDays || []}
        activities={dbActivities || []}
        lineItems={dbLineItems || []}
        versions={versions || []}
        client={client}
        agent={agent}
      />
    </div>
  );
}
