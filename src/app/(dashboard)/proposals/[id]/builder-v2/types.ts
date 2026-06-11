// Client-side shapes for Builder v2 — mirror the v2 API payload.

export interface DestinationRow {
  id: string;
  city_id: number | null;
  city_name: string;
  country_code: string | null;
  nights: number;
  sort_order: number;
}

export interface PriceGroupRow {
  id: string;
  name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  cost_amount: number;
  markup_type: 'percent' | 'flat';
  markup_value: number;
  sell_amount: number;
  sort_order: number;
}

export type ItemType = 'hotel' | 'flight' | 'transfer' | 'activity' | 'visa' | 'other';

export interface ItemRow {
  id: string;
  destination_id: string | null;
  price_group_id: string | null;
  item_type: ItemType;
  title: string;
  details: Record<string, unknown>;
  hotel_directory_id: number | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  source: 'manual' | 'directory' | 'api';
  provider: string | null;
  provider_ref: string | null;
  cost_amount: number | null;
  sell_amount: number | null;
  sort_order: number;
}

export interface ProposalCore {
  title: string | null;
  client_id: string | null;
  destination: string | null;
  travel_start: string | null;
  travel_end: string | null;
  pax_adults: number;
  pax_children: number;
  currency: string;
  gst_enabled: boolean;
  gst_rate: number;
  tcs_enabled: boolean;
  tcs_rate: number;
  special_notes: string | null;
}

export interface BuilderData {
  proposal: ProposalCore;
  destinations: DestinationRow[];
  groups: PriceGroupRow[];
  items: ItemRow[];
}

export function computeSell(cost: number, type: 'percent' | 'flat', value: number): number {
  const sell = type === 'percent' ? cost * (1 + value / 100) : cost + value;
  return Math.round(sell * 100) / 100;
}

/** Sells rolled up: groups + self-priced items (no group). */
export function rollupTotals(data: BuilderData) {
  const groupSell = data.groups.reduce((s, g) => s + g.sell_amount, 0);
  const groupCost = data.groups.reduce((s, g) => s + g.cost_amount, 0);
  const selfItems = data.items.filter((i) => !i.price_group_id && i.sell_amount != null);
  const itemSell = selfItems.reduce((s, i) => s + (i.sell_amount ?? 0), 0);
  const itemCost = selfItems.reduce((s, i) => s + (i.cost_amount ?? 0), 0);
  const sell = groupSell + itemSell;
  const cost = groupCost + itemCost;
  const p = data.proposal;
  const gst = p.gst_enabled ? (sell * p.gst_rate) / 100 : 0;
  const tcs = p.tcs_enabled ? (sell * p.tcs_rate) / 100 : 0;
  const grand = sell + gst + tcs;
  const pax = p.pax_adults + p.pax_children;
  return { cost, sell, gst, tcs, grand, margin: sell - cost, perPerson: pax > 0 ? grand / pax : null };
}

/** Stay date ranges derived from travel_start + cumulative nights. */
export function destinationDates(destinations: DestinationRow[], travelStart: string | null) {
  const out = new Map<string, { checkIn: string | null; checkOut: string | null }>();
  let cursor = travelStart ? new Date(travelStart + 'T00:00:00Z') : null;
  for (const d of [...destinations].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!cursor || d.nights <= 0) {
      out.set(d.id, { checkIn: null, checkOut: null });
      continue;
    }
    const checkIn = cursor.toISOString().slice(0, 10);
    cursor = new Date(cursor.getTime() + d.nights * 86400000);
    out.set(d.id, { checkIn, checkOut: cursor.toISOString().slice(0, 10) });
  }
  return out;
}
