'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Supplier, SupplierSurcharge, Payable } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Save, Trash2, X, Plus } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { toast } from 'sonner';

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [surcharges, setSurcharges] = useState<SupplierSurcharge[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Supplier>>({});
  const [showSurchargeForm, setShowSurchargeForm] = useState(false);

  const fetchData = useCallback(async () => {
    const [supplierRes, surchargesRes, payablesRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', supplierId).single(),
      supabase.from('supplier_surcharges').select('*').eq('supplier_id', supplierId).order('start_date'),
      supabase.from('payables').select('*').eq('supplier_id', supplierId).order('due_date', { ascending: false }),
    ]);

    if (supplierRes.data) {
      setSupplier(supplierRes.data as Supplier);
      setEditData(supplierRes.data);
    }
    setSurcharges((surchargesRes.data as SupplierSurcharge[]) || []);
    setPayables((payablesRes.data as Payable[]) || []);
  }, [supplierId, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave() {
    const { error } = await supabase.from('suppliers').update({
      name: editData.name,
      type: editData.type,
      country: editData.country,
      contact_name: editData.contact_name,
      contact_email: editData.contact_email,
      contact_phone: editData.contact_phone,
      payment_terms_days: editData.payment_terms_days,
      notes: editData.notes,
    }).eq('id', supplierId);

    if (!error) { setEditing(false); fetchData(); toast.success('Supplier updated'); }
    else { toast.error('Failed to update supplier'); }
  }

  async function handleDelete() {
    if (payables.length > 0) {
      toast.error('Cannot delete a supplier with linked payables');
      return;
    }
    if (!confirm('Delete this supplier?')) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (!error) router.push('/suppliers');
    else toast.error('Failed to delete supplier');
  }

  async function handleAddSurcharge(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.from('supplier_surcharges').insert({
      supplier_id: supplierId,
      label: form.get('label') as string,
      start_date: form.get('start_date') as string,
      end_date: form.get('end_date') as string,
      surcharge_type: form.get('surcharge_type') as string,
      amount: Number(form.get('amount')),
    });
    if (!error) { setShowSurchargeForm(false); fetchData(); }
  }

  async function handleDeleteSurcharge(id: string) {
    await supabase.from('supplier_surcharges').delete().eq('id', id);
    fetchData();
  }

  if (!supplier) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Suppliers', href: '/suppliers' },
        { label: supplier.name },
      ]} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{editing ? 'Edit Supplier' : supplier.name}</CardTitle>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditData(supplier); }}><X className="h-4 w-4 mr-1" /> Cancel</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
                <Button size="sm" variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name</Label><Input value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Type</Label>
                <select className="w-full h-10 rounded-md border px-3 text-sm" value={editData.type || ''} onChange={(e) => setEditData({ ...editData, type: e.target.value as Supplier['type'] })}>
                  <option value="">Select</option>
                  {['DMC','hotel','airline','car','activity','other'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Destination</Label><Input value={editData.country || ''} onChange={(e) => setEditData({ ...editData, country: e.target.value })} /></div>
              <div className="space-y-2"><Label>Contact Name</Label><Input value={editData.contact_name || ''} onChange={(e) => setEditData({ ...editData, contact_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Contact Email</Label><Input value={editData.contact_email || ''} onChange={(e) => setEditData({ ...editData, contact_email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Contact Phone</Label><Input value={editData.contact_phone || ''} onChange={(e) => setEditData({ ...editData, contact_phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Payment Terms (days)</Label><Input type="number" value={editData.payment_terms_days ?? ''} onChange={(e) => setEditData({ ...editData, payment_terms_days: e.target.value ? Number(e.target.value) : null })} /></div>
              <div className="space-y-2"><Label>Notes</Label><Input value={editData.notes || ''} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Type:</span> {supplier.type || 'N/A'}</div>
              <div><span className="text-muted-foreground">Destination:</span> {supplier.country || 'N/A'}</div>
              <div><span className="text-muted-foreground">Contact:</span> {supplier.contact_name || 'N/A'}</div>
              <div><span className="text-muted-foreground">Email:</span> {supplier.contact_email || 'N/A'}</div>
              <div><span className="text-muted-foreground">Phone:</span> {supplier.contact_phone || 'N/A'}</div>
              <div><span className="text-muted-foreground">Payment Terms:</span> {supplier.payment_terms_days ? `${supplier.payment_terms_days} days` : 'N/A'}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Surcharge Calendar</CardTitle>
          <Button size="sm" onClick={() => setShowSurchargeForm(!showSurchargeForm)}>
            {showSurchargeForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showSurchargeForm ? 'Cancel' : 'Add Surcharge'}
          </Button>
        </CardHeader>
        <CardContent>
          {showSurchargeForm && (
            <form onSubmit={handleAddSurcharge} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-4 border rounded-md">
              <div className="space-y-2"><Label>Label *</Label><Input name="label" required /></div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <select name="surcharge_type" className="w-full h-10 rounded-md border px-3 text-sm" required>
                  <option value="per_night">Per Night</option>
                  <option value="flat">Flat</option>
                  <option value="percent">Percent</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Start Date *</Label><Input name="start_date" type="date" required /></div>
              <div className="space-y-2"><Label>End Date *</Label><Input name="end_date" type="date" required /></div>
              <div className="space-y-2"><Label>Amount *</Label><Input name="amount" type="number" step="0.01" required /></div>
              <div className="flex items-end"><Button type="submit">Add</Button></div>
            </form>
          )}
          {surcharges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No surcharges configured</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surcharges.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.label}</TableCell>
                    <TableCell>{s.start_date} — {s.end_date}</TableCell>
                    <TableCell><Badge variant="outline">{s.surcharge_type}</Badge></TableCell>
                    <TableCell>{s.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteSurcharge(s.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Payables</CardTitle></CardHeader>
        <CardContent>
          {payables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payables</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payables.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.description}</TableCell>
                    <TableCell className="font-medium">{p.amount.toLocaleString()}</TableCell>
                    <TableCell>{p.due_date}</TableCell>
                    <TableCell>
                      <Badge className={p.status === 'paid' ? 'bg-green-100 text-green-700' : p.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}>
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
