// Trip-confirmation readiness — the gate between "ops confirmed every
// piece" and "issue the consolidated trip confirmation voucher".
// Derived on demand from booking items + issued vouchers, never stored.
// Shared by the booking page UI and the package-voucher API route.

/** Minimal structural shape so both client BookingItem objects and raw DB rows fit. */
export interface TripConfirmationItem {
  id: string;
  item_type: string;
  label: string;
  supplier_status: string;
  supplier_reference: string | null;
  start_date: string | null;
  updated_at: string;
  details: Record<string, unknown> | null;
}

export interface TripConfirmationVoucher {
  voucher_type: string;
  pdf_generated_at?: string | null;
  created_at: string;
}

export interface TripConfirmationWarning {
  id: string;
  message: string;
}

export interface TripConfirmationState<T extends TripConfirmationItem = TripConfirmationItem> {
  /** Items that count toward the trip (everything not cancelled). */
  activeItems: T[];
  /** Active items ops must confirm individually (covered items are the DMC's job). */
  gateItems: T[];
  /** Gate items not yet confirmed/completed — empty means ready. */
  blockingItems: T[];
  ready: boolean;
  warnings: TripConfirmationWarning[];
  /** Most recent consolidated voucher, if one was issued. */
  latestVoucher: TripConfirmationVoucher | null;
  /** True when an item changed after the latest voucher was generated. */
  stale: boolean;
}

const CONFIRMED = ['confirmed', 'completed'];

/** Items priced inside a DMC group ride on the DMC's confirmation. */
export function isCoveredItem(item: TripConfirmationItem): boolean {
  return Boolean(item.details && (item.details as Record<string, unknown>).covered_by);
}

export function deriveTripConfirmation<T extends TripConfirmationItem>(
  items: T[],
  vouchers: TripConfirmationVoucher[] = [],
): TripConfirmationState<T> {
  const activeItems = items.filter((i) => i.supplier_status !== 'cancelled');
  const gateItems = activeItems.filter((i) => !isCoveredItem(i));
  const blockingItems = gateItems.filter((i) => !CONFIRMED.includes(i.supplier_status));
  const ready = activeItems.length > 0 && blockingItems.length === 0;

  const warnings: TripConfirmationWarning[] = [];
  for (const i of gateItems) {
    if (CONFIRMED.includes(i.supplier_status) && !i.supplier_reference) {
      warnings.push({
        id: `no-ref-${i.id}`,
        message: `"${i.label}" is confirmed but has no supplier confirmation number — it will print as "—" on the voucher.`,
      });
    }
  }
  for (const i of activeItems) {
    // DMC packages legitimately span the whole trip without their own dates.
    if (i.item_type !== 'dmc_package' && !i.start_date) {
      warnings.push({
        id: `no-date-${i.id}`,
        message: `"${i.label}" has no date — it cannot be placed in the trip's day-wise order.`,
      });
    }
  }

  const tripVouchers = vouchers
    .filter((v) => v.voucher_type === 'package')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latestVoucher = tripVouchers[0] || null;

  const issuedAt = latestVoucher ? latestVoucher.pdf_generated_at || latestVoucher.created_at : null;
  const stale = Boolean(issuedAt && activeItems.some((i) => i.updated_at > issuedAt));

  return { activeItems, gateItems, blockingItems, ready, warnings, latestVoucher, stale };
}

/**
 * Confirmation reference an item should print on the trip voucher:
 * its own, or — for covered items — the covering DMC package's.
 */
export function effectiveSupplierReference(
  item: TripConfirmationItem,
  allItems: TripConfirmationItem[],
): string {
  if (item.supplier_reference) return item.supplier_reference;
  const coveredBy = item.details && (item.details as Record<string, unknown>).covered_by;
  if (typeof coveredBy === 'string' && coveredBy) {
    const dmc = allItems.find((i) => i.item_type === 'dmc_package' && i.label === coveredBy);
    if (dmc?.supplier_reference) return dmc.supplier_reference;
  }
  return '';
}
