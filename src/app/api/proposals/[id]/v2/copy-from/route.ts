import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/with-auth';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/proposals/[id]/v2/copy-from { source_id }
//
// The reusable-itinerary engine for Builder v2: copies a past proposal's
// content INTO the current draft (route, stays, items, price-group
// names, day-wise itinerary with blocks). Works from both v2 sources
// and legacy v1 sources (mapped via trip_cities/hotels/itinerary_days).
// Costs and client details are NOT copied — structure and content only.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await withAuth(request, { checkOwnership: { table: 'proposals', id } });
  if (auth instanceof NextResponse) return auth;

  const body = z.object({ source_id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'source_id required' }, { status: 400 });
  const sourceId = body.data.source_id;

  const supabase = createServiceClient();
  const { data: source } = await supabase.from('proposals').select('*').eq('id', sourceId).single();
  if (!source) return NextResponse.json({ error: 'Source proposal not found' }, { status: 404 });

  // Wipe current draft content (not the proposal row itself).
  for (const table of ['itinerary_activities', 'itinerary_days', 'proposal_items', 'proposal_price_groups', 'proposal_destinations']) {
    await supabase.from(table).delete().eq('proposal_id', id);
  }

  const idMap = new Map<string, string>();
  const remap = (oldId: string | null) => (oldId ? idMap.get(oldId) ?? null : null);
  const fresh = (oldId: string) => {
    const next = crypto.randomUUID();
    idMap.set(oldId, next);
    return next;
  };

  if (source.builder_version === 2) {
    const [{ data: dests }, { data: groups }, { data: items }, { data: days }, { data: blocks }] = await Promise.all([
      supabase.from('proposal_destinations').select('*').eq('proposal_id', sourceId).order('sort_order'),
      supabase.from('proposal_price_groups').select('*').eq('proposal_id', sourceId).order('sort_order'),
      supabase.from('proposal_items').select('*').eq('proposal_id', sourceId).order('sort_order'),
      supabase.from('itinerary_days').select('*').eq('proposal_id', sourceId).order('day_number'),
      supabase.from('itinerary_activities').select('*').eq('proposal_id', sourceId).order('sort_order'),
    ]);

    if (dests?.length) {
      await supabase.from('proposal_destinations').insert(
        dests.map((d) => ({ ...d, id: fresh(d.id), proposal_id: id, created_at: undefined })),
      );
    }
    if (groups?.length) {
      await supabase.from('proposal_price_groups').insert(
        groups.map((g) => ({
          ...g,
          id: fresh(g.id),
          proposal_id: id,
          // structure copied, money reset — this is a new quote
          cost_amount: 0,
          sell_amount: 0,
          quoted_cost: null,
          created_at: undefined,
        })),
      );
    }
    if (items?.length) {
      await supabase.from('proposal_items').insert(
        items.map((i) => ({
          ...i,
          id: fresh(i.id),
          proposal_id: id,
          destination_id: remap(i.destination_id),
          price_group_id: remap(i.price_group_id),
          cost_amount: null,
          sell_amount: null,
          quoted_cost: null,
          created_at: undefined,
          updated_at: undefined,
        })),
      );
    }
    if (days?.length) {
      await supabase.from('itinerary_days').insert(
        days.map((d) => ({ ...d, id: fresh(d.id), proposal_id: id, date: null, created_at: undefined })),
      );
    }
    if (blocks?.length) {
      await supabase.from('itinerary_activities').insert(
        blocks.map((b) => ({
          ...b,
          id: crypto.randomUUID(),
          proposal_id: id,
          itinerary_day_id: remap(b.itinerary_day_id),
          created_at: undefined,
        })),
      );
    }
  } else {
    // Legacy v1 source: map trip_cities → destinations, hotels → stay
    // items, itinerary_days (+activities) → v2 days with blocks.
    const [{ data: hotels }, { data: days }, { data: acts }] = await Promise.all([
      supabase.from('hotels').select('*').eq('proposal_id', sourceId).order('sort_order'),
      supabase.from('itinerary_days').select('*').eq('proposal_id', sourceId).order('day_number'),
      supabase.from('itinerary_activities').select('*').eq('proposal_id', sourceId).order('sort_order'),
    ]);

    const tripCities = (source.trip_cities as Array<{ city: string; nights: number }> | null) ?? [];
    const destRows = tripCities.map((tc, i) => ({
      id: crypto.randomUUID(),
      proposal_id: id,
      city_id: null,
      city_name: tc.city,
      country_code: null,
      nights: tc.nights || 1,
      sort_order: i,
    }));
    if (destRows.length) await supabase.from('proposal_destinations').insert(destRows);
    const destByCity = new Map(destRows.map((d) => [d.city_name.toLowerCase(), d.id]));

    if (hotels?.length) {
      await supabase.from('proposal_items').insert(
        hotels.map((h, i) => ({
          id: crypto.randomUUID(),
          proposal_id: id,
          destination_id: destByCity.get((h.city ?? '').toLowerCase()) ?? null,
          item_type: 'hotel',
          title: h.name,
          details: { room_type: h.room_type, meal_plan: h.meal_plan },
          source: 'manual',
          sort_order: i,
        })),
      );
    }
    if (days?.length) {
      const dayRows = days.map((d) => ({
        id: fresh(d.id),
        proposal_id: id,
        day_number: d.day_number,
        date: null,
        city: d.city,
        heading: d.heading,
        description: d.description,
        day_type: d.day_type,
      }));
      await supabase.from('itinerary_days').insert(dayRows);
      if (acts?.length) {
        await supabase.from('itinerary_activities').insert(
          acts
            .filter((a) => remap(a.itinerary_day_id))
            .map((a) => ({
              ...a,
              id: crypto.randomUUID(),
              proposal_id: id,
              itinerary_day_id: remap(a.itinerary_day_id),
              created_at: undefined,
            })),
        );
      }
    }
  }

  // Copy trip-shape fields onto the draft (client/dates stay untouched).
  await supabase
    .from('proposals')
    .update({
      destination: source.destination,
      title: source.title ? `${source.title} (copy)` : undefined,
      builder_version: 2,
    })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
