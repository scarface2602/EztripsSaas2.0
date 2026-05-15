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
  CheckCircle2, Trash2, Save, Package, ChevronDown, ChevronUp,
  Hotel, Plane, Car, MapPin, UtensilsCrossed, Briefcase,
} from 'lucide-react';
import { format } from 'date-fns';
import type { BookingItem, SupplierStatus } from '@/lib/types/booking-items';
import {
  ITEM_TYPE_LABELS, SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS, STATUS_TRANSITIONS,
} from '@/lib/types/booking-items';

const BOOKING_STATUS_COLORS: Record<string, string> = {
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
  package: 'Package', hotel: 'Hotel', land: 'Land Services', flight: 'Flight',
};

const ITEM_ICONS: Record<string, typeof Hotel> = {
  hotel_room: Hotel, flight_segment: Plane, transfer: Car,
  activity: MapPin, meal_plan: UtensilsCrossed, dmc_package: Briefcase,
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
  const [items, setItems] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [refNumber, setRefNumber] = useState('');
  const [blockingRef, setBlockingRef] = useState('');
  const [blockingExpires, setBlockingExpires] = useState('');
  const [notes, setNotes] = useState('');

  // Item expand state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bRes, pRes, lRes, eRes, iRes] = await Promise.all([
      supabase.from('bookings').select('*, clients(full_name, phone, email), suppliers(name), proposals(title, quote_type)').eq('id', id).single(),
      supabase.from('booking_payments').select('*').eq('booking_id', id).order('installment_number'),
      supabase.from('booking_logs').select('*, users(full_name)').eq('booking_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('booking_emails').select('*, suppliers(name)').eq('booking_id', id).order('created_at', { ascending: false }),
      supabase.from('booking_items').select('*').eq('booking_id', id).order('sort_order').order('start_date'),
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
    setItems((iRes.data || []) as BookingItem[]);
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

  const updateItem = async (itemId: string, updates: Record<string, unknown>) => {
    await fetch(`/api/bookings/${id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, ...updates }),
    });
    fetchAll();
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/bookings/${id}/items?item_id=${itemId}`, { method: 'DELETE' });
    fetchAll();
  };

  const markPayment = async (paymentId: string, status: string) => {
    await fetch(`/api/bookings/${id}/payments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_id: paymentId, status,
        ...(status === 'paid' ? { paid_date: new Date().toISOString().split('T')[0] } : {}),
      }),
    });
    fetchAll();
  };

  const deletePayment = async (paymentId: string) => {
    await fetch(`/api/bookings/${id}/payments?payment_id=${paymentId}`, { method: 'DELETE' });
    fetchAll();
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading booking...</div>;
  if (!booking) return <div className="flex items-center justify-center h-64 text-muted-foreground">Booking not found</div>;

  const margin = Number(booking.sell_price) - Number(booking.cost_price);
  const marginPct = Number(booking.sell_price) > 0 ? (margin / Number(booking.sell_price) * 100).toFixed(1) : '0';
  const balance = Number(booking.cost_price) - Number(booking.total_paid);

  const pendingCount = items.filter(i => i.supplier_status === 'pending' || i.supplier_status === 'confirmation_requested').length;
  const confirmedCount = items.filter(i => i.supplier_status === 'confirmed' || i.supplier_status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header — buttons on top */}
      <div className="flex items-start justify-between">
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

      {/* Summary Cards — full width row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

      {/* Confirmation Progress Bar */}
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Confirmations:</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2.5">
            <div
              className="bg-green-500 h-2.5 rounded-full transition-all"
              style={{ width: `${items.length > 0 ? (confirmedCount / items.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-sm font-medium">
            {confirmedCount}/{items.length} confirmed
            {pendingCount > 0 && <span className="text-red-600 ml-2">({pendingCount} pending)</span>}
          </span>
        </div>
      )}

      {/* Main content — Tabs stacked vertically */}
      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items" className="gap-1"><Package className="h-3.5 w-3.5" /> Items & Confirmations ({items.length})</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="details" className="gap-1"><FileText className="h-3.5 w-3.5" /> Details</TabsTrigger>
          <TabsTrigger value="emails" className="gap-1"><Mail className="h-3.5 w-3.5" /> Emails ({emails.length})</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1"><Clock className="h-3.5 w-3.5" /> Activity Log</TabsTrigger>
        </TabsList>

        {/* Items & Confirmations Tab — the main ops view */}
        <TabsContent value="items" className="space-y-3 mt-4">
          {items.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No items. Items are auto-created when a booking is made from a proposal.</CardContent></Card>
          ) : items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              currency={booking.currency}
              isExpanded={expandedItemId === item.id}
              onToggle={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
              onUpdateStatus={(status, vendorData) => updateItem(item.id, { supplier_status: status, ...vendorData })}
              onDelete={() => deleteItem(item.id)}
            />
          ))}

          {/* Items total summary */}
          {items.length > 0 && (
            <div className="flex justify-end gap-6 text-sm text-muted-foreground pt-2">
              <span>Total Cost: <strong className="text-foreground">{booking.currency} {items.reduce((s, i) => s + Number(i.cost_price || 0), 0).toLocaleString()}</strong></span>
              <span>Total Sell: <strong className="text-foreground">{booking.currency} {items.reduce((s, i) => s + Number(i.sell_price || 0), 0).toLocaleString()}</strong></span>
            </div>
          )}
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
                      <TableCell><Badge className={BOOKING_STATUS_COLORS[p.status] || ''}>{p.status}</Badge></TableCell>
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

        {/* Emails Tab */}
        <TabsContent value="emails">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Supplier Emails</CardTitle></CardHeader>
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
                      <TableCell><Badge className={BOOKING_STATUS_COLORS[e.status] || ''}>{e.status}</Badge></TableCell>
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
            <CardHeader className="pb-2"><CardTitle className="text-base">Activity Log</CardTitle></CardHeader>
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

/* ─────────────────────────────────────────────────────────
   ItemCard — each booking item as an expandable card
   Shows: type icon, label, dates, status badge, cost/sell
   Expands to show: item details (read-only from proposal),
   status update workflow with vendor tracking prompts
   ───────────────────────────────────────────────────────── */

function ItemCard({
  item, currency, isExpanded, onToggle, onUpdateStatus, onDelete,
}: {
  item: BookingItem;
  currency: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (status: SupplierStatus, vendorData: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const Icon = ITEM_ICONS[item.item_type] || Package;
  const nextStatuses = STATUS_TRANSITIONS[item.supplier_status] || [];

  // Local state for vendor tracking fields (prompted on status change)
  const [pendingStatus, setPendingStatus] = useState<SupplierStatus | null>(null);
  const [vendorName, setVendorName] = useState(item.vendor_name || '');
  const [vendorEmail, setVendorEmail] = useState(item.vendor_email || '');
  const [portalName, setPortalName] = useState(item.portal_name || '');
  const [paymentDueDate, setPaymentDueDate] = useState(item.payment_due_date || '');
  const [supplierRef, setSupplierRef] = useState(item.supplier_reference || '');
  const [supplierNotes, setSupplierNotes] = useState(item.supplier_notes || '');

  const handleStatusClick = (status: SupplierStatus) => {
    // Statuses that need extra info before saving
    if (['confirmation_requested', 'on_hold', 'confirmed'].includes(status)) {
      setPendingStatus(status);
    } else {
      onUpdateStatus(status, {});
    }
  };

  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    onUpdateStatus(pendingStatus, {
      vendor_name: vendorName || null,
      vendor_email: vendorEmail || null,
      portal_name: portalName || null,
      payment_due_date: paymentDueDate || null,
      supplier_reference: supplierRef || null,
      supplier_notes: supplierNotes || null,
    });
    setPendingStatus(null);
  };

  const details = item.details as Record<string, unknown>;

  // Build a readable summary from details
  const detailSummary = buildDetailSummary(item.item_type, details);

  return (
    <Card className={`${item.supplier_status === 'confirmed' || item.supplier_status === 'completed' ? 'border-green-200' : item.supplier_status === 'pending' ? 'border-red-200' : 'border-yellow-200'}`}>
      {/* Collapsed header row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{item.label}</span>
            <Badge variant="outline" className="shrink-0 text-xs">{ITEM_TYPE_LABELS[item.item_type]}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {item.start_date && <span>{format(new Date(item.start_date), 'dd MMM yyyy')}{item.end_date && item.end_date !== item.start_date ? ` – ${format(new Date(item.end_date), 'dd MMM yyyy')}` : ''}</span>}
            {detailSummary && <span>· {detailSummary}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {item.cost_price != null && (
            <span className="text-sm text-muted-foreground">{currency} {Number(item.cost_price).toLocaleString()}</span>
          )}
          <Badge className={SUPPLIER_STATUS_COLORS[item.supplier_status]}>
            {SUPPLIER_STATUS_LABELS[item.supplier_status]}
          </Badge>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <CardContent className="border-t pt-4 space-y-4">
          {/* Item details from proposal (read-only) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(details).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-muted-foreground">{k.replace(/_/g, ' ')}</p>
                <p className="text-sm font-medium">
                  {Array.isArray(v) ? v.join(', ') : String(v)}
                </p>
              </div>
            ))}
            <div>
              <p className="text-xs text-muted-foreground">Cost Price</p>
              <p className="text-sm font-medium">{item.cost_price != null ? `${currency} ${Number(item.cost_price).toLocaleString()}` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sell Price</p>
              <p className="text-sm font-medium">{item.sell_price != null ? `${currency} ${Number(item.sell_price).toLocaleString()}` : '-'}</p>
            </div>
          </div>

          {/* Vendor tracking info (if filled) */}
          {(item.vendor_name || item.vendor_email || item.portal_name || item.payment_due_date || item.supplier_reference) && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Vendor & Confirmation</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {item.vendor_name && <div><span className="text-xs text-muted-foreground">Vendor</span><p className="font-medium">{item.vendor_name}</p></div>}
                {item.vendor_email && <div><span className="text-xs text-muted-foreground">Email</span><p className="font-medium">{item.vendor_email}</p></div>}
                {item.portal_name && <div><span className="text-xs text-muted-foreground">Portal</span><p className="font-medium">{item.portal_name}</p></div>}
                {item.payment_due_date && <div><span className="text-xs text-muted-foreground">Payment Due</span><p className="font-medium">{format(new Date(item.payment_due_date), 'dd MMM yyyy')}</p></div>}
                {item.supplier_reference && <div><span className="text-xs text-muted-foreground">Ref / Confirmation #</span><p className="font-medium font-mono">{item.supplier_reference}</p></div>}
              </div>
            </div>
          )}

          {/* Status change prompt */}
          {pendingStatus && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800">
                Update to: {SUPPLIER_STATUS_LABELS[pendingStatus]}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {pendingStatus === 'confirmation_requested' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Vendor / Supplier Name</Label>
                      <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. TBO, Via.com, Direct" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mail Sent To (email)</Label>
                      <Input value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} placeholder="vendor@example.com" />
                    </div>
                  </>
                )}
                {pendingStatus === 'on_hold' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Blocked On Portal</Label>
                      <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder="e.g. TBO, Booking.com, Direct" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Payment Due Date</Label>
                      <Input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vendor / Supplier</Label>
                      <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Supplier Reference</Label>
                      <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Booking ref / hold ID" />
                    </div>
                  </>
                )}
                {pendingStatus === 'confirmed' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Confirmation / PNR #</Label>
                      <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Confirmation number" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vendor / Supplier</Label>
                      <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Payment Due Date</Label>
                      <Input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} />
                    </div>
                  </>
                )}
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Input value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} placeholder="Any additional notes..." />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmStatusChange}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPendingStatus(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Status action buttons */}
          {!pendingStatus && nextStatuses.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Update status:</span>
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  className={s === 'confirmed' ? 'border-green-300 text-green-700 hover:bg-green-50' : s === 'cancelled' ? 'border-red-300 text-red-700 hover:bg-red-50' : ''}
                  onClick={() => handleStatusClick(s)}
                >
                  {SUPPLIER_STATUS_LABELS[s]}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="text-red-500 ml-auto" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
            </div>
          )}

          {/* Inline edit for supplier notes */}
          {item.supplier_notes && !pendingStatus && (
            <p className="text-xs text-muted-foreground italic">Notes: {item.supplier_notes}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function buildDetailSummary(itemType: string, details: Record<string, unknown>): string {
  switch (itemType) {
    case 'hotel_room': {
      const parts: string[] = [];
      if (details.room_type) parts.push(String(details.room_type));
      if (details.meal_plan) parts.push(String(details.meal_plan));
      if (details.nights) parts.push(`${details.nights}N`);
      return parts.join(' · ');
    }
    case 'flight_segment': {
      const parts: string[] = [];
      if (details.airline) parts.push(String(details.airline));
      if (details.cabin_class) parts.push(String(details.cabin_class));
      return parts.join(' · ');
    }
    case 'transfer':
      return details.vehicle_type ? String(details.vehicle_type) : '';
    case 'dmc_package': {
      const count = (Number(details.activity_count) || 0) + (Number(details.line_item_count) || 0);
      return count > 0 ? `${count} components` : '';
    }
    default:
      return details.location ? String(details.location) : '';
  }
}
