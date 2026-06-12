// GST + TCS engine for Indian travel-trade sales.
// Data-driven: rates, methods and TCS slabs live in TaxConfig
// (org-overridable via organisations.tax_config) — law changes are
// config edits, not code edits.
//
// Verified against current law (June 2026):
// - Tour operator: 5% on gross, ITC blocked (unchanged by GST 2.0)
// - Air agent: 18% on margin/fee, or Rule 32(3) deemed value
//   (5% of basic fare domestic, 10% international)
// - TCS on overseas tour packages: FLAT 2%, no threshold, from
//   01-04-2026 (Sec 394(1), IT Act 2025 — replaced 206C(1G) 5%/20% @10L)

export type TaxClass =
  | 'TOUR_OPERATOR'    // packages incl. accommodation+transport — 5% gross, no ITC
  | 'AIR_AGENT'        // flight resale — 18% on margin or deemed basic fare
  | 'HOTEL_AGENT'      // hotel-only resale — 18% on margin
  | 'RAIL_AGENT'       // train bookings — 18% on service charge/margin
  | 'CAB'              // vehicle/transfer — 5% gross (fuel incl., no ITC) or 18%
  | 'INSURANCE_AGENT'  // travel insurance — 18% on commission/margin
  | 'SERVICE_FEE'      // activities, handling, convenience — 18%
  | 'VISA_ASSIST'      // visa assistance — 18%
  | 'EXEMPT';          // pure pass-through / exempt

export const TAX_CLASS_BY_ITEM_TYPE: Record<string, TaxClass> = {
  dmc_package: 'TOUR_OPERATOR',
  flight_segment: 'AIR_AGENT',
  hotel_room: 'HOTEL_AGENT',
  train: 'RAIL_AGENT',
  vehicle: 'CAB',
  transfer: 'CAB',
  insurance: 'INSURANCE_AGENT',
  activity: 'SERVICE_FEE',
  meal_plan: 'SERVICE_FEE',
};

/** SAC codes (configurable per org later if needed). */
export const SAC_BY_CLASS: Record<TaxClass, string> = {
  TOUR_OPERATOR: '998555',
  AIR_AGENT: '998551',
  HOTEL_AGENT: '998552',
  RAIL_AGENT: '998551',
  CAB: '996601',
  INSURANCE_AGENT: '997161',
  SERVICE_FEE: '998559',
  VISA_ASSIST: '998559',
  EXEMPT: '',
};

export interface TaxConfig {
  /** How air margins are valued: hidden-margin (sell−cost) or Rule 32(3) basic-fare. */
  air_agent_method: 'MARGIN' | 'BASIC_FARE';
  /** Renting with fuel included → 5% no-ITC; otherwise 18%. */
  cab_fuel_included: boolean;
  tour_operator_rate: number;   // 5
  margin_rate: number;          // 18
  cab_gross_rate: number;       // 5
  rule32_domestic_pct: number;  // 5  (% of basic fare)
  rule32_international_pct: number; // 10
  tcs: {
    mode: 'FLAT' | 'SLAB';
    flat_rate: number;          // 2 (current law, from 01-04-2026)
    threshold: number;          // used in SLAB mode
    rate_below: number;
    rate_above: number;
  };
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  air_agent_method: 'MARGIN',
  cab_fuel_included: true,
  tour_operator_rate: 5,
  margin_rate: 18,
  cab_gross_rate: 5,
  rule32_domestic_pct: 5,
  rule32_international_pct: 10,
  tcs: { mode: 'FLAT', flat_rate: 2, threshold: 1_000_000, rate_below: 5, rate_above: 20 },
};

export function resolveTaxConfig(orgOverrides?: Partial<TaxConfig> | null): TaxConfig {
  if (!orgOverrides) return DEFAULT_TAX_CONFIG;
  return {
    ...DEFAULT_TAX_CONFIG,
    ...orgOverrides,
    tcs: { ...DEFAULT_TAX_CONFIG.tcs, ...(orgOverrides.tcs || {}) },
  };
}

export interface TaxLineInput {
  taxClass: TaxClass;
  sellPrice: number;
  costPrice?: number | null;
  /** Basic fare for Rule 32(3) air valuation, when known. */
  basicFare?: number | null;
  international?: boolean;
}

export interface TaxComputation {
  taxClass: TaxClass;
  method: 'GROSS' | 'MARGIN' | 'BASIC_FARE' | 'EXEMPT';
  taxableValue: number;
  rate: number;
  taxAmount: number;
  sacCode: string;
  itcBlocked: boolean;
  warnings: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeLineTax(input: TaxLineInput, config: TaxConfig = DEFAULT_TAX_CONFIG): TaxComputation {
  const { taxClass, sellPrice } = input;
  const warnings: string[] = [];
  const sac = SAC_BY_CLASS[taxClass];

  if (taxClass === 'EXEMPT') {
    return { taxClass, method: 'EXEMPT', taxableValue: 0, rate: 0, taxAmount: 0, sacCode: sac, itcBlocked: false, warnings };
  }

  if (taxClass === 'TOUR_OPERATOR') {
    const taxable = r2(sellPrice);
    return {
      taxClass, method: 'GROSS', taxableValue: taxable, rate: config.tour_operator_rate,
      taxAmount: r2(taxable * config.tour_operator_rate / 100), sacCode: sac, itcBlocked: true, warnings,
    };
  }

  if (taxClass === 'CAB' && config.cab_fuel_included) {
    const taxable = r2(sellPrice);
    return {
      taxClass, method: 'GROSS', taxableValue: taxable, rate: config.cab_gross_rate,
      taxAmount: r2(taxable * config.cab_gross_rate / 100), sacCode: sac, itcBlocked: true, warnings,
    };
  }

  if (taxClass === 'AIR_AGENT' && config.air_agent_method === 'BASIC_FARE') {
    if (input.basicFare && input.basicFare > 0) {
      const pct = input.international ? config.rule32_international_pct : config.rule32_domestic_pct;
      const taxable = r2(input.basicFare * pct / 100);
      return {
        taxClass, method: 'BASIC_FARE', taxableValue: taxable, rate: config.margin_rate,
        taxAmount: r2(taxable * config.margin_rate / 100), sacCode: sac, itcBlocked: false, warnings,
      };
    }
    warnings.push('Basic fare not available — fell back to margin method');
  }

  // Margin method (default for AIR/HOTEL/RAIL/INSURANCE/SERVICE/VISA, and CAB w/o fuel)
  const cost = input.costPrice;
  if (cost == null) {
    warnings.push('Cost price missing — margin unknown, tax computed as zero. Fill cost to fix.');
    return { taxClass, method: 'MARGIN', taxableValue: 0, rate: config.margin_rate, taxAmount: 0, sacCode: sac, itcBlocked: false, warnings };
  }
  const margin = Math.max(0, r2(sellPrice - cost));
  if (sellPrice < cost) warnings.push('Selling below cost — margin treated as zero for tax');
  return {
    taxClass, method: 'MARGIN', taxableValue: margin, rate: config.margin_rate,
    taxAmount: r2(margin * config.margin_rate / 100), sacCode: sac, itcBlocked: false, warnings,
  };
}

/** Intra-state → CGST+SGST halves; inter-state (or unknown POS) → IGST. */
export function splitTax(taxAmount: number, orgStateCode?: string | null, posStateCode?: string | null): {
  cgst: number; sgst: number; igst: number; intraState: boolean;
} {
  const intra = Boolean(orgStateCode && posStateCode && orgStateCode === posStateCode);
  if (intra) {
    const half = r2(taxAmount / 2);
    return { cgst: half, sgst: r2(taxAmount - half), igst: 0, intraState: true };
  }
  return { cgst: 0, sgst: 0, igst: r2(taxAmount), intraState: false };
}

/**
 * TCS on overseas tour packages. `fyAggregateBefore` is the payer's
 * FY-to-date overseas-package total before this invoice (only used in
 * SLAB mode, where the rate steps up across the threshold).
 */
export function computeTcs(amount: number, fyAggregateBefore: number, config: TaxConfig = DEFAULT_TAX_CONFIG): {
  tcsAmount: number; effectiveRate: number;
} {
  if (amount <= 0) return { tcsAmount: 0, effectiveRate: 0 };
  const t = config.tcs;
  if (t.mode === 'FLAT') {
    return { tcsAmount: r2(amount * t.flat_rate / 100), effectiveRate: t.flat_rate };
  }
  const before = Math.max(0, fyAggregateBefore);
  const belowRoom = Math.max(0, t.threshold - before);
  const belowPart = Math.min(amount, belowRoom);
  const abovePart = amount - belowPart;
  const tcs = r2(belowPart * t.rate_below / 100 + abovePart * t.rate_above / 100);
  return { tcsAmount: tcs, effectiveRate: r2((tcs / amount) * 100) };
}
