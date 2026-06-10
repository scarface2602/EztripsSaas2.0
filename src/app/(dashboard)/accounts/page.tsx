'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TripLedgerEntry } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowDownCircle, ArrowUpCircle, Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'paid' ? 'default' : status === 'overdue' ? 'destructive' : 'secondary';
  return <Badge variant={variant} className="text-xs capitalize">{status}</Badge>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function TreasuryDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [arEntries, setArEntries] = useState<TripLedgerEntry[]>([]);
  const [apEntries, setApEntries] = useState<TripLedgerEntry[]>([]);
  const [utrInputs, setUtrInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      // Load receivables from booking_package_payments (all rows are client installments — no direction column)
      const { data: receivables } = await supabase
        .from('booking_package_payments')
        .select(`
          id, amount, amount_paid, status, due_date, paid_date, notes, created_at, updated_at,
          booking_packages!inner(
            id, booking_id,
            bookings!inner(trip_id, client_id, travel_start, clients(full_name))
          )
        `)
        .order('due_date', { ascending: true });

      // Load payables from booking_items (supplier cost settlements)
      const { data: payables } = await supabase
        .from('booking_items')
        .select(`
          id, cost_price, supplier_status, item_type, created_at, updated_at,
          supplier_id, suppliers(name),
          booking_id, bookings!inner(trip_id, travel_start)
        `)
        .not('supplier_id', 'is', null)
        .order('created_at', { ascending: true });

      if (receivables) {
        setArEntries(receivables.map((r: Record<string, unknown>) => {
          const pkg = r.booking_packages as Record<string, unknown>;
          const booking = pkg?.bookings as Record<string, unknown>;
          const client = booking?.clients as Record<string, unknown> | null;
          return {
            id: r.id as string,
            trip_id: (booking?.trip_id as string) || `BK-${(pkg?.booking_id as string || '').slice(0, 8)}`,
            direction: 'receivable' as const,
            client_id: booking?.client_id as string | null,
            client_name: (client?.full_name as string) || 'Unknown Client',
            supplier_id: null,
            supplier_name: null,
            booking_ref: null,
            amount: Number(r.amount) || 0,
            amount_paid: Number(r.amount_paid) || 0,
            due_date: (r.due_date as string) || '',
            status: (r.status as string) === 'paid' ? 'paid' as const : 'pending' as const,
            utr_number: null,
            payment_proof_url: null,
            notes: r.notes as string | null,
            created_at: r.created_at as string,
            updated_at: r.updated_at as string,
          };
        }));
      }

      if (payables) {
        setApEntries(payables.map((p: Record<string, unknown>) => {
          const booking = p.bookings as Record<string, unknown>;
          const supplier = p.suppliers as Record<string, unknown> | null;
          const isPaid = (p.supplier_status as string) === 'confirmed';
          return {
            id: p.id as string,
            trip_id: (booking?.trip_id as string) || '',
            direction: 'payable' as const,
            client_id: null,
            client_name: null,
            supplier_id: (p.supplier_id as string) || null,
            supplier_name: (supplier?.name as string) || 'Supplier',
            booking_ref: (booking?.trip_id as string) || null,
            amount: Number(p.cost_price) || 0,
            amount_paid: isPaid ? Number(p.cost_price) || 0 : 0,
            due_date: (booking?.travel_start as string) || '',
            status: isPaid ? 'paid' as const : 'pending' as const,
            utr_number: null,
            payment_proof_url: null,
            notes: null,
            created_at: p.created_at as string,
            updated_at: p.updated_at as string,
          };
        }));
      }

      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleVerifyFunds(entry: TripLedgerEntry) {
    // Optimistic UI update
    setArEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'paid' as const, amount_paid: e.amount } : e));

    try {
      // Find the package_id for this payment to satisfy the financials PATCH route
      const { data: payment } = await supabase
        .from('booking_package_payments')
        .select('id, booking_packages!inner(id, booking_id)')
        .eq('id', entry.id)
        .single();

      if (!payment) throw new Error('Payment not found');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pkgRaw = payment.booking_packages as any;
      const pkg = Array.isArray(pkgRaw) ? pkgRaw[0] : pkgRaw;
      const bookingId = pkg?.booking_id;
      const packageId = pkg?.id;

      const res = await fetch(`/api/bookings/${bookingId}/financials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: entry.id,
          packageId,
          status: 'paid',
          amount_paid: entry.amount,
        }),
      });

      if (!res.ok) throw new Error('Verification failed');
      toast.success('Funds verified');
    } catch {
      // Revert optimistic update
      setArEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'pending' as const, amount_paid: 0 } : e));
      toast.error('Failed to verify funds');
    }
  }

  async function handlePaySupplier(entry: TripLedgerEntry) {
    const utr = utrInputs[entry.id];
    if (!utr?.trim()) {
      toast.error('Enter UTR number before marking as paid');
      return;
    }
    const { error } = await supabase
      .from('booking_package_payments')
      .update({ status: 'paid', payment_method: utr, paid_at: new Date().toISOString(), amount_paid: entry.amount })
      .eq('id', entry.id);
    if (!error) {
      setApEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'paid' as const, utr_number: utr, amount_paid: e.amount } : e));
      toast.success('Payment recorded');
    }
  }

  // Summary stats
  const arTotal = arEntries.reduce((s, e) => s + e.amount, 0);
  const arPaid = arEntries.reduce((s, e) => s + e.amount_paid, 0);
  const apTotal = apEntries.reduce((s, e) => s + e.amount, 0);
  const apPaid = apEntries.reduce((s, e) => s + e.amount_paid, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Treasury</h1>
        <p className="text-sm text-muted-foreground mt-1">Accounts Receivable & Payable overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">AR Total</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(arTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">AR Collected</p>
            <p className="text-lg font-bold">{formatCurrency(arPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">AP Total</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(apTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">AP Paid</p>
            <p className="text-lg font-bold">{formatCurrency(apPaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* AR Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownCircle className="h-5 w-5 text-green-600" />
              Accounts Receivable (AR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="py-2 px-2">Client</th>
                    <th className="py-2 px-2">Trip ID</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                    <th className="py-2 px-2">Due Date</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {arEntries.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">No receivables</td></tr>
                  )}
                  {arEntries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium max-w-[120px] truncate" title={entry.client_name || ''}>{entry.client_name}</td>
                      <td className="py-2 px-2 font-mono text-xs text-primary">{entry.trip_id}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(entry.amount)}</td>
                      <td className="py-2 px-2 text-xs">{entry.due_date ? format(new Date(entry.due_date), 'dd MMM yyyy') : '-'}</td>
                      <td className="py-2 px-2"><StatusBadge status={entry.status} /></td>
                      <td className="py-2 px-2">
                        {entry.status !== 'paid' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleVerifyFunds(entry)}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Verify
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* AP Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpCircle className="h-5 w-5 text-red-600" />
              Accounts Payable (AP)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="py-2 px-2">Supplier</th>
                    <th className="py-2 px-2">Trip ID</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                    <th className="py-2 px-2">Deadline</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {apEntries.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">No payables</td></tr>
                  )}
                  {apEntries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{entry.supplier_name}</td>
                      <td className="py-2 px-2 font-mono text-xs text-primary">{entry.trip_id}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(entry.amount)}</td>
                      <td className="py-2 px-2 text-xs">{entry.due_date ? format(new Date(entry.due_date), 'dd MMM yyyy') : '-'}</td>
                      <td className="py-2 px-2"><StatusBadge status={entry.status} /></td>
                      <td className="py-2 px-2">
                        {entry.status !== 'paid' && (
                          <div className="flex items-center gap-1">
                            <Input
                              placeholder="UTR"
                              className="h-7 w-24 text-xs"
                              value={utrInputs[entry.id] || ''}
                              onChange={(e) => setUtrInputs(prev => ({ ...prev, [entry.id]: e.target.value }))}
                            />
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handlePaySupplier(entry)}>
                              <Upload className="h-3 w-3 mr-1" /> Pay
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
