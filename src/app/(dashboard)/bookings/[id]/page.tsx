'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, CreditCard, Clock, Mail, FileText, Download, Loader2,
  CheckCircle2, Trash2, Save, Package, ChevronDown, ChevronUp,
  Hotel, Plane, Car, MapPin, UtensilsCrossed, Briefcase, Send, Bell, DollarSign,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { BookingFinancials } from '@/components/booking-financials';
import { BookingPassengers } from '@/components/booking-passengers';
import { PaymentLinkGenerator } from '@/components/payment-link-generator';
import { PaymentScheduleView } from '@/components/payment-schedule-view';
import { PaymentScheduleEditor } from '@/components/payment-schedule-editor';
import { PaymentScheduleSetup } from '@/components/payment-schedule-setup';
import { format } from 'date-fns';
import type { BookingItem, SupplierStatus } from '@/lib/types/booking-items';
import type { PaymentAccount } from '@/lib/types/database';
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
  min_confirmation_amount: number | null;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [packages, setPackages] = useState<any[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [generatingVoucher, setGeneratingVoucher] = useState<string | null>(null);
  // Mark-paid dialog state
  const [markPaidPaymentId, setMarkPaidPaymentId] = useState<string | null>(null);
  const [markPaidMode, setMarkPaidMode] = useState('bank_transfer');
  const [markPaidRef, setMarkPaidRef] = useState('');
  const [markPaidNotes, setMarkPaidNotes] = useState('');
  const [markPaidApprovedBy, setMarkPaidApprovedBy] = useState('');
  const [markPaidAccountId, setMarkPaidAccountId] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [refNumber, setRefNumber] = useState('');
  const [blockingRef, setBlockingRef] = useState('');
  const [blockingExpires, setBlockingExpires] = useState('');
  const [notes, setNotes] = useState('');
  const [minConfirmationAmount, setMinConfirmationAmount] = useState('');

  // Tab + item expand state
  const [activeTab, setActiveTab] = useState<'items' | 'payments' | 'financials' | 'vouchers' | 'details' | 'passengers' | 'emails' | 'logs'>('payments');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ amount: '', payment_mode: '', payment_date: new Date().toISOString().split('T')[0], reference_number: '', notes: '' });
  const [receiptLoading, setReceiptLoading] = useState(false);

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
      setMinConfirmationAmount(b.min_confirmation_amount ? String(b.min_confirmation_amount) : '');
    }
    setPayments(pRes.data || []);
    setLogs(lRes.data || []);
    setEmails(eRes.data || []);
    setItems((iRes.data || []) as BookingItem[]);

    // Fetch packages, payment accounts, and vouchers
    try {
      const [detailsRes, voucherRes] = await Promise.all([
        fetch(`/api/bookings/${id}/details`),
        fetch(`/api/bookings/${id}/vouchers`),
      ]);
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        setPackages(detailsData.packages || []);
        setPaymentAccounts(detailsData.paymentAccounts || []);
      }
      if (voucherRes.ok) {
        setVouchers(await voucherRes.json());
      }
      // Fetch team members (managers/admins) for approval dropdown
      const { data: members } = await supabase
        .from('users')
        .select('id, full_name, role, email')
        .in('role', ['manager', 'super_admin', 'accounts'])
        .order('full_name');
      setTeamMembers(members || []);
    } catch {
      // Details/vouchers endpoint might not exist for older bookings
    }

    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateBooking = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        toast.success('Booking updated');
      } else {
        toast.error('Failed to update booking');
      }
    } catch {
      toast.error('Failed to update booking');
    }
    await fetchAll();
    setSaving(false);
  };

  const saveDetails = () => {
    updateBooking({
      reference_number: refNumber || null,
      blocking_reference: blockingRef || null,
      blocking_expires_at: blockingExpires ? new Date(blockingExpires).toISOString() : null,
      internal_notes: notes || null,
      min_confirmation_amount: minConfirmationAmount ? Number(minConfirmationAmount) : null,
    });
  };

  const updateItem = async (itemId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/bookings/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, ...updates }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to update item');
        return;
      }
      if (updates.supplier_status) {
        toast.success(`Status updated to ${updates.supplier_status}`);
      }
    } catch {
      toast.error('Failed to update item');
    }
    fetchAll();
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/bookings/${id}/items?item_id=${itemId}`, { method: 'DELETE' });
    fetchAll();
  };

  const markPayment = async (paymentId: string, status: string) => {
    try {
      await fetch(`/api/bookings/${id}/payments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: paymentId, status,
          ...(status === 'paid' ? { paid_date: new Date().toISOString().split('T')[0] } : {}),
        }),
      });
      toast.success(status === 'paid' ? 'Payment marked as paid' : 'Payment status updated');
    } catch {
      toast.error('Failed to update payment');
    }
    fetchAll();
  };

  const deletePayment = async (paymentId: string) => {
    await fetch(`/api/bookings/${id}/payments?payment_id=${paymentId}`, { method: 'DELETE' });
    fetchAll();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePaymentsChange = (packageId: string, payments: any[]) => {
    setPackages((prev) =>
      prev.map((pkg) =>
        pkg.id === packageId ? { ...pkg, payments: payments.map((p, i) => ({ ...p, sequence: i + 1 })) } : pkg
      )
    );
  };

  const handleSavePaymentSchedule = async (packageId: string) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/booking-packages/${packageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payments: pkg.payments.map((p: { id?: string; sequence: number; amount: number; due_date: string; reference_number?: string; paid_from_account_id?: string; notes?: string }) => ({
            id: p.id,
            sequence: p.sequence,
            amount: p.amount,
            due_date: p.due_date,
            reference_number: p.reference_number || '',
            paid_from_account_id: p.paid_from_account_id || null,
            notes: p.notes || null,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save payment schedule');

      toast.success('Payment schedule saved');
      setEditingPackageId(null);
      await fetchAll();
    } catch (error) {
      toast.error('Failed to save payment schedule');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const openMarkPaidDialog = (paymentId: string) => {
    setMarkPaidPaymentId(paymentId);
    setMarkPaidMode('bank_transfer');
    setMarkPaidRef('');
    setMarkPaidNotes('');
    setMarkPaidApprovedBy('');
    setMarkPaidAccountId('');
  };

  const handleConfirmMarkPaid = async () => {
    if (!markPaidPaymentId) return;
    setSaving(true);
    try {
      const payment = packages
        .flatMap((p: { payments: Array<{ id: string; package_id: string; amount: number }> }) => p.payments)
        .find((p: { id: string }) => p.id === markPaidPaymentId);
      if (!payment) return;

      const res = await fetch(`/api/booking-packages/${payment.package_id}/payments/${markPaidPaymentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          amount_paid: payment.amount,
          paid_date: new Date().toISOString().split('T')[0],
          payment_mode: markPaidMode,
          reference_number: markPaidRef || null,
          notes: markPaidNotes || null,
          approved_by: markPaidApprovedBy || null,
          paid_from_account_id: markPaidAccountId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to mark paid');

      await fetchAll();
      toast.success('Payment marked as paid');
      setMarkPaidPaymentId(null);
    } catch (error) {
      toast.error('Failed to update payment');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const generateVoucher = async (item: BookingItem, sendEmail = false) => {
    if (!booking) return;
    setGeneratingVoucher(item.id);

    // Determine payment status: fully paid = confirmed, otherwise = blocked
    const totalCost = Number(booking.cost_price);
    const totalPaidPkg = packages.reduce((sum: number, pkg: { payments?: Array<{ status: string; amount_paid?: number }> }) =>
      sum + (pkg.payments || [])
        .filter((p: { status: string }) => p.status === 'paid')
        .reduce((s: number, p: { amount_paid?: number }) => s + Number(p.amount_paid || 0), 0)
    , 0);
    const isFullyPaid = totalPaidPkg >= totalCost && totalCost > 0;
    const voucherStatus = isFullyPaid ? 'confirmed' : 'blocked';

    const details = item.details as Record<string, unknown>;
    const clientName = booking.clients?.full_name || 'Guest';
    const confirmationRef = item.supplier_reference || '';

    // Map item_type to supplier_type and build content
    let supplierType = '';
    let content: Record<string, unknown> = {};

    switch (item.item_type) {
      case 'hotel_room':
        supplierType = 'hotel';
        content = {
          customerName: clientName,
          hotelName: (details.hotel_name as string) || item.label,
          checkInDate: (details.check_in as string) || item.start_date || '',
          checkOutDate: (details.check_out as string) || item.end_date || '',
          checkInTime: (details.check_in_time as string) || '',
          checkOutTime: (details.check_out_time as string) || '',
          roomType: (details.room_type as string) || '',
          numberOfRooms: (details.number_of_rooms as number) || undefined,
          guestNames: (details.guest_names as string[]) || [],
          mealPlan: (details.meal_plan as string) || '',
          confirmationNumber: confirmationRef,
          hotelSupportPhone: (details.hotel_support_phone as string) || '',
          specialRequests: item.supplier_notes || '',
        };
        break;
      case 'flight_segment':
        supplierType = 'flight';
        content = {
          customerName: clientName,
          airline: (details.airline as string) || '',
          flightNumber: (details.flight_number as string) || '',
          route: `${(details.departure_city as string) || ''} → ${(details.arrival_city as string) || ''}`,
          departureTime: (details.departure_datetime as string) || (details.departure_date as string) || item.start_date || '',
          arrivalTime: (details.arrival_datetime as string) || (details.arrival_date as string) || item.end_date || '',
          confirmationNumber: confirmationRef,
        };
        break;
      case 'vehicle':
        supplierType = 'vehicle';
        content = {
          customerName: clientName,
          vehicleBrand: (details.vehicle_brand as string) || '',
          vehicleType: (details.vehicle_type as string) || '',
          pickupLocation: (details.pickup_location as string) || '',
          dropoffLocation: (details.dropoff_location as string) || '',
          pickupDatetime: (details.pickup_datetime as string) || item.start_date || '',
          dropoffDatetime: (details.dropoff_datetime as string) || item.end_date || '',
          availabilityMode: (details.availability_type as string) || '',
          dailyHours: (details.daily_start_time as string) && (details.daily_end_time as string)
            ? `${details.daily_start_time} – ${details.daily_end_time}`
            : '',
          driverName: (details.driver_name as string) || (item as unknown as Record<string, unknown>).driver_name as string || '',
          confirmationNumber: confirmationRef,
          itinerary: (details.itinerary as Array<Record<string, string>>) || [],
        };
        break;
      case 'transfer':
        supplierType = 'transfer';
        content = {
          customerName: clientName,
          pickupTime: item.start_date || '',
          pickupLocation: (details.pickup_location as string) || (details.description as string) || '',
          dropoffLocation: (details.dropoff_location as string) || '',
          vehicleType: (details.vehicle_type as string) || '',
          serviceProviderName: (details.service_provider_name as string) || '',
          serviceProviderContact: (details.service_provider_contact as string) || '',
          driverName: (details.driver_name as string) || '',
          driverContact: (details.driver_contact as string) || '',
          confirmationNumber: confirmationRef,
        };
        break;
      case 'activity':
      default:
        supplierType = 'activity';
        content = {
          customerName: clientName,
          activityName: (details.description as string) || item.label,
          activityDate: item.start_date || '',
          confirmationNumber: confirmationRef,
        };
        break;
    }

    try {
      const res = await fetch(`/api/bookings/${id}/vouchers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_type: supplierType,
          content,
          voucher_status: voucherStatus,
          send_email: sendEmail,
          email_to: booking.clients?.email || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate voucher');
      }

      toast.success(sendEmail ? 'Voucher generated & emailed' : 'Voucher generated');
      await fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate voucher');
      console.error(error);
    } finally {
      setGeneratingVoucher(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading booking...</div>;
  if (!booking) return <div className="flex items-center justify-center h-64 text-muted-foreground">Booking not found</div>;

  const margin = Number(booking.sell_price) - Number(booking.cost_price);
  const marginPct = Number(booking.sell_price) > 0 ? (margin / Number(booking.sell_price) * 100).toFixed(1) : '0';
  // Compute total paid from package payments (new system) since the DB trigger may not have fired yet
  const totalPaidFromPackages = packages.reduce((sum, pkg) =>
    sum + (pkg.payments || [])
      .filter((p: { status: string }) => p.status === 'paid')
      .reduce((s: number, p: { amount_paid: number }) => s + Number(p.amount_paid || 0), 0)
  , 0);
  const effectiveTotalPaid = Math.max(Number(booking.total_paid), totalPaidFromPackages);
  const balance = Number(booking.cost_price) - effectiveTotalPaid;

  const pendingCount = items.filter(i => i.supplier_status === 'pending' || i.supplier_status === 'confirmation_requested').length;
  const confirmedCount = items.filter(i => i.supplier_status === 'confirmed' || i.supplier_status === 'completed').length;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Bookings', href: '/bookings' },
        { label: booking.title || 'Booking' },
      ]} />
      {/* Header — buttons on top */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
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

      {/* Section navigation — manual tab bar (same pattern as proposal editor) */}
      <div className="w-full">
        <div className="sticky top-0 z-10 flex flex-wrap gap-1 bg-muted p-1 rounded-lg">
          {([
            ['items', `Items & Confirmations (${items.length})`],
            ['payments', `Payments (${packages.reduce((sum, p) => sum + (p.payments?.length || 0), 0) || payments.length})`],
            ['financials', 'Financials'],
            ['vouchers', `Vouchers (${vouchers.length})`],
            ['details', 'Details'],
            ['passengers', 'Passengers'],
            ['emails', `Emails (${emails.length})`],
            ['logs', 'Activity Log'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {key === 'items' && <Package className="h-3.5 w-3.5" />}
              {key === 'payments' && <CreditCard className="h-3.5 w-3.5" />}
              {key === 'financials' && <DollarSign className="h-3.5 w-3.5" />}
              {key === 'details' && <FileText className="h-3.5 w-3.5" />}
              {key === 'emails' && <Mail className="h-3.5 w-3.5" />}
              {key === 'logs' && <Clock className="h-3.5 w-3.5" />}
              {label}
            </button>
          ))}
        </div>

        {/* Tab content — full width below */}
        <div className="mt-4 w-full">
          {/* Items & Confirmations */}
          {activeTab === 'items' && (
            <div className="space-y-3">
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
                  outstandingBalance={balance}
                />
              ))}
              {items.length > 0 && (
                <div className="flex justify-end gap-6 text-sm text-muted-foreground pt-2">
                  <span>Total Cost: <strong className="text-foreground">{booking.currency} {items.reduce((s, i) => s + Number(i.cost_price || 0), 0).toLocaleString()}</strong></span>
                  <span>Total Sell: <strong className="text-foreground">{booking.currency} {items.reduce((s, i) => s + Number(i.sell_price || 0), 0).toLocaleString()}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Payments */}
          {activeTab === 'payments' && (() => {
            // Packages with payments set up
            const packagesWithPayments = packages.filter((p) => p.payments && p.payments.length > 0);
            // Packages without payments (need setup)
            const packagesNeedingSetup = packages.filter((p) => !p.payments || p.payments.length === 0);

            return (
              <div className="space-y-4">
                {/* Existing payment schedules */}
                {packagesWithPayments.map((pkg, idx) => (
                  <Card key={pkg.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {packages.length > 1 ? `Package ${idx + 1}: ` : 'Payment Schedule: '}
                          {pkg.type === 'full_dmc' ? 'Full DMC' : pkg.type === 'partial_dmc' ? 'Partial DMC' : pkg.type === 'individual' ? 'Supplier Payment' : pkg.type}
                        </CardTitle>
                        <Badge variant="outline">₹{Number(pkg.total_cost).toLocaleString()}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editingPackageId !== pkg.id ? (
                        <>
                          <PaymentScheduleView
                            payments={pkg.payments}
                            packageTotal={Number(pkg.total_cost)}
                            onEditClick={() => setEditingPackageId(pkg.id)}
                            onMarkPaidClick={openMarkPaidDialog}
                            isBookingConfirmed={items.every(i => i.supplier_status === 'confirmed' || i.supplier_status === 'completed')}
                            renderUnpaidAction={(payment) => (
                              <SendReminderButton
                                bookingId={id}
                                clientEmail={booking.clients?.email || null}
                                amountDue={payment.amount - (payment.amount_paid || 0)}
                                dueDate={new Date(payment.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                onSent={fetchAll}
                              />
                            )}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPackageId(pkg.id)}
                            className="w-full"
                          >
                            Edit Payment Schedule
                          </Button>
                        </>
                      ) : (
                        <>
                          <PaymentScheduleEditor
                            packageTotal={Number(pkg.total_cost)}
                            initialPayments={pkg.payments}
                            paymentAccounts={paymentAccounts}
                            onPaymentsChange={(pmts) => handlePaymentsChange(pkg.id, pmts)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSavePaymentSchedule(pkg.id)}
                              className="flex-1"
                              disabled={saving}
                            >
                              {saving ? 'Saving...' : 'Save Payment Schedule'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditingPackageId(null); fetchAll(); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Packages that need payment setup */}
                {packagesNeedingSetup.map((pkg) => (
                  <PaymentScheduleSetup
                    key={pkg.id}
                    bookingId={id}
                    bookingTotal={Number(pkg.total_cost)}
                    paymentAccounts={paymentAccounts}
                    existingPackageId={pkg.id}
                    onSuccess={() => fetchAll()}
                  />
                ))}

                {/* No packages at all — show setup for full booking amount */}
                {packages.length === 0 && (
                  <PaymentScheduleSetup
                    bookingId={id}
                    bookingTotal={Number(booking.cost_price)}
                    paymentAccounts={paymentAccounts}
                    onSuccess={() => fetchAll()}
                  />
                )}

                {/* Legacy Payment Table (if exists and no packages) */}
                {payments.length > 0 && packages.length === 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base">Legacy Payments</CardTitle>
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
                          {payments.map((p) => (
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
                )}
              </div>
            );
          })()}

          {/* Payment Links */}
          {activeTab === 'payments' && (
            <div className="flex items-center gap-2">
              <PaymentLinkGenerator bookingId={id} currency={booking?.currency || 'INR'} />
            </div>
          )}

          {/* Documents — Invoice & Receipt */}
          {activeTab === 'payments' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={invoiceLoading}
                    onClick={async () => {
                      setInvoiceLoading(true);
                      try {
                        const res = await fetch(`/api/bookings/${id}/invoices`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ invoice_type: 'proforma' }),
                        });
                        if (res.ok) {
                          const invoice = await res.json();
                          if (invoice.pdf_url) window.open(invoice.pdf_url, '_blank');
                          toast.success(`Invoice ${invoice.invoice_number} generated`);
                        } else {
                          const err = await res.json();
                          toast.error(err.error || 'Failed to generate invoice');
                        }
                      } catch { toast.error('Failed to generate invoice'); }
                      setInvoiceLoading(false);
                    }}
                  >
                    {invoiceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Generate Proforma Invoice
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={invoiceLoading}
                    onClick={async () => {
                      setInvoiceLoading(true);
                      try {
                        const res = await fetch(`/api/bookings/${id}/invoices`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ invoice_type: 'final' }),
                        });
                        if (res.ok) {
                          const invoice = await res.json();
                          if (invoice.pdf_url) window.open(invoice.pdf_url, '_blank');
                          toast.success(`Invoice ${invoice.invoice_number} generated`);
                        } else {
                          const err = await res.json();
                          toast.error(err.error || 'Failed to generate invoice');
                        }
                      } catch { toast.error('Failed to generate invoice'); }
                      setInvoiceLoading(false);
                    }}
                  >
                    {invoiceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Generate Final Invoice
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setShowReceiptDialog(true)}
                  >
                    <Download className="h-4 w-4" /> Generate Receipt
                  </Button>
                </div>
                {/* Past invoices/receipts list */}
                <InvoiceReceiptList bookingId={id} />
              </CardContent>
            </Card>
          )}

          {/* Vouchers */}
          {/* Financials */}
          {activeTab === 'financials' && (
            <BookingFinancials bookingId={id} currency={booking.currency} />
          )}

          {activeTab === 'vouchers' && (
            <div className="space-y-4">
              {/* Generate vouchers from booking items */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Generate Vouchers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No booking items to generate vouchers for.</p>
                  )}
                  {items.map((item) => {
                    const Icon = ITEM_ICONS[item.item_type] || Package;
                    const isGenerating = generatingVoucher === item.id;
                    const existingVoucher = vouchers.find((v) =>
                      v.supplier_name && item.label && (
                        item.label.includes(v.supplier_name) || v.supplier_name.includes(item.label?.split(' ')[0] || '')
                      )
                    );
                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs">{ITEM_TYPE_LABELS[item.item_type]}</Badge>
                              <Badge className={SUPPLIER_STATUS_COLORS[item.supplier_status] + ' text-xs'}>
                                {SUPPLIER_STATUS_LABELS[item.supplier_status]}
                              </Badge>
                              {existingVoucher && (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                  Voucher issued
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isGenerating}
                            onClick={() => generateVoucher(item)}
                          >
                            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
                            {existingVoucher ? 'Regenerate' : 'Generate'}
                          </Button>
                          <Button
                            size="sm"
                            disabled={isGenerating || !booking.clients?.email}
                            onClick={() => generateVoucher(item, true)}
                            title={booking.clients?.email ? `Send to ${booking.clients.email}` : 'No client email'}
                          >
                            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
                            Generate & Email
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Payment status info */}
                  <div className={`p-3 rounded-lg text-sm ${effectiveTotalPaid >= Number(booking.cost_price) && Number(booking.cost_price) > 0 ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'}`}>
                    {effectiveTotalPaid >= Number(booking.cost_price) && Number(booking.cost_price) > 0 ? (
                      <p className="text-green-800 dark:text-green-200">Fully paid — vouchers will show <strong>CONFIRMED</strong> with confirmation numbers.</p>
                    ) : (
                      <p className="text-amber-800 dark:text-amber-200">Partially paid (₹{effectiveTotalPaid.toLocaleString()} / ₹{Number(booking.cost_price).toLocaleString()}) — vouchers will show <strong>BLOCKED</strong> without confirmation numbers.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Existing vouchers list */}
              {vouchers.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Issued Vouchers ({vouchers.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Issued</TableHead>
                          <TableHead>Emailed</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vouchers.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell className="capitalize">{v.supplier_type}</TableCell>
                            <TableCell className="font-medium">{v.supplier_name || '-'}</TableCell>
                            <TableCell className="font-mono text-xs">{v.booking_reference || '-'}</TableCell>
                            <TableCell className="text-sm">{v.created_at ? format(new Date(v.created_at), 'dd MMM yyyy HH:mm') : '-'}</TableCell>
                            <TableCell>
                              {v.email_sent_at ? (
                                <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                                  <Mail className="h-3 w-3 mr-1" /> Sent
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not sent</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {v.pdf_url && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(`/api/bookings/${id}/vouchers/${v.id}`, '_blank')}
                                >
                                  <Download className="h-3.5 w-3.5 mr-1" /> PDF
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Details */}
          {activeTab === 'details' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Booking Details</CardTitle>
                <Button size="sm" onClick={saveDetails} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min. Confirmation Amount</Label>
                    <Input
                      type="number"
                      value={minConfirmationAmount}
                      onChange={(e) => setMinConfirmationAmount(e.target.value)}
                      placeholder="Client must pay at least this amount"
                    />
                    <p className="text-xs text-muted-foreground">If set, client cannot pay less than this on the payment page.</p>
                  </div>
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
          )}

          {/* Passengers */}
          {activeTab === 'passengers' && (
            <BookingPassengers bookingId={id} />
          )}

          {/* Emails */}
          {activeTab === 'emails' && (
            <EmailsTab
              bookingId={id}
              booking={booking}
              items={items}
              emails={emails}
              onRefresh={fetchAll}
            />
          )}

          {/* Activity Log */}
          {activeTab === 'logs' && (
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
          )}
        </div>
      </div>

      {/* Mark Paid Dialog */}
      {markPaidPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-lg">Record Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Payment Mode *</Label>
                <Select value={markPaidMode} onValueChange={(v) => setMarkPaidMode(v || 'bank_transfer')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer / NEFT / RTGS</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Reference / Transaction ID</Label>
                <Input
                  value={markPaidRef}
                  onChange={(e) => setMarkPaidRef(e.target.value)}
                  placeholder="e.g. UTR number, cheque number..."
                />
              </div>
              {paymentAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Paid From Account</Label>
                  <Select
                    value={markPaidAccountId}
                    onValueChange={(v) => setMarkPaidAccountId(v || '')}
                  >
                    <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                    <SelectContent>
                      {paymentAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} ({acc.bank_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {teamMembers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Approved By (Manager)</Label>
                  <Select value={markPaidApprovedBy} onValueChange={(v) => setMarkPaidApprovedBy(v || '')}>
                    <SelectTrigger><SelectValue placeholder="Select approver..." /></SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name} ({m.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm">Notes</Label>
                <Textarea
                  value={markPaidNotes}
                  onChange={(e) => setMarkPaidNotes(e.target.value)}
                  placeholder="Any additional payment notes..."
                  className="min-h-16"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={handleConfirmMarkPaid}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Confirm Payment
                </Button>
                <Button variant="outline" onClick={() => setMarkPaidPaymentId(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipt Generation Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Payment Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                placeholder="Enter amount received"
                value={receiptForm.amount}
                onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={receiptForm.payment_date}
                onChange={(e) => setReceiptForm({ ...receiptForm, payment_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select
                value={receiptForm.payment_mode}
                onValueChange={(v) => setReceiptForm({ ...receiptForm, payment_mode: v || '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                placeholder="Transaction/cheque reference"
                value={receiptForm.reference_number}
                onChange={(e) => setReceiptForm({ ...receiptForm, reference_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={receiptForm.notes}
                onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>Cancel</Button>
            <Button
              disabled={receiptLoading || !receiptForm.amount || !receiptForm.payment_date}
              onClick={async () => {
                setReceiptLoading(true);
                try {
                  const res = await fetch(`/api/bookings/${id}/receipts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(receiptForm),
                  });
                  if (res.ok) {
                    const receipt = await res.json();
                    if (receipt.pdf_url) window.open(receipt.pdf_url, '_blank');
                    toast.success(`Receipt ${receipt.receipt_number} generated`);
                    setShowReceiptDialog(false);
                    setReceiptForm({ amount: '', payment_mode: '', payment_date: new Date().toISOString().split('T')[0], reference_number: '', notes: '' });
                  } else {
                    const err = await res.json();
                    toast.error(err.error || 'Failed to generate receipt');
                  }
                } catch { toast.error('Failed to generate receipt'); }
                setReceiptLoading(false);
              }}
            >
              {receiptLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              Generate Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  item, currency, isExpanded, onToggle, onUpdateStatus, onDelete, outstandingBalance,
}: {
  item: BookingItem;
  currency: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (status: SupplierStatus, vendorData: Record<string, unknown>) => void;
  onDelete: () => void;
  outstandingBalance: number;
}) {
  const Icon = ITEM_ICONS[item.item_type] || Package;
  const nextStatuses = STATUS_TRANSITIONS[item.supplier_status] || [];

  // Auto-detect vendor name from item details (supplier name, not vehicle/brand)
  const details = item.details as Record<string, unknown>;
  const autoVendorName = item.vendor_name || (details.hotel_name as string) || (details.airline as string) || '';

  // Local state for vendor tracking fields (prompted on status change)
  const [pendingStatus, setPendingStatus] = useState<SupplierStatus | null>(null);
  const [vendorChannel, setVendorChannel] = useState<'online' | 'offline'>(item.portal_name ? 'online' : 'offline');
  const [vendorName, setVendorName] = useState(autoVendorName);
  const [vendorEmail, setVendorEmail] = useState(item.vendor_email || '');
  const [portalName, setPortalName] = useState(item.portal_name || '');
  const [paymentDueDate] = useState(item.payment_due_date || '');
  const [supplierRef, setSupplierRef] = useState(item.supplier_reference || '');
  const [supplierNotes, setSupplierNotes] = useState(item.supplier_notes || '');

  const handleStatusClick = (status: SupplierStatus) => {
    // All status changes open the prompt for notes/details
    setPendingStatus(status);
  };

  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    // Only send non-empty fields to avoid writing nulls for columns that may not exist
    const vendorData: Record<string, unknown> = {};
    if (vendorName) vendorData.vendor_name = vendorName;
    if (vendorEmail) vendorData.vendor_email = vendorEmail;
    if (portalName) vendorData.portal_name = portalName;
    if (paymentDueDate) vendorData.payment_due_date = paymentDueDate;
    if (supplierRef) vendorData.supplier_reference = supplierRef;
    if (supplierNotes) vendorData.supplier_notes = supplierNotes;
    onUpdateStatus(pendingStatus, vendorData);
    setPendingStatus(null);
  };

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
            {Object.entries(details)
              .filter(([k, v]) => v != null && v !== '' && k !== 'supplier_id')
              .map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-muted-foreground">{k.replace(/_/g, ' ')}</p>
                <p className="text-sm font-medium">
                  {typeof v === 'object' && !Array.isArray(v) && v !== null
                    ? Object.entries(v as Record<string, unknown>)
                        .filter(([, val]) => val != null && val !== 0)
                        .map(([key, val]) => `${val} ${key.charAt(0).toUpperCase() + key.slice(1)}`)
                        .join(', ')
                    : Array.isArray(v) ? v.join(', ') : String(v)}
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
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                Update to: {SUPPLIER_STATUS_LABELS[pendingStatus]}
              </p>
              {pendingStatus === 'confirmed' && outstandingBalance > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-md p-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    ⚠ Outstanding balance: ₹{outstandingBalance.toLocaleString()}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Payment is not fully cleared. You can still confirm, but ensure the remaining amount is settled before travel dates.
                  </p>
                </div>
              )}
              {/* Channel toggle — only show if vendor not already set */}
              {['confirmation_requested', 'on_hold', 'confirmed'].includes(pendingStatus) && !item.vendor_name && !item.portal_name && (
                <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                  <button
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${vendorChannel === 'offline' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => { setVendorChannel('offline'); setPortalName(''); }}
                  >
                    Offline Supplier
                  </button>
                  <button
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${vendorChannel === 'online' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => { setVendorChannel('online'); setVendorName(''); }}
                  >
                    Online Portal
                  </button>
                </div>
              )}
              {/* Show existing vendor info as read-only context */}
              {['confirmation_requested', 'on_hold', 'confirmed'].includes(pendingStatus) && (item.vendor_name || item.portal_name) && (
                <p className="text-xs text-muted-foreground">
                  Supplier: <span className="font-medium text-foreground">{item.vendor_name || item.portal_name}</span>
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingStatus === 'confirmation_requested' && (
                  <>
                    {!item.vendor_name && !item.portal_name && (
                      vendorChannel === 'offline' ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier Name</Label>
                          <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Taj Hotels, Air India" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Vendor Portal</Label>
                          <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder="e.g. TBO, Booking.com, Via.com" />
                        </div>
                      )
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Mail Sent To (email)</Label>
                      <Input value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} placeholder="vendor@example.com" />
                    </div>
                  </>
                )}
                {pendingStatus === 'on_hold' && (
                  <>
                    {!item.vendor_name && !item.portal_name && (
                      vendorChannel === 'offline' ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier Name</Label>
                          <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Supplier name" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Blocked On Portal</Label>
                          <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder="e.g. TBO, Booking.com, Via.com" />
                        </div>
                      )
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Supplier Reference</Label>
                      <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Booking ref / hold ID" />
                    </div>
                  </>
                )}
                {pendingStatus === 'confirmed' && (
                  <>
                    {!item.vendor_name && !item.portal_name && (
                      vendorChannel === 'offline' ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier Name</Label>
                          <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Supplier name" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Confirmed On Portal</Label>
                          <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder="e.g. TBO, Booking.com" />
                        </div>
                      )
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Confirmation / PNR #</Label>
                      <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="Confirmation number" />
                    </div>
                  </>
                )}
                {pendingStatus === 'cancelled' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Cancellation Reason</Label>
                    <Input value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} placeholder="Reason for cancellation..." />
                  </div>
                )}
                {pendingStatus !== 'cancelled' && (
                  <div className="col-span-full space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} placeholder="Any additional notes..." />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmStatusChange}
                  className={pendingStatus === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : ''}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {pendingStatus === 'cancelled' ? 'Confirm Cancellation' : 'Save'}
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

/* ─────────────────────────────────────────────────────────
   EmailsTab — compose & send emails + email history
   ───────────────────────────────────────────────────────── */

function EmailsTab({
  bookingId, booking, items, emails, onRefresh,
}: {
  bookingId: string;
  booking: Booking;
  items: BookingItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emails: Record<string, any>[];
  onRefresh: () => void;
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [template, setTemplate] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const clientEmail = booking.clients?.email || '';

  const openCompose = (tpl: string) => {
    setTemplate(tpl);
    setPreviewHtml('');
    setPreviewSubject('');
    setSelectedItemId('');
    // Default "to" based on template type
    if (tpl === 'payment_reminder' || tpl === 'booking_confirmed') {
      setToEmail(clientEmail);
    } else if (tpl === 'confirmation_request' || tpl === 'follow_up') {
      const firstWithEmail = items.find(i => i.vendor_email);
      setToEmail(firstWithEmail?.vendor_email || '');
      setSelectedItemId(firstWithEmail?.id || '');
    }
    setComposeOpen(true);
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/compose-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          to_email: toEmail,
          item_id: selectedItemId || undefined,
          preview: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewSubject(data.subject);
        setPreviewHtml(data.html);
      }
    } catch { /* ignore */ }
    setPreviewing(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/compose-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          to_email: toEmail,
          item_id: selectedItemId || undefined,
        }),
      });
      if (res.ok) {
        toast.success('Email sent!');
        setComposeOpen(false);
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to send');
      }
    } catch {
      toast.error('Failed to send email');
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Compose buttons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Compose Email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => openCompose('confirmation_request')}>
              <Send className="h-4 w-4" />
              <span className="text-xs">Request Confirmation</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => openCompose('payment_reminder')}>
              <Bell className="h-4 w-4" />
              <span className="text-xs">Payment Reminder</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => openCompose('booking_confirmed')}>
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Booking Confirmed</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => openCompose('follow_up')}>
              <Mail className="h-4 w-4" />
              <span className="text-xs">Follow Up</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email history */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Email History ({emails.length})</CardTitle></CardHeader>
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
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No emails sent yet</TableCell></TableRow>
              ) : emails.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{e.subject}</TableCell>
                  <TableCell>{e.to_email || '-'}</TableCell>
                  <TableCell className="capitalize text-xs">{e.template_type?.replace(/_/g, ' ') || '-'}</TableCell>
                  <TableCell><Badge className={BOOKING_STATUS_COLORS[e.status] || ''}>{e.status}</Badge></TableCell>
                  <TableCell className="text-xs">{e.sent_at ? format(new Date(e.sent_at), 'dd MMM HH:mm') : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {template === 'confirmation_request' && 'Request Confirmation'}
              {template === 'payment_reminder' && 'Payment Reminder'}
              {template === 'booking_confirmed' && 'Booking Confirmed'}
              {template === 'follow_up' && 'Follow Up'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>To</Label>
              <Input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="email@example.com" />
            </div>

            {/* Item selector for supplier templates */}
            {(template === 'confirmation_request' || template === 'follow_up') && items.length > 0 && (
              <div>
                <Label>Booking Item</Label>
                <Select value={selectedItemId} onValueChange={v => {
                  setSelectedItemId(v || '');
                  const item = items.find(i => i.id === v);
                  if (item?.vendor_email) setToEmail(item.vendor_email);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select item..." /></SelectTrigger>
                  <SelectContent>
                    {items.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label} ({ITEM_TYPE_LABELS[item.item_type]})
                        {item.vendor_email ? ` — ${item.vendor_email}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preview */}
            {!previewHtml && (
              <Button variant="outline" onClick={handlePreview} disabled={previewing || !toEmail}>
                {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Preview Email
              </Button>
            )}

            {previewHtml && (
              <div className="space-y-2">
                <div className="bg-muted/50 rounded-md p-2">
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="text-sm font-medium">{previewSubject}</p>
                </div>
                <div className="border rounded-md p-4 bg-white dark:bg-slate-900 max-h-80 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !toEmail}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   InvoiceReceiptList — shows past invoices and receipts
   ───────────────────────────────────────────────────────── */

function InvoiceReceiptList({ bookingId }: { bookingId: string }) {
  const [invoices, setInvoices] = useState<Array<{ id: string; invoice_number: string; invoice_type: string; total: number; pdf_url: string | null; created_at: string }>>([]);
  const [receipts, setReceipts] = useState<Array<{ id: string; receipt_number: string; amount: number; pdf_url: string | null; created_at: string }>>([]);

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}/invoices`).then(r => r.ok ? r.json() : []).then(setInvoices).catch(() => {});
    fetch(`/api/bookings/${bookingId}/receipts`).then(r => r.ok ? r.json() : []).then(setReceipts).catch(() => {});
  }, [bookingId]);

  if (invoices.length === 0 && receipts.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Past Documents</p>
      {invoices.map(inv => (
        <div key={inv.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-sm">{inv.invoice_number}</span>
            <Badge variant="outline" className="text-[10px]">{inv.invoice_type}</Badge>
            <span className="text-xs text-muted-foreground">₹{Number(inv.total).toLocaleString('en-IN')}</span>
          </div>
          {inv.pdf_url && (
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => window.open(inv.pdf_url!, '_blank')}>
              <Download className="h-3 w-3 mr-1" /> PDF
            </Button>
          )}
        </div>
      ))}
      {receipts.map(rec => (
        <div key={rec.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
          <div className="flex items-center gap-2">
            <Download className="h-3.5 w-3.5 text-green-600" />
            <span className="text-sm">{rec.receipt_number}</span>
            <Badge variant="outline" className="text-[10px]">Receipt</Badge>
            <span className="text-xs text-muted-foreground">₹{Number(rec.amount).toLocaleString('en-IN')}</span>
          </div>
          {rec.pdf_url && (
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => window.open(rec.pdf_url!, '_blank')}>
              <Download className="h-3 w-3 mr-1" /> PDF
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   SendReminderButton — inline on payment rows
   ───────────────────────────────────────────────────────── */

function SendReminderButton({ bookingId, clientEmail, amountDue, dueDate, onSent }: {
  bookingId: string;
  clientEmail: string | null;
  amountDue: number;
  dueDate: string;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!clientEmail) {
      toast.error('No client email on file');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_due: amountDue, due_date: dueDate, to_email: clientEmail }),
      });
      if (res.ok) {
        toast.success('Payment reminder sent!');
        onSent();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to send reminder');
      }
    } catch {
      toast.error('Failed to send reminder');
    }
    setSending(false);
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700"
      onClick={send}
      disabled={sending || !clientEmail}
      title={clientEmail ? `Send reminder to ${clientEmail}` : 'No client email'}
    >
      {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
      Remind
    </Button>
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
