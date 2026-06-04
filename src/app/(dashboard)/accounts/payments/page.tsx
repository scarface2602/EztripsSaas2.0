'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { CheckCircle2, Loader2, CreditCard, Wallet, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface PaymentAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_type: string;
}

interface ApprovedPayment {
  id: string;
  package_id: string;
  amount: number;
  label: string;
  due_date: string | null;
  status: string;
  approval_status: string;
  approved_at: string | null;
  booking_packages: {
    booking_id: string;
    bookings: {
      id: string;
      title: string;
      destination: string;
      clients: { full_name: string } | null;
    };
  };
}

interface ApprovedRefund {
  id: string;
  booking_id: string;
  label: string;
  refund_amount: number;
  refund_status: string;
  cancellation_charge: number | null;
  cancellation_reason: string | null;
  bookings: {
    id: string;
    title: string;
    clients: { full_name: string } | null;
  };
}

const PAYMENT_MODES = [
  { value: 'bank_transfer', label: 'Bank Transfer / NEFT / RTGS' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Credit / Debit Card' },
  { value: 'portal_wallet', label: 'Portal Wallet' },
  { value: 'gateway', label: 'Payment Gateway' },
];

export default function AccountsPaymentsPage() {
  const supabase = createClient();
  const [payments, setPayments] = useState<ApprovedPayment[]>([]);
  const [refunds, setRefunds] = useState<ApprovedRefund[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Per-payment form state
  const [formState, setFormState] = useState<Record<string, {
    payment_mode: string;
    reference_number: string;
    paid_from_account_id: string;
  }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [payRes, accRes, refundRes] = await Promise.all([
      supabase
        .from('booking_package_payments')
        .select(`
          id, package_id, amount, label, due_date, status, approval_status, approved_at,
          booking_packages!inner (
            booking_id,
            bookings!inner (
              id, title, destination,
              clients ( full_name )
            )
          )
        `)
        .eq('approval_status', 'approved')
        .neq('status', 'paid')
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('payment_accounts')
        .select('id, account_name, bank_name, account_type')
        .eq('is_active', true)
        .order('account_name'),
      supabase
        .from('booking_items')
        .select(`
          id, booking_id, label, refund_amount, refund_status,
          cancellation_charge, cancellation_reason,
          bookings!inner ( id, title, clients ( full_name ) )
        `)
        .eq('refund_status', 'approved')
        .order('cancelled_at', { ascending: true }),
    ]);

    if (payRes.error) console.error('Failed to fetch payments:', payRes.error);
    if (accRes.error) console.error('Failed to fetch accounts:', accRes.error);

    setPayments((payRes.data as unknown as ApprovedPayment[]) || []);
    setAccounts((accRes.data as PaymentAccount[]) || []);
    setRefunds((refundRes.data as unknown as ApprovedRefund[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateForm = (paymentId: string, field: string, value: string | null) => {
    setFormState((prev) => ({
      ...prev,
      [paymentId]: { ...(prev[paymentId] || { payment_mode: 'bank_transfer', reference_number: '', paid_from_account_id: '' }), [field]: value },
    }));
  };

  const handleMarkPaid = async (payment: ApprovedPayment) => {
    const form = formState[payment.id];
    if (!form?.payment_mode) {
      toast.error('Please select a payment mode');
      return;
    }

    setProcessingId(payment.id);
    try {
      const res = await fetch(`/api/booking-packages/${payment.package_id}/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          amount_paid: payment.amount,
          paid_date: new Date().toISOString().split('T')[0],
          payment_mode: form.payment_mode,
          reference_number: form.reference_number || null,
          paid_from_account_id: form.paid_from_account_id || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to mark as paid');

      toast.success('Payment recorded successfully');
      setExpandedId(null);
      await fetchData();
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleProcessRefund = async (refund: ApprovedRefund) => {
    setProcessingId(refund.id);
    try {
      // Record refund as negative customer payment
      const res = await fetch(`/api/bookings/${refund.booking_id}/customer-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: refund.refund_amount,
          payment_type: 'refund',
          payment_mode: 'bank_transfer',
          notes: `Refund for cancelled item: ${refund.label}${refund.cancellation_reason ? ` — ${refund.cancellation_reason}` : ''}`,
        }),
      });
      if (!res.ok) throw new Error('Failed to record refund');

      // Mark refund_status as processed
      await fetch(`/api/bookings/${refund.booking_id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: refund.id, refund_status: 'processed' }),
      });

      toast.success('Refund processed and recorded');
      await fetchData();
    } catch {
      toast.error('Failed to process refund');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Payments to Execute</h1>
        <p className="text-muted-foreground">
          {payments.length === 0 ? 'No pending payments' : `${payments.length} approved payment${payments.length !== 1 ? 's' : ''} ready to execute`}
        </p>
      </div>

      {payments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-3 text-green-500" />
            <p className="font-medium">All payments executed</p>
            <p className="text-sm mt-1">No approved payments waiting to be processed.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {payments.map((p) => {
          const pkg = p.booking_packages as unknown as ApprovedPayment['booking_packages'];
          const booking = pkg?.bookings;
          const client = booking?.clients;
          const daysUntilDue = p.due_date ? differenceInDays(new Date(p.due_date), new Date()) : null;
          const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
          const isExpanded = expandedId === p.id;
          const form = formState[p.id] || { payment_mode: 'bank_transfer', reference_number: '', paid_from_account_id: '' };

          return (
            <Card key={p.id} className={`p-4 ${isExpanded ? 'ring-2 ring-primary/20' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link href={`/bookings/${booking?.id}`} className="font-medium text-sm hover:underline truncate">
                      {booking?.title || 'Untitled Booking'}
                    </Link>
                    <Badge className="bg-green-100 text-green-700 text-[10px]">Approved</Badge>
                    {isOverdue && <Badge className="bg-red-100 text-red-700 text-[10px]">Overdue</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{client?.full_name || 'Guest'}</span>
                    {booking?.destination && <span>· {booking.destination}</span>}
                    {p.label && <span>· {p.label}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="font-semibold text-base">₹{Number(p.amount).toLocaleString()}</span>
                    {p.due_date && (
                      <span className={`text-xs ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                        Due: {format(new Date(p.due_date), 'dd MMM yyyy')}
                      </span>
                    )}
                    {p.approved_at && (
                      <span className="text-xs text-muted-foreground">
                        Approved: {format(new Date(p.approved_at), 'dd MMM')}
                      </span>
                    )}
                  </div>
                </div>

                {!isExpanded && (
                  <Button size="sm" onClick={() => {
                    setExpandedId(p.id);
                    if (!formState[p.id]) {
                      setFormState((prev) => ({
                        ...prev,
                        [p.id]: { payment_mode: 'bank_transfer', reference_number: '', paid_from_account_id: '' },
                      }));
                    }
                  }}>
                    <CreditCard className="h-3 w-3 mr-1" />
                    Record Payment
                  </Button>
                )}
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Payment Mode *</Label>
                      <Select value={form.payment_mode} onValueChange={(v) => updateForm(p.id, 'payment_mode', v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_MODES.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Reference / Transaction ID</Label>
                      <Input
                        className="h-9"
                        value={form.reference_number}
                        onChange={(e) => updateForm(p.id, 'reference_number', e.target.value)}
                        placeholder="UTR, cheque no..."
                      />
                    </div>
                    {accounts.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Paid From Account</Label>
                        <Select value={form.paid_from_account_id} onValueChange={(v) => updateForm(p.id, 'paid_from_account_id', v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select account..." /></SelectTrigger>
                          <SelectContent>
                            {accounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.account_name} ({acc.bank_name})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={processingId === p.id}
                      onClick={() => handleMarkPaid(p)}
                    >
                      {processingId === p.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      Confirm Payment
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setExpandedId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Refunds to Process */}
      {refunds.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-600" /> Refunds to Process ({refunds.length})
          </h2>
          <div className="grid gap-3">
            {refunds.map((r) => {
              const booking = Array.isArray(r.bookings) ? r.bookings[0] : r.bookings;
              const client = booking?.clients;
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Link href={`/bookings/${booking?.id}`} className="font-medium text-sm hover:underline truncate">
                          {booking?.title || 'Untitled Booking'}
                        </Link>
                        <Badge className="bg-green-100 text-green-700 text-[10px]">Approved</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{client?.full_name || 'Guest'}</span>
                        <span>· {r.label}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-semibold text-base text-orange-700">₹{Number(r.refund_amount).toLocaleString()}</span>
                        {r.cancellation_charge && Number(r.cancellation_charge) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            After ₹{Number(r.cancellation_charge).toLocaleString()} cancellation charge
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={processingId === r.id}
                      onClick={() => handleProcessRefund(r)}
                    >
                      {processingId === r.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                      Process Refund
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
