import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Public GET — fetch proposal by share_token for passenger details page.
 * Returns only safe fields (no cost prices).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { share_token: string } }
) {
  const supabase = createServiceClient();
  const { share_token } = params;

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('id, share_token, status, pax_adults, pax_children, children_ages, destination, travel_start, travel_end, passenger_details, client_id')
    .eq('share_token', share_token)
    .in('status', ['published', 'confirmed'])
    .single();

  if (error || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  // Fetch flights to determine international vs domestic
  const snap = await supabase
    .from('proposals')
    .select('published_data')
    .eq('id', proposal.id)
    .single();

  const published = snap.data?.published_data as Record<string, unknown> | null;
  let flights: { origin_iata?: string; destination_iata?: string }[] = [];

  if (published && Array.isArray(published.flights)) {
    flights = (published.flights as { origin_iata?: string; destination_iata?: string }[]).map(f => ({
      origin_iata: f.origin_iata,
      destination_iata: f.destination_iata,
    }));
  } else {
    const { data: dbFlights } = await supabase
      .from('flights')
      .select('origin_iata, destination_iata')
      .eq('proposal_id', proposal.id);
    flights = dbFlights || [];
  }

  // Fetch client name to pre-populate lead passenger
  let client: { name?: string } | null = null;
  if (proposal.client_id) {
    const { data: c } = await supabase
      .from('clients')
      .select('name')
      .eq('id', proposal.client_id)
      .single();
    client = c;
  }

  return NextResponse.json({
    ...proposal,
    flights,
    client,
  });
}
