import { describe, it, expect } from 'vitest';
import {
  computeLineTax, splitTax, computeTcs, resolveTaxConfig,
  DEFAULT_TAX_CONFIG, TAX_CLASS_BY_ITEM_TYPE,
} from './engine';

describe('computeLineTax', () => {
  it('tour operator: 5% on gross, ITC blocked', () => {
    const t = computeLineTax({ taxClass: 'TOUR_OPERATOR', sellPrice: 100000, costPrice: 80000 });
    expect(t.method).toBe('GROSS');
    expect(t.taxableValue).toBe(100000);
    expect(t.rate).toBe(5);
    expect(t.taxAmount).toBe(5000);
    expect(t.itcBlocked).toBe(true);
    expect(t.sacCode).toBe('998555');
  });

  it('air agent margin method: 18% on sell minus cost', () => {
    const t = computeLineTax({ taxClass: 'AIR_AGENT', sellPrice: 10000, costPrice: 9000 });
    expect(t.method).toBe('MARGIN');
    expect(t.taxableValue).toBe(1000);
    expect(t.taxAmount).toBe(180);
    expect(t.warnings).toHaveLength(0);
  });

  it('air agent Rule 32(3): 18% on 5% domestic / 10% international of basic fare', () => {
    const config = resolveTaxConfig({ air_agent_method: 'BASIC_FARE' });
    const dom = computeLineTax({ taxClass: 'AIR_AGENT', sellPrice: 10000, basicFare: 8000 }, config);
    expect(dom.method).toBe('BASIC_FARE');
    expect(dom.taxableValue).toBe(400);   // 5% of 8000
    expect(dom.taxAmount).toBe(72);
    const intl = computeLineTax({ taxClass: 'AIR_AGENT', sellPrice: 50000, basicFare: 40000, international: true }, config);
    expect(intl.taxableValue).toBe(4000); // 10% of 40000
    expect(intl.taxAmount).toBe(720);
  });

  it('air agent basic-fare mode falls back to margin with a warning when fare unknown', () => {
    const config = resolveTaxConfig({ air_agent_method: 'BASIC_FARE' });
    const t = computeLineTax({ taxClass: 'AIR_AGENT', sellPrice: 10000, costPrice: 9500 }, config);
    expect(t.method).toBe('MARGIN');
    expect(t.taxableValue).toBe(500);
    expect(t.warnings[0]).toMatch(/Basic fare/);
  });

  it('missing cost price → zero tax with an explicit warning, never a guess', () => {
    const t = computeLineTax({ taxClass: 'HOTEL_AGENT', sellPrice: 10000, costPrice: null });
    expect(t.taxAmount).toBe(0);
    expect(t.warnings[0]).toMatch(/Cost price missing/);
  });

  it('cab with fuel: 5% gross no ITC; without fuel: 18% margin', () => {
    const withFuel = computeLineTax({ taxClass: 'CAB', sellPrice: 10000, costPrice: 8000 });
    expect(withFuel.rate).toBe(5);
    expect(withFuel.taxableValue).toBe(10000);
    expect(withFuel.itcBlocked).toBe(true);
    const dry = computeLineTax({ taxClass: 'CAB', sellPrice: 10000, costPrice: 8000 }, resolveTaxConfig({ cab_fuel_included: false }));
    expect(dry.method).toBe('MARGIN');
    expect(dry.taxableValue).toBe(2000);
    expect(dry.rate).toBe(18);
  });

  it('negative margin is floored to zero with a warning', () => {
    const t = computeLineTax({ taxClass: 'INSURANCE_AGENT', sellPrice: 900, costPrice: 1000 });
    expect(t.taxableValue).toBe(0);
    expect(t.taxAmount).toBe(0);
    expect(t.warnings[0]).toMatch(/below cost/);
  });

  it('every item type maps to a tax class', () => {
    for (const type of ['dmc_package', 'flight_segment', 'hotel_room', 'train', 'vehicle', 'transfer', 'insurance', 'activity', 'meal_plan']) {
      expect(TAX_CLASS_BY_ITEM_TYPE[type]).toBeTruthy();
    }
  });
});

describe('splitTax', () => {
  it('intra-state splits into CGST+SGST halves', () => {
    expect(splitTax(180, '20', '20')).toEqual({ cgst: 90, sgst: 90, igst: 0, intraState: true });
  });
  it('inter-state and unknown POS go to IGST', () => {
    expect(splitTax(180, '20', '27').igst).toBe(180);
    expect(splitTax(180, '20', null).igst).toBe(180);
  });
  it('odd paise: SGST takes the remainder so the total is exact', () => {
    const s = splitTax(100.01, '07', '07');
    expect(s.cgst + s.sgst).toBeCloseTo(100.01, 2);
  });
});

describe('computeTcs', () => {
  it('current law: flat 2% with no threshold', () => {
    expect(computeTcs(500000, 0).tcsAmount).toBe(10000);
    expect(computeTcs(500000, 2_000_000).tcsAmount).toBe(10000); // aggregate irrelevant in FLAT mode
    expect(computeTcs(500000, 0).effectiveRate).toBe(2);
  });

  it('legacy SLAB mode splits across the threshold', () => {
    const config = resolveTaxConfig({ tcs: { ...DEFAULT_TAX_CONFIG.tcs, mode: 'SLAB' } });
    // 9L before + 2L now: 1L at 5% + 1L at 20% = 5000 + 20000
    expect(computeTcs(200000, 900000, config).tcsAmount).toBe(25000);
    // fully below threshold
    expect(computeTcs(200000, 0, config).tcsAmount).toBe(10000);
    // fully above threshold
    expect(computeTcs(200000, 1_500_000, config).tcsAmount).toBe(40000);
  });

  it('zero/negative amounts produce no TCS', () => {
    expect(computeTcs(0, 0).tcsAmount).toBe(0);
  });
});
