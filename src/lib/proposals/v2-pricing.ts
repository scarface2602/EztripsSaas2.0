// Builder v2 pricing — pure functions shared by the client builder, the
// v2 save route and the publish/PDF snapshot so totals can never drift.
//
// GST is DERIVED, not a single opaque rate:
//   - Land (groups + non-flight items): gst_rate % (default 5, package rate).
//   - Flights priced separately: 18% on the MARKUP only (sell − cost).
//     sell == cost means a pure reimbursement — zero GST, automatically.
//   - Flights pulled INTO a group (fixed-departure override): their price
//     is part of the package, so the land rate applies to the whole thing
//     and no separate flight GST exists.
// TCS (LRS) applies on the GST-inclusive amount, same as v1/PDF.

export const FLIGHT_MARKUP_GST_PCT = 18;

export interface V2PricedGroup {
  cost_amount: number;
  sell_amount: number;
  price_basis?: 'total' | 'per_person' | null;
}

export interface V2PricedItem {
  item_type: string;
  price_group_id: string | null;
  cost_amount: number | null;
  sell_amount: number | null;
  details?: Record<string, unknown> | null;
}

export interface V2TaxInput {
  pax: number; // adults + children; multiplier for per-person bases
  gst_enabled: boolean;
  gst_rate: number;
  tcs_enabled: boolean;
  tcs_rate: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Group totals with the per-person basis expanded (entry × pax). */
export function effectiveGroupAmounts(g: V2PricedGroup, pax: number) {
  const mult = g.price_basis === 'per_person' ? Math.max(pax, 1) : 1;
  return { cost: r2((Number(g.cost_amount) || 0) * mult), sell: r2((Number(g.sell_amount) || 0) * mult) };
}

/** Self-priced item totals; flights entered per-pax expand to × pax. */
export function effectiveItemAmounts(i: V2PricedItem, pax: number) {
  const basis = (i.details as { price_basis?: string } | null | undefined)?.price_basis;
  const mult = i.item_type === 'flight' && basis === 'per_pax' ? Math.max(pax, 1) : 1;
  return {
    cost: i.cost_amount == null ? null : r2(Number(i.cost_amount) * mult),
    sell: i.sell_amount == null ? null : r2(Number(i.sell_amount) * mult),
  };
}

export interface V2Totals {
  cost: number;
  sell: number;
  landSell: number;
  landCost: number;
  flightSell: number;
  flightCost: number;
  flightMarkup: number;
  /** true when any flight sits inside a price group (fixed departure) — no land/flight split is shown. */
  flightsBundled: boolean;
  landGst: number;
  flightGst: number;
  gst: number;
  tcs: number;
  grand: number;
  margin: number;
  perPerson: number | null;
}

export function computeV2Totals(
  groups: V2PricedGroup[],
  items: V2PricedItem[],
  tax: V2TaxInput,
): V2Totals {
  const pax = tax.pax;
  const groupAmounts = groups.map((g) => effectiveGroupAmounts(g, pax));
  const groupSell = groupAmounts.reduce((s, g) => s + g.sell, 0);
  const groupCost = groupAmounts.reduce((s, g) => s + g.cost, 0);

  const selfItems = items.filter((i) => !i.price_group_id && i.sell_amount != null);
  const flightItems = selfItems.filter((i) => i.item_type === 'flight');
  const otherItems = selfItems.filter((i) => i.item_type !== 'flight');
  const sum = (list: V2PricedItem[], key: 'cost' | 'sell') =>
    list.reduce((s, i) => s + (effectiveItemAmounts(i, pax)[key] ?? 0), 0);

  const flightSell = r2(sum(flightItems, 'sell'));
  const flightCost = r2(sum(flightItems, 'cost'));
  const landSell = r2(groupSell + sum(otherItems, 'sell'));
  const landCost = r2(groupCost + sum(otherItems, 'cost'));
  const sell = r2(landSell + flightSell);
  const cost = r2(landCost + flightCost);

  const flightsBundled = items.some((i) => i.item_type === 'flight' && i.price_group_id != null);
  const flightMarkup = Math.max(r2(flightSell - flightCost), 0);

  const landGst = tax.gst_enabled ? r2((landSell * tax.gst_rate) / 100) : 0;
  const flightGst = tax.gst_enabled ? r2((flightMarkup * FLIGHT_MARKUP_GST_PCT) / 100) : 0;
  const gst = r2(landGst + flightGst);
  const tcs = tax.tcs_enabled ? r2(((sell + gst) * tax.tcs_rate) / 100) : 0;
  const grand = r2(sell + gst + tcs);

  return {
    cost, sell, landSell, landCost, flightSell, flightCost,
    flightMarkup, flightsBundled, landGst, flightGst, gst, tcs, grand,
    margin: r2(sell - cost),
    perPerson: pax > 0 ? r2(grand / pax) : null,
  };
}
