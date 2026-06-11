// Booking-level sanity checks — the ops/payments counterpart of the
// proposal builder's validation engine. Deterministic, computed
// client-side from data the booking page already holds.

import type { BookingItem } from '@/lib/types/booking-items';

interface BookingShape {
  status: string;
  travel_start: string | null;
  travel_end: string | null;
  sell_price: number;
  cost_price: number;
  total_paid: number;
  currency: string;
}

export interface BookingWarning {
  id: string;
  message: string;
}

const DAY = 86400000;
const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export function bookingWarnings(booking: BookingShape, items: BookingItem[]): BookingWarning[] {
  const warnings: BookingWarning[] = [];
  if (booking.status === 'cancelled') return warnings;

  const today = new Date().toISOString().slice(0, 10);
  const cur = booking.currency || 'INR';
  const start = booking.travel_start;
  const daysToGo = start ? Math.ceil((new Date(start + 'T00:00:00Z').getTime() - Date.now()) / DAY) : null;

  // Suppliers not locked in while the trip is imminent.
  const unconfirmed = items.filter((i) => !['confirmed', 'cancelled'].includes(i.supplier_status));
  if (unconfirmed.length > 0 && daysToGo != null && daysToGo <= 7) {
    warnings.push({
      id: 'unconfirmed-near-travel',
      message:
        daysToGo < 0
          ? `Trip already started but ${unconfirmed.length} item(s) are still not supplier-confirmed.`
          : `Travel starts in ${daysToGo} day(s) but ${unconfirmed.length} item(s) are still not supplier-confirmed.`,
    });
  }

  // Client balance outstanding at/after travel start.
  const balance = (Number(booking.sell_price) || 0) - (Number(booking.total_paid) || 0);
  if (balance > 1 && start && start <= today) {
    warnings.push({
      id: 'balance-at-travel',
      message: `Client balance of ${cur} ${fmt(balance)} is still outstanding and the trip has started.`,
    });
  }

  // Items dated outside the booking's travel window.
  if (booking.travel_start && booking.travel_end) {
    const lo = new Date(new Date(booking.travel_start).getTime() - DAY).toISOString().slice(0, 10);
    const hi = new Date(new Date(booking.travel_end).getTime() + DAY).toISOString().slice(0, 10);
    for (const i of items) {
      if (i.start_date && (i.start_date < lo || i.start_date > hi)) {
        warnings.push({
          id: `date-${i.id}`,
          message: `"${i.label}" is dated ${i.start_date}, outside the trip (${booking.travel_start} → ${booking.travel_end}).`,
        });
      }
    }
  }

  // Booking-level negative margin (actuals drifted past sell).
  const totalCost = Number(booking.cost_price) || 0;
  const totalSell = Number(booking.sell_price) || 0;
  if (totalCost > 0 && totalSell > 0 && totalCost > totalSell) {
    warnings.push({
      id: 'negative-margin',
      message: `Costs (${cur} ${fmt(totalCost)}) exceed the sell price (${cur} ${fmt(totalSell)}) — negative margin.`,
    });
  }

  return warnings;
}
