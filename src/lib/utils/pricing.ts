/**
 * Pricing Formula (updated):
 * 1. Land subtotal (hotels + transfers + activities + ancillaries)
 * 2. Flight subtotal (separate, GST exempt)
 * 3. Discount (applied to land only or full total — controlled by discountOnLandOnly)
 * 4. GST = (land subtotal - land discount) × gst_rate / 100
 * 5. TCS = (land subtotal + flight subtotal - total discount) × tcs_rate / 100
 * 6. Grand total = land subtotal + flight subtotal - discount + GST + TCS
 * 7. Rounding applied to grand total
 */

export interface LineItemInput {
  sp: number;
  cp: number;
  is_optional?: boolean;
  is_flight?: boolean;
}

export interface ProposalTotalInput {
  lineItems: LineItemInput[];
  discountAmount: number;
  discountOnLandOnly: boolean;
  gstEnabled: boolean;
  gstRate: number;
  tcsEnabled: boolean;
  tcsRate: number;
  roundingUnit: number; // 0 = off, 100, 500, 1000
}

export interface ProposalTotalResult {
  landSubtotal: number;
  flightSubtotal: number;
  subtotal: number;
  discount: number;
  landAfterDiscount: number;
  subtotalAfterDiscount: number;
  gstAmount: number;
  tcsAmount: number;
  grandTotalBeforeRounding: number;
  grandTotal: number;
  totalCP: number;
  grossMargin: number;
  marginPct: number;
}

export function calculateLineItemSP(cp: number, markupAmount: number): number {
  return cp + markupAmount;
}

export function calculateLineItemSPPercent(cp: number, markupPct: number): number {
  return cp * (1 + markupPct / 100);
}

export function calculateMarginPct(sp: number, cp: number): number {
  if (sp === 0) return 0;
  return ((sp - cp) / sp) * 100;
}

export function applyRounding(amount: number, roundingUnit: number): number {
  if (roundingUnit <= 0) return amount;
  return Math.ceil(amount / roundingUnit) * roundingUnit;
}

/** Get currency symbol from currency code. Defaults to ₹ (INR). */
export function getCurrencySymbol(currency?: string | null): string {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    SGD: 'S$',
    AED: 'AED ',
    THB: '฿',
    AUD: 'A$',
    JPY: '¥',
  };
  const code = currency || 'INR';
  return symbols[code] ?? code;
}

export const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: 'INR', label: '₹ INR' },
  { code: 'USD', label: '$ USD' },
  { code: 'EUR', label: '€ EUR' },
  { code: 'GBP', label: '£ GBP' },
  { code: 'SGD', label: 'S$ SGD' },
  { code: 'AED', label: 'AED' },
  { code: 'THB', label: '฿ THB' },
  { code: 'AUD', label: 'A$ AUD' },
  { code: 'JPY', label: '¥ JPY' },
];

/** Format amount with currency symbol in en-IN locale */
export function formatCurrency(amount: number, currency?: string | null): string {
  return `${getCurrencySymbol(currency)}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function calculateProposalTotal(input: ProposalTotalInput): ProposalTotalResult {
  const required = input.lineItems.filter(li => !li.is_optional);

  // Step 1: Land subtotal
  const landSubtotal = required
    .filter(li => !li.is_flight)
    .reduce((sum, li) => sum + li.sp, 0);

  // Step 2: Flight subtotal
  const flightSubtotal = required
    .filter(li => li.is_flight)
    .reduce((sum, li) => sum + li.sp, 0);

  const subtotal = landSubtotal + flightSubtotal;

  // Step 3: Discount
  const discount = input.discountAmount;
  const landDiscount = input.discountOnLandOnly ? discount : (landSubtotal / (subtotal || 1)) * discount;
  const landAfterDiscount = landSubtotal - landDiscount;
  const subtotalAfterDiscount = subtotal - discount;

  // Step 4: GST on land only (flights exempt)
  const gstAmount = input.gstEnabled
    ? landAfterDiscount * (input.gstRate / 100)
    : 0;

  // Step 5: TCS on full subtotal after discount
  const tcsAmount = input.tcsEnabled
    ? subtotalAfterDiscount * (input.tcsRate / 100)
    : 0;

  // Step 6: Grand total
  const grandTotalBeforeRounding = subtotalAfterDiscount + gstAmount + tcsAmount;

  // Step 7: Rounding
  const grandTotal = applyRounding(grandTotalBeforeRounding, input.roundingUnit);

  // Internal calculations
  const totalCP = required.reduce((sum, li) => sum + li.cp, 0);
  const grossMargin = subtotalAfterDiscount - totalCP;
  const marginPct = calculateMarginPct(subtotalAfterDiscount, totalCP);

  return {
    landSubtotal,
    flightSubtotal,
    subtotal,
    discount,
    landAfterDiscount,
    subtotalAfterDiscount,
    gstAmount,
    tcsAmount,
    grandTotalBeforeRounding,
    grandTotal,
    totalCP,
    grossMargin,
    marginPct,
  };
}
