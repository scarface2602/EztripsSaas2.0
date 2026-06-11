// Builder v2 → legacy-snapshot mapping, shared by the publish route and
// the PDF generator so both render v2 proposals through the existing
// templates. Sell side only — cost/markup never leave the server.

import type { createServiceClient } from '@/lib/supabase/server';
import { computeV2Totals, effectiveItemAmounts } from './v2-pricing';

interface StayOccupancyDetails {
  rooms?: number;
  extra_beds?: number;
  cwb?: number;
  cnb?: number;
  children_free?: number;
  child_policy?: string;
  refundable?: boolean;
  free_cancellation_until?: string;
}

/** "2 rooms · 1 EB · 1 child free" — client-facing, rates stay internal. */
export function occupancySummary(d: StayOccupancyDetails): string | null {
  const parts = [
    d.rooms ? `${d.rooms} room${d.rooms > 1 ? 's' : ''}` : null,
    d.extra_beds ? `${d.extra_beds} extra bed${d.extra_beds > 1 ? 's' : ''}` : null,
    d.cwb ? `${d.cwb} child${d.cwb > 1 ? 'ren' : ''} with bed` : null,
    d.cnb ? `${d.cnb} child${d.cnb > 1 ? 'ren' : ''} without bed` : null,
    d.children_free ? `${d.children_free} child${d.children_free > 1 ? 'ren' : ''} free` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function policyNote(d: StayOccupancyDetails): string | null {
  const parts = [
    d.refundable === false ? 'Non-refundable' : null,
    d.refundable === true && d.free_cancellation_until ? `Free cancellation until ${d.free_cancellation_until}` : null,
    d.child_policy?.trim() || null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export async function buildV2Snapshot(
  supabase: ReturnType<typeof createServiceClient>,
  proposalId: string,
) {
  const [{ data: proposal }, { data: destinations }, { data: groups }, { data: items }] = await Promise.all([
    supabase.from('proposals').select('*').eq('id', proposalId).single(),
    supabase.from('proposal_destinations').select('*').eq('proposal_id', proposalId).order('sort_order'),
    supabase.from('proposal_price_groups').select('*').eq('proposal_id', proposalId).order('sort_order'),
    supabase.from('proposal_items').select('*').eq('proposal_id', proposalId).order('sort_order'),
  ]);

  const dests = destinations ?? [];
  const allItems = items ?? [];
  const allGroups = groups ?? [];
  const destById = new Map(dests.map((d) => [d.id, d]));
  const pax = (Number(proposal?.pax_adults) || 0) + (Number(proposal?.pax_children) || 0);

  const hotels = allItems
    .filter((i) => i.item_type === 'hotel')
    .map((i, idx) => {
      const details = (i.details ?? {}) as Record<string, unknown> & StayOccupancyDetails;
      return {
        id: i.id,
        name: i.title,
        city: i.destination_id ? destById.get(i.destination_id)?.city_name ?? '' : '',
        check_in: i.check_in,
        check_out: i.check_out,
        nights: i.nights,
        room_type: (details.room_type as string) ?? null,
        meal_plan: (details.meal_plan as string) ?? null,
        occupancy: occupancySummary(details),
        policy_note: policyNote(details),
        is_non_refundable: details.refundable === false,
        refundable_known: details.refundable !== undefined, // hides the badge when the agent never set it
        sort_order: idx,
      };
    });

  const flights = allItems
    .filter((i) => i.item_type === 'flight')
    .map((i, idx) => {
      const d = (i.details ?? {}) as Record<string, unknown>;
      // Grouped flights (fixed departure) are priced inside their group.
      const sell = i.price_group_id ? 0 : effectiveItemAmounts(i, pax).sell ?? 0;
      const perPax = !i.price_group_id && d.price_basis === 'per_pax' ? Number(i.sell_amount) || 0 : null;
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
        sp_total: sell,
        sp_per_pax: perPax,
        in_package: !!i.price_group_id,
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

  // Derived taxes — land rate on land, 18% on separate-flight markup only,
  // zero on reimbursements; bundled flights ride the package rate.
  const totals = computeV2Totals(allGroups, allItems, {
    pax,
    gst_enabled: proposal?.gst_enabled === true,
    gst_rate: Number(proposal?.gst_rate) || 0,
    tcs_enabled: proposal?.tcs_enabled === true,
    tcs_rate: Number(proposal?.tcs_rate) || 0,
  });

  return {
    proposal,
    destinations: dests,
    groups: allGroups,
    items: allItems,
    hotels,
    flights,
    lineItems,
    totals,
    flightSell: totals.flightSell,
    totalSell: totals.sell,
  };
}
