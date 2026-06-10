import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ShareLinkClient } from './share-link-client';

/** SECURITY: Recursively strip all cost-price / internal-cost keys from any object or array. */
const CP_KEY_PATTERNS = [/^cp$/i, /cp_/i, /_cp$/i, /cost_price/i, /internal_cost/i, /^cp_per_night$/i, /^cp_total$/i];

function isCpKey(key: string): boolean {
  return CP_KEY_PATTERNS.some((rx) => rx.test(key));
}

function stripCpFields(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripCpFields);
  if (obj !== null && typeof obj === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (isCpKey(key)) continue;
      clean[key] = stripCpFields(value);
    }
    return clean;
  }
  return obj;
}

export default async function PublicProposalPage({ params }: { params: Promise<{ share_token: string }> }) {
  const { share_token } = await params;
  const supabase = createServiceClient();

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('share_token', share_token)
    .single();

  if (!proposal) notFound();

  // Increment view count and log
  await supabase.from('proposals').update({
    view_count: (proposal.view_count || 0) + 1,
    last_viewed_at: new Date().toISOString(),
  }).eq('id', proposal.id);

  await supabase.from('proposal_acceptance_log').insert({
    proposal_id: proposal.id,
    version: proposal.version,
    event_type: 'viewed',
  });

  // --- Resolve hotels/flights/itinerary from published_data snapshot ---
  // published_data is the frozen snapshot created at publish time (snake_case keys).
  // We prefer this over live DB so clients never see unpublished draft changes.
  const snap = proposal.published_data as Record<string, unknown> | null;
  const hasSnapshot = !!snap && Array.isArray(snap.hotels);

  let hotels: Record<string, unknown>[] = [];
  let flights: Record<string, unknown>[] = [];
  let itineraryDays: Record<string, unknown>[] = [];
  let activities: Record<string, unknown>[] = [];
  let lineItems: Record<string, unknown>[] = [];

  if (hasSnapshot) {
    // Use the frozen published snapshot — never shows draft changes
    hotels = (snap.hotels as Record<string, unknown>[]) || [];
    flights = (snap.flights as Record<string, unknown>[]) || [];
    // Handle both snake_case (snapshot) and camelCase (legacy draft_data keys)
    itineraryDays = ((snap.itinerary_days || snap.itineraryDays) as Record<string, unknown>[]) || [];
    activities = (snap.activities as Record<string, unknown>[]) || [];
    lineItems = ((snap.line_items || snap.lineItems) as Record<string, unknown>[]) || [];
  } else {
    // Fallback: live DB (for proposals published before snapshot logic was in place)
    const [
      { data: dbHotels },
      { data: dbFlights },
      { data: dbItineraryDays },
      { data: dbActivities },
      { data: dbLineItems },
    ] = await Promise.all([
      supabase.from('hotels').select('*').eq('proposal_id', proposal.id).order('sort_order'),
      supabase.from('flights').select('*').eq('proposal_id', proposal.id).order('sort_order'),
      supabase.from('itinerary_days').select('*').eq('proposal_id', proposal.id).order('day_number'),
      supabase.from('itinerary_activities').select('*').eq('proposal_id', proposal.id).order('sort_order'),
      supabase.from('line_items').select('*').eq('proposal_id', proposal.id).order('sort_order'),
    ]);
    hotels = (dbHotels as Record<string, unknown>[]) || [];
    flights = (dbFlights as Record<string, unknown>[]) || [];
    itineraryDays = (dbItineraryDays as Record<string, unknown>[]) || [];
    activities = (dbActivities as Record<string, unknown>[]) || [];
    lineItems = (dbLineItems as Record<string, unknown>[]) || [];
  }

  // --- Strip CP fields (SECURITY: cost prices must never reach the client browser) ---
  const safeHotels = stripCpFields(hotels) as Record<string, unknown>[];
  const safeFlights = stripCpFields(flights) as Record<string, unknown>[];
  const safeActivities = stripCpFields(activities) as Record<string, unknown>[];
  const safeLineItems = stripCpFields(lineItems) as Record<string, unknown>[];

  // --- Client and agent info always read from live DB (not stored in snapshot) ---
  const [
    { data: versions },
    { data: client },
    { data: agent },
  ] = await Promise.all([
    supabase.from('proposal_versions').select('id, version, published_at').eq('proposal_id', proposal.id).order('version', { ascending: false }),
    proposal.client_id ? supabase.from('clients').select('full_name, email, phone').eq('id', proposal.client_id).single() : { data: null },
    proposal.created_by ? supabase.from('users').select('full_name, agency_name, whatsapp_number, logo_url, tc_content').eq('id', proposal.created_by).single() : { data: null },
  ]);

  return (
    <ShareLinkClient
      proposal={proposal}
      hotels={safeHotels}
      flights={safeFlights}
      itineraryDays={itineraryDays}
      activities={safeActivities}
      lineItems={safeLineItems}
      versions={versions || []}
      client={client}
      agent={agent}
    />
  );
}
