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
  CheckCircle2, Trash2, Save, Package, Plus, Pencil,
} from 'lucide-react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { BookingItem, ItemType, SupplierStatus } from '@/lib/types/booking-items';
import { ITEM_TYPE_LABELS, SUPPLIER_STATUS_COLORS } from '@/lib/types/booking-items';

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
  const [items, setItems] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BookingItem | null>(null);

  // Editable fields
  const [refNumber, setRefNumber] = useState('');
  const [blockingRef, setBlockingRef] = useState('');
  const [blockingExpires, setBlockingExpires] = useState('');
  const [notes, setNotes] = useState('');

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

  const saveItem = async (itemData: Record<string, unknown>) => {
    if (editingItem) {
      await fetch(`/api/bookings/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: editingItem.id, ...itemData }),
      });
    } else {
      await fetch(`/api/bookings/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });
    }
    setItemSheetOpen(false);
    setEditingItem(null);
    fetchAll();
  };

  const markItemConfirmed = async (itemId: string) => {
    await fetch(`/api/bookings/${id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, supplier_status: 'confirmed' }),
    });
    fetchAll();
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/bookings/${id}/items?item_id=${itemId}`, { method: 'DELETE' });
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
          <TabsTrigger value="items" className="gap-1"><Package className="h-3.5 w-3.5" /> Items ({items.length})</TabsTrigger>
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

        {/* Items & Confirmations Tab */}
        <TabsContent value="items">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Items & Confirmations</CardTitle>
              <Button size="sm" onClick={() => { setEditingItem(null); setItemSheetOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Sell</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Supplier Ref</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No items yet. Add flights, hotels, transfers, and activities.</TableCell></TableRow>
                  ) : items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell><Badge variant="outline">{ITEM_TYPE_LABELS[item.item_type]}</Badge></TableCell>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell className="text-sm">
                        {item.start_date ? format(new Date(item.start_date), 'dd MMM') : '-'}
                        {item.end_date && item.end_date !== item.start_date ? ` – ${format(new Date(item.end_date), 'dd MMM')}` : ''}
                      </TableCell>
                      <TableCell>{item.cost_price != null ? `${booking.currency} ${Number(item.cost_price).toLocaleString()}` : '-'}</TableCell>
                      <TableCell>{item.sell_price != null ? `${booking.currency} ${Number(item.sell_price).toLocaleString()}` : '-'}</TableCell>
                      <TableCell><Badge className={SUPPLIER_STATUS_COLORS[item.supplier_status]}>{item.supplier_status}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{item.supplier_reference || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(item); setItemSheetOpen(true); }} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {item.supplier_status !== 'confirmed' && item.supplier_status !== 'completed' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => markItemConfirmed(item.id)} title="Mark Confirmed">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteItem(item.id)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {items.length > 0 && (
                <div className="mt-4 flex justify-end gap-6 text-sm text-muted-foreground">
                  <span>Total Cost: <strong className="text-foreground">{booking.currency} {items.reduce((s, i) => s + Number(i.cost_price || 0), 0).toLocaleString()}</strong></span>
                  <span>Total Sell: <strong className="text-foreground">{booking.currency} {items.reduce((s, i) => s + Number(i.sell_price || 0), 0).toLocaleString()}</strong></span>
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

      {/* Add/Edit Item Sheet */}
      <Sheet open={itemSheetOpen} onOpenChange={(open) => { setItemSheetOpen(open); if (!open) setEditingItem(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingItem ? 'Edit Item' : 'Add Item'}</SheetTitle>
          </SheetHeader>
          <ItemForm
            item={editingItem}
            onSave={saveItem}
            onCancel={() => { setItemSheetOpen(false); setEditingItem(null); }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ItemForm({ item, onSave, onCancel }: {
  item: BookingItem | null;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [itemType, setItemType] = useState<ItemType>(item?.item_type as ItemType || 'hotel_room');
  const [label, setLabel] = useState(item?.label || '');
  const [startDate, setStartDate] = useState(item?.start_date || '');
  const [endDate, setEndDate] = useState(item?.end_date || '');
  const [costPrice, setCostPrice] = useState(item?.cost_price?.toString() || '');
  const [sellPrice, setSellPrice] = useState(item?.sell_price?.toString() || '');
  const [supplierStatus, setSupplierStatus] = useState<SupplierStatus>(item?.supplier_status || 'pending');
  const [supplierRef, setSupplierRef] = useState(item?.supplier_reference || '');
  const [supplierNotes, setSupplierNotes] = useState(item?.supplier_notes || '');
  const [details, setDetails] = useState<Record<string, unknown>>(item?.details || {});

  const handleSubmit = () => {
    if (!label.trim()) return;
    onSave({
      item_type: itemType,
      label: label.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      cost_price: costPrice ? parseFloat(costPrice) : null,
      sell_price: sellPrice ? parseFloat(sellPrice) : null,
      supplier_status: supplierStatus,
      supplier_reference: supplierRef || null,
      supplier_notes: supplierNotes || null,
      details,
    });
  };

  const detailFields: Record<ItemType, { key: string; label: string; type?: string }[]> = {
    flight_segment: [
      { key: 'airline', label: 'Airline' },
      { key: 'flight_number', label: 'Flight Number' },
      { key: 'route', label: 'Route' },
      { key: 'departure_time', label: 'Departure Time' },
      { key: 'arrival_time', label: 'Arrival Time' },
      { key: 'seat', label: 'Seat' },
      { key: 'pnr', label: 'PNR' },
    ],
    hotel_room: [
      { key: 'hotel_name', label: 'Hotel Name' },
      { key: 'room_type', label: 'Room Type' },
      { key: 'nights', label: 'Nights', type: 'number' },
      { key: 'rooms_count', label: 'Rooms', type: 'number' },
      { key: 'meal_plan', label: 'Meal Plan' },
      { key: 'conf_number', label: 'Confirmation #' },
    ],
    transfer: [
      { key: 'from_location', label: 'From' },
      { key: 'to_location', label: 'To' },
      { key: 'vehicle_type', label: 'Vehicle Type' },
      { key: 'pickup_time', label: 'Pickup Time' },
      { key: 'notes', label: 'Notes' },
    ],
    activity: [
      { key: 'activity_name', label: 'Activity Name' },
      { key: 'time', label: 'Time' },
      { key: 'duration_hours', label: 'Duration (hrs)', type: 'number' },
      { key: 'location', label: 'Location' },
      { key: 'guide_name', label: 'Guide Name' },
      { key: 'activity_ref', label: 'Activity Ref' },
    ],
    meal_plan: [
      { key: 'location', label: 'Location' },
      { key: 'meals_included', label: 'Meals Included' },
      { key: 'notes', label: 'Notes' },
    ],
  };

  const fields = detailFields[itemType] || [];

  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={itemType} onValueChange={(v) => setItemType(v as ItemType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="flight_segment">Flight</SelectItem>
            <SelectItem value="hotel_room">Hotel</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="activity">Activity</SelectItem>
            <SelectItem value="meal_plan">Meal Plan</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Label *</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Delhi to Goa — IndiGo 6E-204" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Cost Price</Label>
          <Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label>Sell Price</Label>
          <Input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="0.00" />
        </div>
      </div>

      {/* Dynamic detail fields */}
      {fields.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium text-muted-foreground">{ITEM_TYPE_LABELS[itemType]} Details</p>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type={f.type || 'text'}
                  value={(details[f.key] as string) || ''}
                  onChange={(e) => setDetails({ ...details, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Supplier Status</p>
        <Select value={supplierStatus} onValueChange={(v) => setSupplierStatus(v as SupplierStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="modified">Modified</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <div className="space-y-2">
          <Label>Supplier Reference</Label>
          <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Confirmation / PNR / Ref #" />
        </div>
        <div className="space-y-2">
          <Label>Supplier Notes</Label>
          <Textarea value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} rows={2} placeholder="Internal supplier notes..." />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} className="flex-1">
          <Save className="h-3.5 w-3.5 mr-1" /> {item ? 'Update' : 'Add'} Item
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
