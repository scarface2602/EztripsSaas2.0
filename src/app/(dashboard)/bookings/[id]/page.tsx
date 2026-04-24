'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Hotel, Car, Plane, MapPin, CreditCard,
  Clock, Mail, Trash2, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  requested: 'bg-orange-100 text-orange-700',
  ticketed: 'bg-green-100 text-green-700',
  no_show: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
};

interface Booking {
  id: string;
  title: string;
  destination: string | null;
  status: string;
  travel_start: string | null;
  travel_end: string | null;
  pax_adults: number;
  pax_children: number;
  total_sell_price: number;
  total_cost_price: number;
  currency: string;
  internal_notes: string | null;
  special_requests: string | null;
  created_at: string;
  clients: { full_name: string; phone: string | null; email: string | null } | null;
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [booking, setBooking] = useState<Booking | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hotels, setHotels] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transport, setTransport] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [flights, setFlights] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activities, setActivities] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [payments, setPayments] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emails, setEmails] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bRes, hRes, tRes, fRes, aRes, pRes, lRes, eRes] = await Promise.all([
      supabase.from('bookings').select('*, clients(full_name, phone, email)').eq('id', id).single(),
      supabase.from('booking_hotels').select('*, suppliers(name)').eq('booking_id', id).order('sort_order'),
      supabase.from('booking_transport').select('*, suppliers(name)').eq('booking_id', id).order('sort_order'),
      supabase.from('booking_flights').select('*, suppliers(name)').eq('booking_id', id).order('sort_order'),
      supabase.from('booking_activities').select('*, suppliers(name)').eq('booking_id', id).order('sort_order'),
      supabase.from('booking_payments').select('*, suppliers(name), clients(full_name)').eq('booking_id', id).order('due_date'),
      supabase.from('booking_logs').select('*, users(full_name)').eq('booking_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('booking_emails').select('*, suppliers(name)').eq('booking_id', id).order('created_at', { ascending: false }),
    ]);
    setBooking(bRes.data as Booking);
    setHotels(hRes.data || []);
    setTransport(tRes.data || []);
    setFlights(fRes.data || []);
    setActivities(aRes.data || []);
    setPayments(pRes.data || []);
    setLogs(lRes.data || []);
    setEmails(eRes.data || []);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateBookingStatus = async (status: string | null) => {
    if (!status) return;
    await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    fetchAll();
  };

  const deleteComponent = async (type: string, componentId: string) => {
    await fetch(`/api/bookings/${id}/${type}?component_id=${componentId}`, { method: 'DELETE' });
    fetchAll();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading booking...</div>;
  }

  if (!booking) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Booking not found</div>;
  }

  const margin = booking.total_sell_price - booking.total_cost_price;
  const marginPct = booking.total_sell_price > 0 ? (margin / booking.total_sell_price * 100).toFixed(1) : '0';

  // Payment summaries
  const totalPayable = payments.filter(p => p.direction === 'payable').reduce((s, p) => s + (p.amount || 0), 0);
  const totalReceivable = payments.filter(p => p.direction === 'receivable').reduce((s, p) => s + (p.amount || 0), 0);
  const paidPayable = payments.filter(p => p.direction === 'payable' && p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);
  const paidReceivable = payments.filter(p => p.direction === 'receivable' && p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/bookings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{booking.title}</h1>
            <p className="text-sm text-muted-foreground">
              {booking.clients?.full_name || 'No client'} &bull; {booking.destination || 'No destination'}
              {booking.travel_start && ` &bull; ${format(new Date(booking.travel_start), 'dd MMM yyyy')}`}
              {booking.travel_end && ` - ${format(new Date(booking.travel_end), 'dd MMM yyyy')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={booking.status} onValueChange={updateBookingStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Sell</p>
          <p className="text-xl font-bold">{booking.currency} {booking.total_sell_price.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Cost</p>
          <p className="text-xl font-bold">{booking.currency} {booking.total_cost_price.toLocaleString()}</p>
        </Card>
        <Card className={`p-4 ${margin >= 0 ? 'border-green-200' : 'border-red-200'}`}>
          <p className="text-xs text-muted-foreground">Margin</p>
          <p className={`text-xl font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {booking.currency} {margin.toLocaleString()} ({marginPct}%)
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Received</p>
          <p className="text-xl font-bold text-green-600">{booking.currency} {paidReceivable.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">of {totalReceivable.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Paid Out</p>
          <p className="text-xl font-bold text-orange-600">{booking.currency} {paidPayable.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">of {totalPayable.toLocaleString()}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="hotels">
        <TabsList>
          <TabsTrigger value="hotels" className="gap-1"><Hotel className="h-3.5 w-3.5" /> Hotels ({hotels.length})</TabsTrigger>
          <TabsTrigger value="transport" className="gap-1"><Car className="h-3.5 w-3.5" /> Transport ({transport.length})</TabsTrigger>
          <TabsTrigger value="flights" className="gap-1"><Plane className="h-3.5 w-3.5" /> Flights ({flights.length})</TabsTrigger>
          <TabsTrigger value="activities" className="gap-1"><MapPin className="h-3.5 w-3.5" /> Activities ({activities.length})</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="emails" className="gap-1"><Mail className="h-3.5 w-3.5" /> Emails ({emails.length})</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1"><Clock className="h-3.5 w-3.5" /> Activity Log</TabsTrigger>
        </TabsList>

        {/* Hotels Tab */}
        <TabsContent value="hotels">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Hotels</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hotel</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Nights</TableHead>
                    <TableHead>Room / Meal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confirmation</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Sell</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotels.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">No hotels added</TableCell></TableRow>
                  ) : hotels.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.hotel_name}</TableCell>
                      <TableCell>{h.city}</TableCell>
                      <TableCell>{h.check_in ? format(new Date(h.check_in), 'dd MMM') : '-'}</TableCell>
                      <TableCell>{h.check_out ? format(new Date(h.check_out), 'dd MMM') : '-'}</TableCell>
                      <TableCell>{h.nights || '-'}</TableCell>
                      <TableCell>{[h.room_type, h.meal_plan].filter(Boolean).join(' / ') || '-'}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[h.status] || ''}>{h.status}</Badge></TableCell>
                      <TableCell className="text-xs">{h.confirmation_number || '-'}</TableCell>
                      <TableCell className="text-right">{(h.cost_price || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(h.sell_price || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteComponent('hotels', h.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transport Tab */}
        <TabsContent value="transport">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Transport</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Sell</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transport.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No transport added</TableCell></TableRow>
                  ) : transport.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium capitalize">{t.type?.replace('_', ' ')}</TableCell>
                      <TableCell>{t.from_location || '-'}</TableCell>
                      <TableCell>{t.to_location || '-'}</TableCell>
                      <TableCell>{t.date ? format(new Date(t.date), 'dd MMM') : '-'}</TableCell>
                      <TableCell>{t.vehicle_type || '-'}</TableCell>
                      <TableCell>{t.driver_name || '-'}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[t.status] || ''}>{t.status}</Badge></TableCell>
                      <TableCell className="text-right">{(t.cost_price || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(t.sell_price || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteComponent('transport', t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flights Tab */}
        <TabsContent value="flights">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Flights</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Airline</TableHead>
                    <TableHead>Flight</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>PNR</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Sell</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flights.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No flights added</TableCell></TableRow>
                  ) : flights.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.airline || '-'}</TableCell>
                      <TableCell>{f.flight_number || '-'}</TableCell>
                      <TableCell>{[f.origin_iata, f.destination_iata].filter(Boolean).join(' → ') || '-'}</TableCell>
                      <TableCell>{f.departure_at ? format(new Date(f.departure_at), 'dd MMM HH:mm') : '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{f.pnr || '-'}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[f.status] || ''}>{f.status}</Badge></TableCell>
                      <TableCell className="text-right">{(f.cost_price || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(f.sell_price || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteComponent('flights', f.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Sell</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No activities added</TableCell></TableRow>
                  ) : activities.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.activity_name}</TableCell>
                      <TableCell>{a.location || '-'}</TableCell>
                      <TableCell>{a.date ? format(new Date(a.date), 'dd MMM') : '-'}</TableCell>
                      <TableCell>{a.duration || '-'}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[a.status] || ''}>{a.status}</Badge></TableCell>
                      <TableCell className="text-xs">{a.voucher_number || '-'}</TableCell>
                      <TableCell className="text-right">{(a.cost_price || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(a.sell_price || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteComponent('activities', a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Direction</TableHead>
                    <TableHead>Supplier / Client</TableHead>
                    <TableHead>Component</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No payments recorded</TableCell></TableRow>
                  ) : payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Badge variant={p.direction === 'receivable' ? 'default' : 'outline'}>
                          {p.direction === 'receivable' ? 'Receivable' : 'Payable'}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.direction === 'payable' ? p.suppliers?.name : p.clients?.full_name || '-'}</TableCell>
                      <TableCell className="capitalize">{p.component_type || 'general'}</TableCell>
                      <TableCell className="font-medium">{booking.currency} {(p.amount || 0).toLocaleString()}</TableCell>
                      <TableCell>{p.due_date ? format(new Date(p.due_date), 'dd MMM') : '-'}</TableCell>
                      <TableCell>{p.paid_date ? format(new Date(p.paid_date), 'dd MMM') : '-'}</TableCell>
                      <TableCell className="capitalize">{p.payment_mode?.replace('_', ' ') || '-'}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[p.status] || ''}>{p.status}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteComponent('payments', p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Emails</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No emails</TableCell></TableRow>
                  ) : emails.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.subject}</TableCell>
                      <TableCell>{e.to_email || '-'}</TableCell>
                      <TableCell>{e.suppliers?.name || '-'}</TableCell>
                      <TableCell className="capitalize">{e.template_type?.replace('_', ' ') || '-'}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[e.status] || ''}>{e.status}</Badge></TableCell>
                      <TableCell>{e.sent_at ? format(new Date(e.sent_at), 'dd MMM HH:mm') : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logs.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground">No activity yet</p>
                ) : logs.map((l) => (
                  <div key={l.id} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium">{l.action.replace(/_/g, ' ')}</span>
                      {l.details && (
                        <span className="text-muted-foreground ml-2">
                          {Object.entries(l.details)
                            .filter(([k, v]) => v && k !== 'component_id')
                            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                            .join(' | ')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {l.users?.full_name || 'System'} &bull; {format(new Date(l.created_at), 'dd MMM HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
