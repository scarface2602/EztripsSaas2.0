import { describe, it, expect } from 'vitest';
import { computeV2Totals, effectiveGroupAmounts, effectiveItemAmounts } from './v2-pricing';

const tax = (over: Partial<Parameters<typeof computeV2Totals>[2]> = {}) => ({
  pax: 2,
  gst_enabled: true,
  gst_rate: 5,
  tcs_enabled: false,
  tcs_rate: 5,
  ...over,
});

const flight = (cost: number | null, sell: number | null, extra: Partial<{
  price_group_id: string | null;
  details: Record<string, unknown>;
}> = {}) => ({
  item_type: 'flight',
  price_group_id: null,
  cost_amount: cost,
  sell_amount: sell,
  details: {},
  ...extra,
});

describe('computeV2Totals — GST split', () => {
  it('applies the land rate to land and 18% to flight markup only', () => {
    const t = computeV2Totals(
      [{ cost_amount: 97800, sell_amount: 112470, price_basis: 'total' }],
      [flight(60000, 61000)],
      tax(),
    );
    expect(t.landSell).toBe(112470);
    expect(t.flightSell).toBe(61000);
    expect(t.flightMarkup).toBe(1000);
    expect(t.landGst).toBe(5623.5); // 5% of land only
    expect(t.flightGst).toBe(180); // 18% of 1000 markup
    expect(t.gst).toBe(5803.5);
    expect(t.grand).toBe(112470 + 61000 + 5803.5);
  });

  it('treats sell == cost flights as reimbursement: zero flight GST', () => {
    const t = computeV2Totals([], [flight(60000, 60000)], tax());
    expect(t.flightMarkup).toBe(0);
    expect(t.flightGst).toBe(0);
    expect(t.gst).toBe(0); // no land either
  });

  it('never charges negative flight GST when selling below cost', () => {
    const t = computeV2Totals([], [flight(60000, 59000)], tax());
    expect(t.flightMarkup).toBe(0);
    expect(t.flightGst).toBe(0);
  });

  it('bundles grouped flights into the package: land rate on everything, no flight split', () => {
    const t = computeV2Totals(
      [{ cost_amount: 150000, sell_amount: 172500, price_basis: 'total' }],
      [flight(null, null, { price_group_id: 'g1' })],
      tax(),
    );
    expect(t.flightsBundled).toBe(true);
    expect(t.flightSell).toBe(0);
    expect(t.landSell).toBe(172500);
    expect(t.gst).toBe(8625); // 5% on the whole package
  });

  it('keeps TCS on the GST-inclusive amount', () => {
    const t = computeV2Totals(
      [{ cost_amount: 100000, sell_amount: 110000, price_basis: 'total' }],
      [],
      tax({ tcs_enabled: true }),
    );
    expect(t.gst).toBe(5500);
    expect(t.tcs).toBe(5775); // 5% of 115500
    expect(t.grand).toBe(121275);
  });
});

describe('per-person price basis', () => {
  it('multiplies per-person groups by pax', () => {
    expect(effectiveGroupAmounts({ cost_amount: 50000, sell_amount: 57500, price_basis: 'per_person' }, 3))
      .toEqual({ cost: 150000, sell: 172500 });
    expect(effectiveGroupAmounts({ cost_amount: 50000, sell_amount: 57500, price_basis: 'total' }, 3))
      .toEqual({ cost: 50000, sell: 57500 });
  });

  it('multiplies per-pax flights by pax, leaves total flights alone', () => {
    expect(effectiveItemAmounts(flight(30000, 30500, { details: { price_basis: 'per_pax' } }), 2))
      .toEqual({ cost: 60000, sell: 61000 });
    expect(effectiveItemAmounts(flight(30000, 30500), 2)).toEqual({ cost: 30000, sell: 30500 });
  });

  it('rolls per-person groups and per-pax flights into totals', () => {
    const t = computeV2Totals(
      [{ cost_amount: 48900, sell_amount: 56235, price_basis: 'per_person' }],
      [flight(30000, 30500, { details: { price_basis: 'per_pax' } })],
      tax({ gst_enabled: false }),
    );
    expect(t.landSell).toBe(112470);
    expect(t.flightSell).toBe(61000);
    expect(t.perPerson).toBe((112470 + 61000) / 2);
  });

  it('guards against pax 0 (no division/multiplication blow-ups)', () => {
    const t = computeV2Totals(
      [{ cost_amount: 100, sell_amount: 110, price_basis: 'per_person' }],
      [],
      tax({ pax: 0, gst_enabled: false }),
    );
    expect(t.sell).toBe(110); // per-person multiplier clamps to 1
    expect(t.perPerson).toBeNull();
  });
});
