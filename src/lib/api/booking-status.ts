import type { SupplierStatus } from '@/lib/types/booking-items';

type BookingStatus = 'pending' | 'blocked' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Derives the booking-level status from item-level supplier statuses.
 * Called after every item status change to keep the booking status in sync.
 */
export function deriveBookingStatus(
  itemStatuses: SupplierStatus[]
): BookingStatus {
  if (itemStatuses.length === 0) return 'pending';
  if (itemStatuses.every(s => s === 'cancelled')) return 'cancelled';
  if (itemStatuses.every(s => s === 'completed')) return 'completed';
  if (itemStatuses.every(s => s === 'confirmed' || s === 'completed')) return 'confirmed';
  if (itemStatuses.some(s => s === 'on_hold')) return 'blocked';
  if (
    itemStatuses.some(s =>
      s === 'confirmed' || s === 'on_hold' || s === 'confirmation_requested'
    )
  ) return 'in_progress';
  return 'pending';
}
