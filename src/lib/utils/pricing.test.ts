import { describe, it, expect } from 'vitest';
import {
  calculateProposalTotal,
  calculateLineItemSP,
  calculateLineItemSPPercent,
  calculateMarginPct,
  applyRounding,
  formatCurrency,
  type ProposalTotalInput,
} from './pricing';

const base: ProposalTotalInput = {
  lineItems: [],
  discountAmount: 0,
  discountOnLandOnly: false,
  gstEnabled: false,
  gstRate: 5,
  tcsEnabled: false,
  tcsRate: 5,
  roundingUnit: 0,
};

describe('calculateProposalTotal', () => {
  it('separates land and flight subtotals', () => {
    const r = calculateProposalTotal({
      ...base,
      lineItems: [
        { sp: 50000, cp: 40000 },
        { sp: 20000, cp: 18000, is_flight: true },
      ],
    });
    expect(r.landSubtotal).toBe(50000);
    expect(r.flightSubtotal).toBe(20000);
    expect(r.subtotal).toBe(70000);
    expect(r.grandTotal).toBe(70000);
  });

  it('excludes optional items from all totals', () => {
    const r = calculateProposalTotal({
      ...base,
      lineItems: [
        { sp: 50000, cp: 40000 },
        { sp: 9999, cp: 8000, is_optional: true },
      ],
    });
    expect(r.subtotal).toBe(50000);
    expect(r.totalCP).toBe(40000);
  });

  it('applies GST on land only — flights exempt', () => {
    const r = calculateProposalTotal({
      ...base,
      gstEnabled: true,
      gstRate: 5,
      lineItems: [
        { sp: 100000, cp: 80000 },
        { sp: 40000, cp: 38000, is_flight: true },
      ],
    });
    expect(r.gstAmount).toBe(5000); // 5% of 100000 land, not 140000
    expect(r.grandTotal).toBe(145000);
  });

  it('applies TCS on full subtotal after discount', () => {
    const r = calculateProposalTotal({
      ...base,
      tcsEnabled: true,
      tcsRate: 5,
      discountAmount: 10000,
      lineItems: [
        { sp: 100000, cp: 80000 },
        { sp: 40000, cp: 38000, is_flight: true },
      ],
    });
    // (140000 - 10000) * 5%
    expect(r.tcsAmount).toBe(6500);
    expect(r.grandTotal).toBe(136500);
  });

  it('land-only discount reduces GST base fully', () => {
    const r = calculateProposalTotal({
      ...base,
      gstEnabled: true,
      gstRate: 5,
      discountAmount: 20000,
      discountOnLandOnly: true,
      lineItems: [
        { sp: 100000, cp: 80000 },
        { sp: 40000, cp: 38000, is_flight: true },
      ],
    });
    expect(r.landAfterDiscount).toBe(80000);
    expect(r.gstAmount).toBe(4000);
  });

  it('proportional discount splits GST base across land and flights', () => {
    const r = calculateProposalTotal({
      ...base,
      gstEnabled: true,
      gstRate: 5,
      discountAmount: 14000,
      discountOnLandOnly: false,
      lineItems: [
        { sp: 100000, cp: 80000 },
        { sp: 40000, cp: 38000, is_flight: true },
      ],
    });
    // land share of discount = 100000/140000 * 14000 = 10000
    expect(r.landAfterDiscount).toBe(90000);
    expect(r.gstAmount).toBe(4500);
  });

  it('computes margin against CP', () => {
    const r = calculateProposalTotal({
      ...base,
      lineItems: [{ sp: 120000, cp: 100000 }],
    });
    expect(r.grossMargin).toBe(20000);
    expect(r.marginPct).toBeCloseTo((20000 / 120000) * 100, 5);
  });

  it('rounds the grand total up to the rounding unit', () => {
    const r = calculateProposalTotal({
      ...base,
      roundingUnit: 500,
      lineItems: [{ sp: 100001, cp: 80000 }],
    });
    expect(r.grandTotalBeforeRounding).toBe(100001);
    expect(r.grandTotal).toBe(100500);
  });

  it('handles empty proposals without NaN', () => {
    const r = calculateProposalTotal({ ...base, discountAmount: 500 });
    expect(r.grandTotal).toBe(-500);
    expect(Number.isNaN(r.gstAmount)).toBe(false);
    expect(Number.isNaN(r.marginPct)).toBe(false);
  });
});

describe('markup helpers', () => {
  it('flat markup adds to CP', () => {
    expect(calculateLineItemSP(10000, 1500)).toBe(11500);
  });

  it('percent markup multiplies CP', () => {
    expect(calculateLineItemSPPercent(10000, 15)).toBe(11500);
  });

  it('margin pct is 0 when SP is 0', () => {
    expect(calculateMarginPct(0, 5000)).toBe(0);
  });
});

describe('applyRounding', () => {
  it('returns amount unchanged when rounding is off', () => {
    expect(applyRounding(12345.67, 0)).toBe(12345.67);
  });

  it('always rounds up (ceil), never down', () => {
    expect(applyRounding(100001, 1000)).toBe(101000);
    expect(applyRounding(100000, 1000)).toBe(100000);
  });

  it('guards against non-finite amounts', () => {
    expect(applyRounding(NaN, 100)).toBe(0);
    expect(applyRounding(Infinity, 100)).toBe(0);
  });
});

describe('formatCurrency', () => {
  it('formats INR in en-IN grouping', () => {
    expect(formatCurrency(184000, 'INR')).toBe('₹1,84,000');
  });

  it('falls back to code for unknown currencies', () => {
    expect(formatCurrency(100, 'CHF')).toBe('CHF100');
  });

  it('treats NaN as zero', () => {
    expect(formatCurrency(NaN, 'INR')).toBe('₹0');
  });
});
