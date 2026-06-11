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

export type TransferMode = 'SIC' | 'PVT' | 'NONE';
export type DayTypeDb = 'arrival' | 'tour' | 'transfer' | 'departure' | 'flight';
export type BlockType = 'transfer' | 'sightseeing' | 'meal' | 'activity' | 'free_time' | 'flight' | 'other';

/** One thing happening on a day — a tour, an internal flight, a transfer… */
export interface DayBlockRow {
  id: string;
  type: BlockType;
  title: string;
  description: string | null;
  transfer_mode: 'SIC' | 'PVT' | null;
  start_time: string | null; // HH:mm
  library_id: number | null; // activity_library link when picked from it
  sort_order: number;
}

export interface ItineraryDayRow {
  id: string;
  day_number: number;
  date: string | null;
  city: string | null;
  heading: string | null;
  description: string | null;
  day_type: DayTypeDb | null;
  transfer_mode: TransferMode | null;
  blocks: DayBlockRow[];
}

export interface BuilderData {
  proposal: ProposalCore;
  destinations: DestinationRow[];
  groups: PriceGroupRow[];
  items: ItemRow[];
  itinerary: ItineraryDayRow[];
}

export type DayType = 'arrival' | 'departure' | 'transfer' | 'tour';

/** Day n's type and city, derived from the cities-first route. */
export function dayMeta(destinations: DestinationRow[], dayNumber: number, totalDays: number) {
  const sorted = [...destinations].filter((d) => d.nights > 0).sort((a, b) => a.sort_order - b.sort_order);
  let acc = 0;
  let city = sorted[sorted.length - 1]?.city_name ?? null;
  let isCityChangeDay = false;
  for (const d of sorted) {
    if (dayNumber <= acc + d.nights) {
      city = d.city_name;
      isCityChangeDay = dayNumber === acc + 1 && acc > 0;
      break;
    }
    acc += d.nights;
  }
  const type: DayType =
    dayNumber === 1 ? 'arrival' : dayNumber >= totalDays ? 'departure' : isCityChangeDay ? 'transfer' : 'tour';
  return { city, type };
}

/**
 * Merge the route into the day list: day count = nights + 1, dates from
 * travel_start, cities mapped per day. Existing headings/descriptions are
 * preserved; only the derived fields (date, city, count) move.
 */
export function syncItinerarySkeleton(data: BuilderData): ItineraryDayRow[] | null {
  const totalNights = data.destinations.reduce((s, d) => s + d.nights, 0);
  if (totalNights === 0) return data.itinerary.length ? [] : null;
  const totalDays = totalNights + 1;
  const start = data.proposal.travel_start ? new Date(data.proposal.travel_start + 'T00:00:00Z') : null;

  const next: ItineraryDayRow[] = [];
  let changed = data.itinerary.length !== totalDays;
  for (let n = 1; n <= totalDays; n++) {
    const existing = data.itinerary[n - 1];
    const { city } = dayMeta(data.destinations, n, totalDays);
    const date = start ? new Date(start.getTime() + (n - 1) * 86400000).toISOString().slice(0, 10) : null;
    const { type } = dayMeta(data.destinations, n, totalDays);
    const row: ItineraryDayRow = existing
      ? { ...existing, day_number: n, date, city }
      : {
          id: crypto.randomUUID(),
          day_number: n,
          date,
          city,
          heading: null,
          description: null,
          day_type: type,
          transfer_mode: null,
          blocks: [],
        };
    if (!existing || existing.date !== date || existing.city !== city || existing.day_number !== n) changed = true;
    next.push(row);
  }
  return changed ? next : null;
}

export function computeSell(cost: number, type: 'percent' | 'flat', value: number): number {
  const sell = type === 'percent' ? cost * (1 + value / 100) : cost + value;
  return Math.round(sell * 100) / 100;
}

/**
 * Sells rolled up: groups + self-priced items. Flights are ALWAYS priced
 * separately (never inside a land/price group) and reported as their own
 * subtotal — the client must see land vs flights split.
 */
export function rollupTotals(data: BuilderData) {
  const groupSell = data.groups.reduce((s, g) => s + g.sell_amount, 0);
  const groupCost = data.groups.reduce((s, g) => s + g.cost_amount, 0);
  const selfItems = data.items.filter((i) => !i.price_group_id && i.sell_amount != null);
  const flightItems = selfItems.filter((i) => i.item_type === 'flight');
  const otherItems = selfItems.filter((i) => i.item_type !== 'flight');
  const flightSell = flightItems.reduce((s, i) => s + (i.sell_amount ?? 0), 0);
  const flightCost = flightItems.reduce((s, i) => s + (i.cost_amount ?? 0), 0);
  const landSell = groupSell + otherItems.reduce((s, i) => s + (i.sell_amount ?? 0), 0);
  const landCost = groupCost + otherItems.reduce((s, i) => s + (i.cost_amount ?? 0), 0);
  const sell = landSell + flightSell;
  const cost = landCost + flightCost;
  const p = data.proposal;
  // GST on the package value; TCS (LRS) on the GST-inclusive amount —
  // same rule as the PDF and share page.
  const gst = p.gst_enabled ? (sell * p.gst_rate) / 100 : 0;
  const tcs = p.tcs_enabled ? ((sell + gst) * p.tcs_rate) / 100 : 0;
  const grand = sell + gst + tcs;
  const pax = p.pax_adults + p.pax_children;
  return {
    cost, sell, gst, tcs, grand,
    landSell, flightSell,
    margin: sell - cost,
    perPerson: pax > 0 ? grand / pax : null,
  };
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
