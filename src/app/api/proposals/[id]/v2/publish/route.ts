import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendShareLinkEmail } from '@/lib/email/mailer';
import { blocksForDay } from '@/lib/proposals/v2-blocks';
import { buildV2Snapshot } from '@/lib/proposals/v2-snapshot';
import { effectiveGroupAmounts } from '@/lib/proposals/v2-pricing';

// Publish a Builder v2 proposal: freeze quoted costs, snapshot
// published_data in the share-page shape (sell side ONLY — cost/markup
// never leave the server), rotate the share token.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await withAuth(request, { checkOwnership: { table: 'proposals', id } });
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const [{ data: proposal }, { data: itineraryDays }, { data: dayBlocks }] = await Promise.all([
    supabase.from('proposals').select('*').eq('id', id).single(),
    supabase.from('itinerary_days').select('*').eq('proposal_id', id).order('day_number'),
    supabase.from('itinerary_activities').select('*').eq('proposal_id', id).order('sort_order'),
  ]);
  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.builder_version !== 2) {
    return NextResponse.json({ error: 'Not a builder v2 proposal' }, { status: 400 });
  }

  // Same v2 → legacy-shape mapping the PDF uses — one source of truth.
  const snap = await buildV2Snapshot(supabase, id);
  const dests = snap.destinations;
  const allItems = snap.items;
  const allGroups = snap.groups;

  // First publish freezes the quoted baseline (quoted-vs-actual chip in ops).
  await Promise.all([
    ...allGroups.filter((g) => g.quoted_cost == null).map((g) =>
      supabase.from('proposal_price_groups').update({ quoted_cost: g.cost_amount }).eq('id', g.id),
    ),
    ...allItems
      .filter((i) => !i.price_group_id && i.cost_amount != null && i.quoted_cost == null)
      .map((i) => supabase.from('proposal_items').update({ quoted_cost: i.cost_amount }).eq('id', i.id)),
  ]);

  // ── Snapshot in the shape the share page / PDF already render ──
  const { hotels, flights, lineItems, flightSell, totalSell } = snap;

  const publishedData = {
    proposal: { ...proposal, draft_data: null },
    hotels,
    flights,
    itinerary_days: (itineraryDays ?? []).map((d) => ({
      id: d.id,
      day_number: d.day_number,
      date: d.date,
      city: d.city,
      heading: d.heading,
      description: d.description,
      day_type: d.day_type,
      transfer_mode: d.transfer_mode,
      blocks: blocksForDay(dayBlocks ?? [], d.id),
    })),
    activities: [],
    line_items: lineItems,
    content_blocks: [],
    builder_v2: {
      destinations: dests.map((d) => ({ city_name: d.city_name, nights: d.nights, sort_order: d.sort_order })),
      // Sell side only — never cost_amount/markup. Per-person groups
      // publish their effective total.
      price_groups: allGroups.map((g) => ({
        name: g.name,
        sell_amount: effectiveGroupAmounts(g, (Number(proposal.pax_adults) || 0) + (Number(proposal.pax_children) || 0)).sell,
      })),
      land_sell: snap.totals.landSell,
      flight_sell: flightSell,
      total_sell: totalSell,
      // Derived taxes: flight GST is 18% of the flight markup (zero for
      // reimbursements); published as one number, shown merged into the
      // GST line so the markup itself is never disclosed.
      gst_amount: snap.totals.gst,
      flight_gst: snap.totals.flightGst,
      flights_bundled: snap.totals.flightsBundled,
      per_person: snap.totals.perPerson,
    },
  };

  if (proposal.published_data) {
    await supabase.from('proposal_versions').insert({
      proposal_id: id,
      version: proposal.version || 1,
      snapshot: proposal.published_data,
      published_by: auth.user.id,
    });
  }

  const shareToken = crypto.randomBytes(16).toString('hex');
  const now = new Date();
  const citiesVisited = dests.map((d) => d.city_name);
  const routeSignature = dests.filter((d) => d.nights > 0).map((d) => `${d.city_name}:${d.nights}`).join(',') || null;
  const newVersion = (proposal.version || 1) + (proposal.published_data ? 1 : 0);

  const { error: updateErr } = await supabase
    .from('proposals')
    .update({
      published_data: publishedData,
      draft_differs_from_published: false,
      share_token: shareToken,
      version: newVersion,
      status: 'sent',
      total_sp: totalSell,
      land_expires_at: new Date(now.getTime() + 14 * 86400000).toISOString(),
      cities_visited: citiesVisited,
      route_signature: routeSignature,
      updated_at: now.toISOString(),
    })
    .eq('id', id);
  if (updateErr) {
    return NextResponse.json({ error: 'Failed to publish', details: updateErr.message }, { status: 500 });
  }

  if (proposal.enquiry_id) {
    await supabase
      .from('website_enquiries')
      .update({ status: 'proposal_sent', updated_at: now.toISOString() })
      .eq('id', proposal.enquiry_id);
  }

  // Fire-and-forget share email, same as v1 publish.
  try {
    const [{ data: clientData }, { data: agentData }] = await Promise.all([
      proposal.client_id
        ? supabase.from('clients').select('full_name, email').eq('id', proposal.client_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('users').select('full_name, agency_name').eq('id', auth.user.id).single(),
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
  });
}
