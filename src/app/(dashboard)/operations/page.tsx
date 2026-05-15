import { createServiceClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format } from 'date-fns';
import { Hotel, MapPin, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export default async function OperationsPage() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's hotel check-ins
  const { data: todayArrivals } = await supabase
    .from('hotels')
    .select(`
      id, name, city, check_in, check_out, room_type, meal_plan, nights,
      proposal_id,
      proposals!inner (
        id, title, destination, status, client_id,
        clients ( full_name, phone )
      )
    `)
    .eq('check_in', today)
    .in('proposals.status', ['confirmed', 'sent'])
    .order('name');

  // Fetch today's activities
  const { data: todayActivities } = await supabase
    .from('itinerary_activities')
    .select(`
      id, type, location, start_time, end_time, details,
      itinerary_days!inner ( day_number, date, proposal_id ),
      proposals:itinerary_days!inner ( proposals!inner ( id, title, destination, status, client_id, clients ( full_name ) ) )
    `)
    .eq('itinerary_days.date', today)
    .order('start_time');

  // Fetch today's bookings with voucher status
  const { data: todayBookings } = await supabase
    .from('bookings')
    .select(`
      id, title, booking_type, status, destination, travel_start,
      clients ( full_name ),
      vouchers ( id, supplier_type, supplier_name, email_sent_at )
    `)
    .eq('travel_start', today)
    .in('status', ['confirmed', 'in_progress']);

  // Count active bookings needing attention
  const { data: pendingItems } = await supabase
    .from('booking_items')
    .select('id', { count: 'exact', head: true })
    .in('supplier_status', ['pending', 'confirmation_requested']);

  const pendingCount = pendingItems ? (pendingItems as unknown as { count: number }).count || 0 : 0;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const arrivals = (todayArrivals || []) as any[];
  const activities = (todayActivities || []) as any[];
  const bookings = (todayBookings || []) as any[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Operations</h1>
        <p className="text-muted-foreground">
          {format(new Date(), 'EEEE, dd MMMM yyyy')} — {arrivals.length} arrival{arrivals.length !== 1 ? 's' : ''}, {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'} today
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Hotel className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-muted-foreground">Today&apos;s Check-ins</p>
          </div>
          <p className="text-2xl font-bold mt-1">{arrivals.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <p className="text-xs text-muted-foreground">Today&apos;s Activities</p>
          </div>
          <p className="text-2xl font-bold mt-1">{activities.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-600" />
            <p className="text-xs text-muted-foreground">Pending Confirmations</p>
          </div>
          <p className="text-2xl font-bold mt-1">{pendingCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-purple-600" />
            <p className="text-xs text-muted-foreground">Trips Starting Today</p>
          </div>
          <p className="text-2xl font-bold mt-1">{bookings.length}</p>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="flex gap-2">
        <Link href="/operations/pending-confirmations">
          <Badge variant="outline" className="cursor-pointer hover:bg-muted px-3 py-1.5">
            View Pending Confirmations →
          </Badge>
        </Link>
      </div>

      {/* Today's Arrivals */}
      <div>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Hotel className="h-5 w-5 text-blue-600" /> Today&apos;s Arrivals
        </h2>
        {arrivals.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-muted-foreground">No check-ins today</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {arrivals.map((h: any) => {
              const proposal = Array.isArray(h.proposals) ? h.proposals[0] : h.proposals;
              const client = proposal?.clients;
              const hasVoucher = bookings.some((b: any) =>
                b.vouchers?.some((v: any) => v.supplier_type === 'hotel' && v.supplier_name === h.name)
              );

              return (
                <Card key={h.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{h.name}</h3>
                        <Badge variant="outline" className="text-xs">{h.city}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {client?.full_name || 'Guest'}
                        {h.room_type && ` · ${h.room_type}`}
                        {h.meal_plan && ` · ${h.meal_plan}`}
                        {h.nights && ` · ${h.nights}N`}
                      </p>
                      {client?.phone && (
                        <p className="text-xs text-muted-foreground">{client.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasVoucher ? (
                        <Badge className="bg-green-100 text-green-700 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Voucher Issued
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 gap-1">
                          <AlertCircle className="h-3 w-3" /> No Voucher
                        </Badge>
                      )}
                      {proposal?.id && (
                        <Link href={`/proposals/${proposal.id}`}>
                          <Badge variant="outline" className="cursor-pointer text-xs">View Proposal</Badge>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Today's Activities */}
      <div>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-green-600" /> Today&apos;s Activities
        </h2>
        {activities.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-muted-foreground">No activities scheduled today</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {activities.map((a: any) => {
              const proposalData = Array.isArray(a.proposals) ? a.proposals[0] : a.proposals;
              const proposal = proposalData?.proposals || proposalData;
              const client = proposal?.clients;

              return (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-xs">{a.type}</Badge>
                        <h3 className="font-semibold">{a.location || 'Activity'}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {client?.full_name || 'Guest'}
                        {a.start_time && ` · ${a.start_time}`}
                        {a.end_time && ` – ${a.end_time}`}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Trips Starting Today — Voucher Status */}
      {bookings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-purple-600" /> Trips Starting Today — Voucher Status
          </h2>
          <div className="grid gap-3">
            {bookings.map((b: any) => {
              const voucherCount = b.vouchers?.length || 0;
              const emailedCount = b.vouchers?.filter((v: any) => v.email_sent_at).length || 0;

              return (
                <Card key={b.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{b.title}</h3>
                        <Badge variant="outline" className="capitalize text-xs">{b.booking_type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {b.clients?.full_name || 'Guest'}
                        {b.destination && ` · ${b.destination}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {voucherCount > 0 ? (
                        <Badge className="bg-green-100 text-green-700">
                          {voucherCount} voucher{voucherCount > 1 ? 's' : ''} ({emailedCount} emailed)
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 gap-1">
                          <AlertCircle className="h-3 w-3" /> No Vouchers
                        </Badge>
                      )}
                      <Link href={`/bookings/${b.id}`}>
                        <Badge variant="outline" className="cursor-pointer text-xs">View Booking</Badge>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
