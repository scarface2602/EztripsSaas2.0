'use client';

import { Card } from '@/components/ui/card';
import { useBooking } from '../booking-context';
import { format } from 'date-fns';

export function BookingSummaryCards() {
  const { booking, packages } = useBooking();

  if (!booking) return null;

  const margin = Number(booking.sell_price) - Number(booking.cost_price);
  const marginPct = Number(booking.sell_price) > 0 ? (margin / Number(booking.sell_price) * 100).toFixed(1) : '0';
  
  // Compute total paid from package payments (new system) since the DB trigger may not have fired yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPaidFromPackages = packages.reduce((sum: number, pkg: any) =>
    sum + (pkg.payments || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((p: any) => p.status === 'paid')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0)
  , 0);
  const effectiveTotalPaid = Math.max(Number(booking.total_paid), totalPaidFromPackages);
  const balance = Number(booking.cost_price) - effectiveTotalPaid;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">Cost Price</p>
        <p className="text-xl font-bold">{booking.currency} {Number(booking.cost_price).toLocaleString()}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">Sell Price</p>
        <p className="text-xl font-bold">{booking.currency} {Number(booking.sell_price).toLocaleString()}</p>
      </Card>
      <Card className={`p-4 ${margin >= 0 ? 'border-green-200' : 'border-red-200'}`}>
        <p className="text-xs text-muted-foreground">Margin</p>
        <p className={`text-xl font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {booking.currency} {margin.toLocaleString()} ({marginPct}%)
        </p>
      </Card>
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">Paid to Supplier</p>
        <p className="text-xl font-bold text-green-600">{booking.currency} {effectiveTotalPaid.toLocaleString()}</p>
      </Card>
      <Card className={`p-4 ${balance > 0 ? 'border-orange-200' : 'border-green-200'}`}>
        <p className="text-xs text-muted-foreground">Balance Due</p>
        <p className={`text-xl font-bold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
          {booking.currency} {balance.toLocaleString()}
        </p>
        {booking.next_payment_date && (
          <p className="text-xs text-muted-foreground">
            Next: {format(new Date(booking.next_payment_date), 'dd MMM')} – {booking.currency} {Number(booking.next_payment_amount || 0).toLocaleString()}
          </p>
        )}
      </Card>
    </div>
  );
}
