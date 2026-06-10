'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { useBooking } from '../booking-context';
import { format } from 'date-fns';
import { toast } from 'sonner';

const TYPE_LABELS: Record<string, string> = {
  package: 'Package', hotel: 'Hotel', land: 'Land Services', flight: 'Flight',
};

export function BookingHeader() {
  const router = useRouter();
  const { booking, updateBooking } = useBooking();

  if (!booking) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/bookings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{booking.title}</h1>
            <Badge variant="outline">{TYPE_LABELS[booking.booking_type] || booking.booking_type}</Badge>
            {booking.trip_id && (
              <Badge
                variant="secondary"
                className="font-mono text-xs cursor-pointer hover:bg-muted"
                onClick={() => {
                  navigator.clipboard.writeText(booking.trip_id!);
                  toast.success('Trip ID copied to clipboard');
                }}
                title="Click to copy Trip ID"
              >
                {booking.trip_id}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {booking.clients?.full_name || 'No client'}
            {booking.suppliers?.name && ` · ${booking.suppliers.name}`}
            {booking.destination && ` · ${booking.destination}`}
            {booking.travel_start && ` · ${format(new Date(booking.travel_start), 'dd MMM yyyy')}`}
            {booking.travel_end && ` – ${format(new Date(booking.travel_end), 'dd MMM yyyy')}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={booking.status} onValueChange={(s) => updateBooking({ status: s })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
