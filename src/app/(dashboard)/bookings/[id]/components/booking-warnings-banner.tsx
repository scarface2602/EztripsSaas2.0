'use client';

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBooking } from '../booking-context';
import { bookingWarnings } from '@/lib/bookings/warnings';

// Ops-side error prevention: same philosophy as the proposal builder's
// warning strip — surface what's about to go wrong before it does.
export function BookingWarningsBanner() {
  const { booking, items } = useBooking();
  const warnings = useMemo(
    () => (booking ? bookingWarnings(booking, items) : []),
    [booking, items],
  );
  if (warnings.length === 0) return null;

  return (
    <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 space-y-1">
      {warnings.map((w) => (
        <div key={w.id} className="flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}
