// Client-side shapes for Builder v2 — mirror the v2 API payload.

import { computeV2Totals } from '@/lib/proposals/v2-pricing';

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
  /** 'per_person' → cost/sell are per pax; totals multiply by pax. */
  price_basis: 'total' | 'per_person';
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
  cover_image_url: string | null;
  pricing_display_mode: 'per_person' | 'total' | 'both';
  inclusions: string[];
  exclusions: string[];
  payment_terms_text: string | null;
  terms_conditions: string | null;
  special_notes: string | null;
}

/**
 * Hotel occupancy & policy, stored inside the stay item's details JSONB.
 * Counts cover the third-adult / child cases DMC quotes price separately:
 * EB (extra bed), CWB (child with bed), CNB (child no bed), and
 * children_free for hotels that let young kids stay complimentary.
 * Rates are per night, informational when the price sits in a group.
 */
export interface StayOccupancy {
  rooms?: number;
  extra_beds?: number;
  eb_rate?: number;
  cwb?: number;
  cwb_rate?: number;
  cnb?: number;
  cnb_rate?: number;
  children_free?: number;
  child_policy?: string;
  refundable?: boolean;
  free_cancellation_until?: string;
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
 * Sells rolled up via the shared v2 pricing module (also used by the save
 * route and publish snapshot). Flights priced separately are their own
 * subtotal with GST only on their markup; flights pulled into a group
 * (fixed-departure override) are part of the package price.
 */
export function rollupTotals(data: BuilderData) {
  const p = data.proposal;
  return computeV2Totals(data.groups, data.items, {
    pax: p.pax_adults + p.pax_children,
    gst_enabled: p.gst_enabled,
    gst_rate: p.gst_rate,
    tcs_enabled: p.tcs_enabled,
    tcs_rate: p.tcs_rate,
  });
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
