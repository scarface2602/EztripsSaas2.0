'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, CreditCard, Clock, Mail, FileText,
  CheckCircle2, Trash2, Save,
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  blocked: 'bg-purple-100 text-purple-700',
  confirmed: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
};

const TYPE_LABELS: Record<string, string> = {
  package: 'Package',
  hotel: 'Hotel',
  land: 'Land Services',
  flight: 'Flight',
};

interface Booking {
  id: string;
  proposal_id: string | null;
  title: string;
  booking_type: string;
  reference_number: string | null;
  destination: string | null;
  status: string;
  travel_start: string | null;
  travel_end: string | null;
  pax_adults: number;
  pax_children: number;
  sell_price: number;
  cost_price: number;
  total_paid: number;
  next_payment_date: string | null;
  next_payment_amount: number | null;
  currency: string;
  blocking_reference: string | null;
  blocking_expires_at: string | null;
  internal_notes: string | null;
  created_at: string;
  clients: { full_name: string; phone: string | null; email: string | null } | null;
  suppliers: { name: string } | null;
  proposals: { title: string; quote_type: string } | null;
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [booking, setBooking] = useState<Booking | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [payments, setPayments] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emails, setEmails] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [refNumber, setRefNumber] = useState('');
  const [blockingRef, setBlockingRef] = useState('');
  const [blockingExpires, setBlockingExpires] = useState('');
  const [notes, setNotes] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bRes, pRes, lRes, eRes] = await Promise.all([
      supabase.from('bookings').select('*, clients(full_name, phone, email), suppliers(name), proposals(title, quote_type)').eq('id', id).single(),
      supabase.from('booking_payments').select('*').eq('booking_id', id).order('installment_number'),
      supabase.from('booking_logs').select('*, users(full_name)').eq('booking_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('booking_emails').select('*, suppliers(name)').eq('booking_id', id).order('created_at', { ascending: false }),
    ]);
    const b = bRes.data as Booking;
    setBooking(b);
    if (b) {
      setRefNumber(b.reference_number || '');
      setBlockingRef(b.blocking_reference || '');
      setBlockingExpires(b.blocking_expires_at ? b.blocking_expires_at.split('T')[0] : '');
      setNotes(b.internal_notes || '');
    }
    setPayments(pRes.data || []);
    setLogs(lRes.data || []);
    setEmails(eRes.data || []);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateBooking = async (updates: Record<string, unknown>) => {
    setSaving(true);
    await fetch('/api/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    await fetchAll();
    setSaving(false);
  };

  const saveDetails = () => {
    updateBooking({
      reference_number: refNumber || null,
      blocking_reference: blockingRef || null,
      blocking_expires_at: blockingExpires ? new Date(blockingExpires).toISOString() : null,
      internal_notes: notes || null,
    });
  };

  const markPayment = async (paymentId: string, status: string) => {
    await fetch(`/api/bookings/${id}/payments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_id: paymentId,
        status,
        ...(status === 'paid' ? { paid_date: new Date().toISOString().split('T')[0] } : {}),
      }),
    });
    fetchAll();
  };

  const deletePayment = async (paymentId: string) => {
    await fetch(`/api/bookings/${id}/payments?payment_id=${paymentId}`, { method: 'DELETE' });
    fetchAll();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading booking...</div>;
  }

  if (!booking) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Booking not found</div>;
  }

  const margin = Number(booking.sell_price) - Number(booking.cost_price);
  const marginPct = Number(booking.sell_price) > 0 ? (margin / Number(booking.sell_price) * 100).toFixed(1) : '0';
  const balance = Number(booking.cost_price) - Number(booking.total_paid);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/bookings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{booking.title}</h1>
              <Badge variant="outline">{TYPE_LABELS[booking.booking_type] || booking.booking_type}</Badge>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
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
          <p className="text-xl font-bold text-green-600">{booking.currency} {Number(booking.total_paid).toLocaleString()}</p>
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

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" className="gap-1"><FileText className="h-3.5 w-3.5" /> Details</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="emails" className="gap-1"><Mail className="h-3.5 w-3.5" /> Emails ({emails.length})</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1"><Clock className="h-3.5 w-3.5" /> Activity Log</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Booking Details</CardTitle>
              <Button size="sm" onClick={saveDetails} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" /> Save
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reference / Confirmation Number</Label>
                  <Input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} placeholder="Supplier confirmation #" />
                </div>
                <div className="space-y-2">
                  <Label>Pax</Label>
                  <Input disabled value={`${booking.pax_adults} Adults${booking.pax_children > 0 ? `, ${booking.pax_children} Children` : ''}`} />
                </div>
                {booking.booking_type === 'hotel' && (
                  <>
                    <div className="space-y-2">
                      <Label>Blocking Reference</Label>
                      <Input value={blockingRef} onChange={(e) => setBlockingRef(e.target.value)} placeholder="Hotel blocking ref" />
                    </div>
                    <div className="space-y-2">
                      <Label>Blocking Expires</Label>
                      <Input type="date" value={blockingExpires} onChange={(e) => setBlockingExpires(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Internal notes..." />
              </div>
              {booking.proposal_id && (
                <div className="text-sm text-muted-foreground">
                  From proposal: <span className="font-medium">{booking.proposals?.title || booking.proposal_id}</span>
                  {booking.proposals?.quote_type && ` (${booking.proposals.quote_type})`}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Payment Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No payment installments</TableCell></TableRow>
                  ) : payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.installment_number}</TableCell>
                      <TableCell className="font-medium">{p.installment_label || '-'}</TableCell>
                      <TableCell className="font-medium">{booking.currency} {Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell>{p.due_date ? format(new Date(p.due_date), 'dd MMM yyyy') : '-'}</TableCell>
                      <TableCell>{p.paid_date ? format(new Date(p.paid_date), 'dd MMM yyyy') : '-'}</TableCell>
                      <TableCell className="capitalize">{p.payment_mode?.replace('_', ' ') || '-'}</TableCell>
                      <TableCell className="text-xs font-mono">{p.reference_number || '-'}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[p.status] || ''}>{p.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.status === 'pending' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => markPayment(p.id, 'paid')} title="Mark paid">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deletePayment(p.id)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
              <CardTitle className="text-base">Supplier Emails</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No emails</TableCell></TableRow>
                  ) : emails.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.subject}</TableCell>
                      <TableCell>{e.to_email || '-'}</TableCell>
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
                            .filter(([, v]) => v)
                            .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                            .join(' | ')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {l.users?.full_name || 'System'} · {format(new Date(l.created_at), 'dd MMM HH:mm')}
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
