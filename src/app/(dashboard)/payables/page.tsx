'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Payable } from '@/lib/types/database';
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
import { ArrowUpRight, Search } from 'lucide-react';

export default function PayablesPage() {
  const [payables, setPayables] = useState<(Payable & { supplier_name?: string; proposal_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from('suppliers').select('id, name').order('name').then(({ data }) => {
      setSuppliers((data || []) as { id: string; name: string }[]);
    });
  }, []);

  const fetchPayables = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('payables')
      .select('*, suppliers(name), proposals(title)')
      .order('due_date', { ascending: true });

    if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
    }
    if (supplierFilter !== 'all') {
      q = q.eq('supplier_id', supplierFilter);
    }

    const { data } = await q;
    const mapped = (data || []).map((p: Record<string, unknown>) => ({
      ...p,
      supplier_name: (p.suppliers as Record<string, unknown>)?.name as string | undefined,
      proposal_title: (p.proposals as Record<string, unknown>)?.title as string | undefined,
    })) as (Payable & { supplier_name?: string; proposal_title?: string })[];

    if (search) {
      const s = search.toLowerCase();
      setPayables(mapped.filter(p =>
        p.description.toLowerCase().includes(s) ||
        (p.supplier_name || '').toLowerCase().includes(s) ||
        (p.proposal_title || '').toLowerCase().includes(s)
      ));
    } else {
      setPayables(mapped);
    }
    setLoading(false);
  }, [supabase, statusFilter, supplierFilter, search]);

  useEffect(() => {
    fetchPayables();
  }, [fetchPayables]);

  async function handleMarkPaid() {
    if (!markPaidId) return;
    await fetch(`/api/payables/${markPaidId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'paid',
        reference: reference || undefined,
        notes: paymentNotes || undefined,
      }),
    });
    setMarkPaidId(null);
    setReference('');
    setPaymentNotes('');
    fetchPayables();
  }

  const isOverdue = (p: Payable) => {
    if (p.status === 'paid') return false;
    return new Date(p.due_date) < new Date();
  };

  const statusBadge = (p: Payable) => {
    if (p.status === 'paid') return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
    if (isOverdue(p)) return <Badge variant="destructive">Overdue</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  const totalPending = payables.filter(p => p.status !== 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const totalOverdue = payables.filter(p => isOverdue(p)).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ArrowUpRight className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Payables</h1>
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
          <p className="text-2xl font-bold">{payables.length}</p>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by supplier, proposal, or description..."
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
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={(v) => setSupplierFilter(v ?? 'all')}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Supplier</TableHead>
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
            ) : payables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payables found</TableCell>
              </TableRow>
            ) : (
              payables.map((p) => (
                <TableRow key={p.id} className={isOverdue(p) ? 'bg-red-50' : ''}>
                  <TableCell className="font-medium">{p.description}</TableCell>
                  <TableCell>{p.supplier_name || '-'}</TableCell>
                  <TableCell>{p.proposal_title || '-'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(p.amount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className={isOverdue(p) ? 'text-red-600 font-medium' : ''}>
                    {format(new Date(p.due_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>{statusBadge(p)}</TableCell>
                  <TableCell>
                    {p.status !== 'paid' && (
                      <Button size="sm" variant="outline" onClick={() => setMarkPaidId(p.id)}>
                        Mark Paid
                      </Button>
                    )}
                    {p.status === 'paid' && p.reference && (
                      <span className="text-xs text-muted-foreground">Ref: {p.reference}</span>
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
              <Label>Reference / Invoice Number</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Supplier invoice or ref number" />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Additional notes" />
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
