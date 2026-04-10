'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Receivable } from '@/lib/types/database';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ArrowDownLeft, Search } from 'lucide-react';

export default function ReceivablesPage() {
  const [receivables, setReceivables] = useState<(Receivable & { client_name?: string; proposal_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentNotes, setPaymentNotes] = useState('');
  const supabase = useMemo(() => createClient(), []);

  const fetchReceivables = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('receivables')
      .select('*, clients(full_name), proposals(title)')
      .order('due_date', { ascending: true });

    if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
    }

    const { data } = await q;
    const mapped = (data || []).map((r: Record<string, unknown>) => ({
      ...r,
      client_name: (r.clients as Record<string, unknown>)?.full_name as string | undefined,
      proposal_title: (r.proposals as Record<string, unknown>)?.title as string | undefined,
    })) as (Receivable & { client_name?: string; proposal_title?: string })[];

    if (search) {
      const s = search.toLowerCase();
      setReceivables(mapped.filter(r =>
        r.description.toLowerCase().includes(s) ||
        (r.client_name || '').toLowerCase().includes(s) ||
        (r.proposal_title || '').toLowerCase().includes(s)
      ));
    } else {
      setReceivables(mapped);
    }
    setLoading(false);
  }, [supabase, statusFilter, search]);

  useEffect(() => {
    fetchReceivables();
  }, [fetchReceivables]);

  async function handleMarkPaid() {
    if (!markPaidId) return;
    await fetch(`/api/receivables/${markPaidId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'paid',
        payment_method: paymentMethod,
        notes: paymentNotes || undefined,
      }),
    });
    setMarkPaidId(null);
    setPaymentMethod('bank_transfer');
    setPaymentNotes('');
    fetchReceivables();
  }

  const isOverdue = (r: Receivable) => {
    if (r.status === 'paid') return false;
    return new Date(r.due_date) < new Date();
  };

  const statusBadge = (r: Receivable) => {
    if (r.status === 'paid') return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
    if (isOverdue(r)) return <Badge variant="destructive">Overdue</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  const totalPending = receivables.filter(r => r.status !== 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const totalOverdue = receivables.filter(r => isOverdue(r)).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ArrowDownLeft className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Receivables</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold">{totalPending.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{totalOverdue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Count</p>
          <p className="text-2xl font-bold">{receivables.length}</p>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, proposal, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Proposal</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : receivables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No receivables found</TableCell>
              </TableRow>
            ) : (
              receivables.map((r) => (
                <TableRow key={r.id} className={isOverdue(r) ? 'bg-red-50' : ''}>
                  <TableCell className="font-medium">{r.description}</TableCell>
                  <TableCell>{r.client_name || '-'}</TableCell>
                  <TableCell>{r.proposal_title || '-'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(r.amount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className={isOverdue(r) ? 'text-red-600 font-medium' : ''}>
                    {format(new Date(r.due_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>{statusBadge(r)}</TableCell>
                  <TableCell>
                    {r.status !== 'paid' && (
                      <Button size="sm" variant="outline" onClick={() => setMarkPaidId(r.id)}>
                        Mark Paid
                      </Button>
                    )}
                    {r.status === 'paid' && r.payment_method && (
                      <span className="text-xs text-muted-foreground">{r.payment_method}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!markPaidId} onOpenChange={() => setMarkPaidId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? 'bank_transfer')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Reference number, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidId(null)}>Cancel</Button>
            <Button onClick={handleMarkPaid}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
