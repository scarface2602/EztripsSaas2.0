import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendShareLinkEmail } from '@/lib/email/mailer';

// Publish a Builder v2 proposal: freeze quoted costs, snapshot
// published_data in the share-page shape (sell side ONLY — cost/markup
// never leave the server), rotate the share token.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await withAuth(request, { checkOwnership: { table: 'proposals', id } });
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const [{ data: proposal }, { data: destinations }, { data: groups }, { data: items }] = await Promise.all([
    supabase.from('proposals').select('*').eq('id', id).single(),
    supabase.from('proposal_destinations').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('proposal_price_groups').select('*').eq('proposal_id', id).order('sort_order'),
    supabase.from('proposal_items').select('*').eq('proposal_id', id).order('sort_order'),
  ]);
  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.builder_version !== 2) {
    return NextResponse.json({ error: 'Not a builder v2 proposal' }, { status: 400 });
  }

  const dests = destinations ?? [];
  const allItems = items ?? [];
  const allGroups = groups ?? [];

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
  const destById = new Map(dests.map((d) => [d.id, d]));
  const hotels = allItems
    .filter((i) => i.item_type === 'hotel')
    .map((i, idx) => {
      const details = (i.details ?? {}) as Record<string, unknown>;
      return {
        id: i.id,
        name: i.title,
        city: i.destination_id ? destById.get(i.destination_id)?.city_name ?? '' : '',
        check_in: i.check_in,
        check_out: i.check_out,
        nights: i.nights,
        room_type: (details.room_type as string) ?? null,
        meal_plan: (details.meal_plan as string) ?? null,
        sort_order: idx,
      };
    });
  const lineItems = allItems
    .filter((i) => i.item_type !== 'hotel' && i.title.trim())
    .map((i, idx) => ({
      id: i.id,
      type: ['transfer', 'activity', 'visa'].includes(i.item_type) ? i.item_type : 'other',
      description: i.title,
      date: i.check_in,
      sp: i.price_group_id ? 0 : Number(i.sell_amount) || 0,
      is_included: true,
      is_optional: false,
      show_in_pdf: true,
      sort_order: idx,
    }));

  const totalSell =
    allGroups.reduce((s, g) => s + (Number(g.sell_amount) || 0), 0) +
    allItems.reduce((s, i) => s + (i.price_group_id ? 0 : Number(i.sell_amount) || 0), 0);

  const publishedData = {
    proposal: { ...proposal, draft_data: null },
    hotels,
    flights: [],
    itinerary_days: [],
    activities: [],
    line_items: lineItems,
    content_blocks: [],
    builder_v2: {
      destinations: dests.map((d) => ({ city_name: d.city_name, nights: d.nights, sort_order: d.sort_order })),
      // Sell side only — never cost_amount/markup.
      price_groups: allGroups.map((g) => ({ name: g.name, sell_amount: Number(g.sell_amount) || 0 })),
      total_sell: totalSell,
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
