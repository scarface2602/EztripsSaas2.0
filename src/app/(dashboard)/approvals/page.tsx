'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { CheckCircle2, XCircle, Loader2, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface PendingPayment {
  id: string;
  package_id: string;
  amount: number;
  label: string;
  due_date: string | null;
  status: string;
  approval_status: string;
  payment_mode: string | null;
  reference_number: string | null;
  created_at: string;
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

interface PendingRefund {
  id: string;
  booking_id: string;
  label: string;
  cancellation_reason: string | null;
  cancellation_charge: number | null;
  refund_amount: number;
  refund_status: string;
  cancelled_at: string | null;
  bookings: {
    id: string;
    title: string;
    clients: { full_name: string } | null;
  };
}

export default function ApprovalsPage() {
  const supabase = createClient();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [refunds, setRefunds] = useState<PendingRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [payRes, refundRes] = await Promise.all([
      supabase
        .from('booking_package_payments')
        .select(`
          id, package_id, amount, label, due_date, status, approval_status,
          payment_mode, reference_number, created_at,
          booking_packages!inner (
            booking_id,
            bookings!inner (
              id, title, destination,
              clients ( full_name )
            )
          )
        `)
        .eq('approval_status', 'pending')
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('booking_items')
        .select(`
          id, booking_id, label, cancellation_reason, cancellation_charge,
          refund_amount, refund_status, cancelled_at,
          bookings!inner ( id, title, clients ( full_name ) )
        `)
        .eq('refund_status', 'pending')
        .order('cancelled_at', { ascending: true }),
    ]);

    if (payRes.error) console.error('Failed to fetch payments:', payRes.error);
    if (refundRes.error) console.error('Failed to fetch refunds:', refundRes.error);

    setPayments((payRes.data as unknown as PendingPayment[]) || []);
    setRefunds((refundRes.data as unknown as PendingRefund[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handlePaymentApproval = async (paymentId: string, packageId: string, action: 'approve' | 'reject') => {
    setProcessingId(paymentId);
    try {
      const res = await fetch(`/api/booking-packages/${packageId}/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: action === 'reject' ? rejectNotes[paymentId] || '' : undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      toast.success(action === 'approve' ? 'Payment approved' : 'Payment rejected');
      setShowRejectFor(null);
      await fetchAll();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRefundApproval = async (itemId: string, bookingId: string, action: 'approve' | 'reject') => {
    setProcessingId(itemId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          refund_status: action === 'approve' ? 'approved' : 'rejected',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(action === 'approve' ? 'Refund approved — accounts can now process it' : 'Refund rejected');
      setShowRejectFor(null);
      await fetchAll();
    } catch {
      toast.error('Failed to update refund status');
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

  const totalPending = payments.length + refunds.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">Approvals</h1>
        {totalPending > 0 && (
          <Badge variant="destructive" className="text-sm px-2.5 py-0.5 animate-pulse">
            {totalPending}
          </Badge>
        )}
        <p className="text-muted-foreground ml-auto text-sm">
          {totalPending === 0 ? 'All caught up!' : `${totalPending} item${totalPending !== 1 ? 's' : ''} awaiting your approval`}
        </p>
      </div>

      {totalPending === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-green-500" />
            <p className="font-medium">No pending approvals</p>
            <p className="text-sm mt-1">All payments and refunds have been reviewed.</p>
          </CardContent>
        </Card>
      )}

      {/* Payment Approvals */}
      {payments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Payment Approvals ({payments.length})</h2>
          <div className="grid gap-3">
            {payments.map((p) => {
              const pkg = p.booking_packages as unknown as PendingPayment['booking_packages'];
              const booking = pkg?.bookings;
              const client = booking?.clients;
              const daysUntilDue = p.due_date ? differenceInDays(new Date(p.due_date), new Date()) : null;
              const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
              const isUrgent = daysUntilDue !== null && daysUntilDue <= 2 && daysUntilDue >= 0;
              const daysPending = differenceInDays(new Date(), new Date(p.created_at));

              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Link href={`/bookings/${booking?.id}`} className="font-medium text-sm hover:underline truncate">
                          {booking?.title || 'Untitled Booking'}
                        </Link>
                        {isOverdue && <Badge className="bg-red-100 text-red-700 text-[10px]">Overdue</Badge>}
                        {isUrgent && <Badge className="bg-orange-100 text-orange-700 text-[10px]">Due soon</Badge>}
                        {daysPending > 2 && <Badge variant="outline" className="text-[10px]">{daysPending}d pending</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{client?.full_name || 'Guest'}</span>
                        {booking?.destination && <span>· {booking.destination}</span>}
                        {p.label && <span>· {p.label}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="font-semibold text-base">₹{Number(p.amount).toLocaleString()}</span>
                        {p.due_date && (
                          <span className={`text-xs ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                            Due: {format(new Date(p.due_date), 'dd MMM yyyy')}
                          </span>
                        )}
                      </div>
                      {showRejectFor === p.id && (
                        <div className="mt-3">
                          <Textarea
                            placeholder="Reason for rejection..."
                            value={rejectNotes[p.id] || ''}
                            onChange={(e) => setRejectNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className="min-h-16 text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {showRejectFor === p.id ? (
                        <>
                          <Button size="sm" variant="destructive" disabled={processingId === p.id} onClick={() => handlePaymentApproval(p.id, p.package_id, 'reject')}>
                            {processingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm Reject'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowRejectFor(null)}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" disabled={processingId === p.id} onClick={() => handlePaymentApproval(p.id, p.package_id, 'approve')}>
                            {processingId === p.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowRejectFor(p.id)}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Refund Approvals */}
      {refunds.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-600" /> Refund Approvals ({refunds.length})
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
                        <Badge className="bg-orange-100 text-orange-700 text-[10px]">Refund Pending</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{client?.full_name || 'Guest'}</span>
                        <span>· {r.label}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="font-semibold text-base text-orange-700">₹{Number(r.refund_amount).toLocaleString()} refund</span>
                        {r.cancellation_charge && Number(r.cancellation_charge) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Cancellation charge: ₹{Number(r.cancellation_charge).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {r.cancellation_reason && (
                        <p className="text-xs text-muted-foreground mt-1">Reason: {r.cancellation_reason}</p>
                      )}
                      {showRejectFor === r.id && (
                        <div className="mt-3">
                          <Textarea
                            placeholder="Reason for rejecting refund..."
                            value={rejectNotes[r.id] || ''}
                            onChange={(e) => setRejectNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="min-h-16 text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {showRejectFor === r.id ? (
                        <>
                          <Button size="sm" variant="destructive" disabled={processingId === r.id} onClick={() => handleRefundApproval(r.id, r.booking_id, 'reject')}>
                            {processingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm Reject'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowRejectFor(null)}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" disabled={processingId === r.id} onClick={() => handleRefundApproval(r.id, r.booking_id, 'approve')}>
                            {processingId === r.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Approve Refund
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowRejectFor(r.id)}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
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
}
