// Builder v2 → legacy-snapshot mapping, shared by the publish route and
// the PDF generator so both render v2 proposals through the existing
// templates. Sell side only — cost/markup never leave the server.

import type { createServiceClient } from '@/lib/supabase/server';

export async function buildV2Snapshot(
  supabase: ReturnType<typeof createServiceClient>,
  proposalId: string,
) {
  const [{ data: destinations }, { data: groups }, { data: items }] = await Promise.all([
    supabase.from('proposal_destinations').select('*').eq('proposal_id', proposalId).order('sort_order'),
    supabase.from('proposal_price_groups').select('*').eq('proposal_id', proposalId).order('sort_order'),
    supabase.from('proposal_items').select('*').eq('proposal_id', proposalId).order('sort_order'),
  ]);

  const dests = destinations ?? [];
  const allItems = items ?? [];
  const allGroups = groups ?? [];
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

  const flights = allItems
    .filter((i) => i.item_type === 'flight')
    .map((i, idx) => {
      const d = (i.details ?? {}) as Record<string, unknown>;
      return {
        id: i.id,
        flight_number: (d.flight_number as string) ?? i.title,
        airline: (d.airline as string) ?? null,
        origin_iata: (d.origin as string) ?? null,
        destination_iata: (d.destination as string) ?? null,
        departure_at: (d.depart_at as string) ?? null,
        arrival_at: (d.arrive_at as string) ?? null,
        cabin_class: (d.fare_type as string) ?? null,
        baggage_allowance: (d.baggage as string) ?? null,
        duration: (d.duration as string) ?? null,
        layover: (d.layover as string) ?? null,
        operated_by: (d.operated_by as string) ?? null,
        sp_total: Number(i.sell_amount) || 0,
        sort_order: idx,
      };
    });

  const lineItems = allItems
    .filter((i) => i.item_type !== 'hotel' && i.item_type !== 'flight' && i.title.trim())
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

  const flightSell = flights.reduce((s, f) => s + f.sp_total, 0);
  const totalSell =
    allGroups.reduce((s, g) => s + (Number(g.sell_amount) || 0), 0) +
    allItems.reduce((s, i) => s + (i.price_group_id ? 0 : Number(i.sell_amount) || 0), 0);

  return { destinations: dests, groups: allGroups, items: allItems, hotels, flights, lineItems, flightSell, totalSell };
}
