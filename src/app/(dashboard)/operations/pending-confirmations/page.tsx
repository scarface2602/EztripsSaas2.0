import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function PendingConfirmationsPage() {
  const supabase = createServiceClient();

  // Fetch only confirmed bookings with their items and related data
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id,
      status,
      proposal_id,
      cost_price,
      sell_price,
      created_at,
      proposals (
        id,
        title,
        destination,
        client_id,
        clients (
          id,
          full_name,
          email
        )
      ),
      booking_items (
        id,
        item_type,
        label,
        supplier_status,
        supplier_reference,
        start_date
      )
    `)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false });

  if (!bookings || bookings.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Pending Confirmations</h1>
        <Card>
          <CardContent className="pt-6 text-center text-gray-600">
            No pending confirmations at this time.
          </CardContent>
        </Card>
      </div>
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const all = bookings as any[];

  // Calculate stats
  const pendingItems = all.reduce(
    (sum: number, b) => sum + (b.booking_items?.filter((i: any) => ['pending', 'requested'].includes(i.supplier_status)).length || 0),
    0
  );

  // Group by confirmation status
  const awaiting = all.filter((b) =>
    b.booking_items?.some((i: any) => ['pending', 'requested'].includes(i.supplier_status))
  );
  const confirmed = all.filter((b) =>
    !b.booking_items?.some((i: any) => ['pending', 'requested'].includes(i.supplier_status))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Pending Confirmations</h1>
        <p className="text-gray-600">
          {pendingItems} items pending across {awaiting.length} bookings
        </p>
      </div>

      {/* AWAITING CONFIRMATIONS */}
      {awaiting.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-red-600">Awaiting Confirmations</h2>
          <div className="grid gap-4">
            {awaiting.map((booking: any) => {
              const pendingCount = (booking.booking_items)?.filter((i: any) =>
                ['pending', 'requested'].includes(i.supplier_status)
              ).length || 0;

              const clientName = (booking.proposals)?.clients?.full_name || 'Guest';
              const destination = (booking.proposals)?.destination || 'Unknown';

              return (
                <Card key={booking.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {clientName}&apos;s Trip to {destination}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Booking: {booking.id.slice(0, 8)}...
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Badge className="bg-red-100 text-red-700">
                            {pendingCount} pending
                          </Badge>
                          <Badge className="bg-gray-100 text-gray-700">
                            ₹{(booking.sell_price || 0).toLocaleString('en-IN')}
                          </Badge>
                        </div>
                      </div>
                      <Link href={`/bookings/${booking.id}`}>
                        <Button className="bg-ez-secondary hover:bg-orange-700">
                          View Booking
                        </Button>
                      </Link>
                    </div>

                    {/* Pending Items */}
                    <div className="mt-4 bg-red-50 p-3 rounded">
                      <p className="text-sm font-semibold text-red-700 mb-2">Pending Items:</p>
                      <ul className="text-sm space-y-1">
                        {(booking.booking_items)?.map((item: any) => (
                          ['pending', 'requested'].includes(item.supplier_status) && (
                            <li key={item.id} className="text-red-600">
                              • {item.label} ({item.item_type}) - {item.supplier_status}
                            </li>
                          )
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* FULLY CONFIRMED */}
      {confirmed.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-green-600">Fully Confirmed</h2>
          <div className="grid gap-4">
            {confirmed.map((booking: any) => {
              const clientName = (booking.proposals)?.clients?.full_name || 'Guest';
              const destination = (booking.proposals)?.destination || 'Unknown';

              return (
                <Card key={booking.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {clientName}&apos;s Trip to {destination}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Booking: {booking.id.slice(0, 8)}...
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Badge className="bg-green-100 text-green-700">
                            All confirmed
                          </Badge>
                          <Badge className="bg-gray-100 text-gray-700">
                            ₹{(booking.sell_price || 0).toLocaleString('en-IN')}
                          </Badge>
                        </div>
                      </div>
                      <Link href={`/bookings/${booking.id}`}>
                        <Button variant="outline">View Booking</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
