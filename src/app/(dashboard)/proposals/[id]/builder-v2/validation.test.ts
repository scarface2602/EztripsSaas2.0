import { describe, it, expect } from 'vitest';
import { buildWarnings } from './validation';
import type { BuilderData, ItemRow } from './types';

const flight = (over: Partial<ItemRow> & { details?: Record<string, unknown> }): ItemRow => ({
  id: over.id ?? 'f1',
  destination_id: null,
  price_group_id: null,
  item_type: 'flight',
  title: over.title ?? 'Test flight',
  details: over.details ?? {},
  hotel_directory_id: null,
  check_in: null,
  check_out: null,
  nights: null,
  source: 'manual',
  provider: null,
  provider_ref: null,
  cost_amount: null,
  sell_amount: null,
  sort_order: 0,
  ...over,
});

const base = (): BuilderData => ({
  proposal: {
    title: 'Bali Trip',
    client_id: null,
    destination: '6N Bali',
    travel_start: '2099-06-15',
    travel_end: '2099-06-21',
    pax_adults: 2,
    pax_children: 0,
    currency: 'INR',
    gst_enabled: false,
    gst_rate: 5,
    tcs_enabled: false,
    tcs_rate: 5,
    special_notes: null,
  },
  destinations: [
    { id: 'd1', city_id: 1, city_name: 'Seminyak', country_code: 'ID', nights: 3, sort_order: 0 },
    { id: 'd2', city_id: 2, city_name: 'Ubud', country_code: 'ID', nights: 3, sort_order: 1 },
  ],
  groups: [],
  items: [],
  itinerary: [],
});

describe('buildWarnings', () => {
  it('is quiet for a clean proposal', () => {
    expect(buildWarnings(base())).toEqual([]);
  });

  it('flags a flight to a country outside the trip (Bali trip, Bangkok flight)', () => {
    const d = base();
    d.items = [flight({ title: 'DEL → BKK', details: { origin: 'DEL', destination: 'BKK' } })];
    const w = buildWarnings(d);
    expect(w.some((x) => x.id.startsWith('geo-') && x.message.includes('BKK'))).toBe(true);
  });

  it('allows flights touching the trip country or home (India)', () => {
    const d = base();
    d.items = [flight({ title: 'DEL → DPS', details: { origin: 'DEL', destination: 'DPS' } })];
    expect(buildWarnings(d).filter((x) => x.id.startsWith('geo-'))).toEqual([]);
  });

  it('matches free-text city names against the route', () => {
    const d = base();
    d.items = [flight({ title: 'to Ubud', details: { origin: 'Delhi', destination: 'Ubud' } })];
    expect(buildWarnings(d).filter((x) => x.id.startsWith('geo-'))).toEqual([]);
  });

  it('flags a flight dated outside the travel window (June trip, July flight)', () => {
    const d = base();
    d.items = [flight({ details: { origin: 'DEL', destination: 'DPS', depart_at: '2099-07-15T10:00' } })];
    const w = buildWarnings(d);
    expect(w.some((x) => x.id.startsWith('date-'))).toBe(true);
  });

  it('allows a red-eye departing the day before the trip starts', () => {
    const d = base();
    d.items = [flight({ details: { origin: 'DEL', destination: 'DPS', depart_at: '2099-06-14T23:30' } })];
    expect(buildWarnings(d).filter((x) => x.id.startsWith('date-'))).toEqual([]);
  });

  it('flags selling below cost and zero-cost groups that cover items', () => {
    const d = base();
    d.groups = [
      { id: 'g1', name: 'Land', supplier_id: null, supplier_name: null, cost_amount: 100, markup_type: 'percent', markup_value: 0, sell_amount: 90, sort_order: 0 },
      { id: 'g2', name: 'Empty', supplier_id: null, supplier_name: null, cost_amount: 0, markup_type: 'percent', markup_value: 15, sell_amount: 0, sort_order: 1 },
    ];
    d.items = [flight({ id: 'covered', price_group_id: 'g2', details: { origin: 'DEL', destination: 'DPS' } })];
    const w = buildWarnings(d);
    expect(w.some((x) => x.id === 'loss-g1')).toBe(true);
    expect(w.some((x) => x.id === 'nocost-g2')).toBe(true);
  });

  it('flags past travel start and zero-night destinations', () => {
    const d = base();
    d.proposal.travel_start = '2020-01-01';
    d.destinations[0].nights = 0;
    const w = buildWarnings(d);
    expect(w.some((x) => x.id === 'past-start')).toBe(true);
    expect(w.some((x) => x.id === 'zero-d1')).toBe(true);
  });
});
