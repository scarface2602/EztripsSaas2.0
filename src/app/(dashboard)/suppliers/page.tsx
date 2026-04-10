'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Supplier } from '@/lib/types/database';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, X, Truck } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  DMC: 'bg-purple-100 text-purple-700',
  hotel: 'bg-blue-100 text-blue-700',
  airline: 'bg-sky-100 text-sky-700',
  car: 'bg-amber-100 text-amber-700',
  activity: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const fetchSuppliers = useCallback(async (query: string) => {
    setLoading(true);
    let q = supabase.from('suppliers').select('*').order('created_at', { ascending: false });

    if (query) {
      q = q.or(`name.ilike.%${query}%,type.ilike.%${query}%,country.ilike.%${query}%`);
    }

    const { data } = await q;
    setSuppliers((data as Supplier[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => fetchSuppliers(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchSuppliers]);

  async function handleAddSupplier(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('suppliers').insert({
      name: form.get('name') as string,
      type: (form.get('type') as string) || null,
      country: (form.get('country') as string) || null,
      contact_name: (form.get('contact_name') as string) || null,
      contact_email: (form.get('contact_email') as string) || null,
      contact_phone: (form.get('contact_phone') as string) || null,
      payment_terms_days: form.get('payment_terms_days') ? Number(form.get('payment_terms_days')) : null,
      notes: (form.get('notes') as string) || null,
      created_by: user.id,
    });

    if (!error) {
      setShowAddForm(false);
      fetchSuppliers(search);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Suppliers</h1>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showAddForm ? 'Cancel' : 'Add Supplier'}
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">New Supplier</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAddSupplier} className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select id="type" name="type" className="w-full h-10 rounded-md border px-3 text-sm">
                  <option value="">Select type</option>
                  {['DMC','hotel','airline','car','activity','other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Destination</Label>
                <Input id="country" name="country" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input id="contact_name" name="contact_name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input id="contact_email" name="contact_email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input id="contact_phone" name="contact_phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_terms_days">Payment Terms (days)</Label>
                <Input id="payment_terms_days" name="payment_terms_days" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
              </div>
              <div className="col-span-2"><Button type="submit">Create Supplier</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, type, or country..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Payment Terms</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{search ? 'No suppliers match' : 'No suppliers yet'}</TableCell></TableRow>
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/suppliers/${s.id}`)}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.type ? <Badge className={TYPE_COLORS[s.type] || ''}>{s.type}</Badge> : 'N/A'}</TableCell>
                  <TableCell>{s.country || 'N/A'}</TableCell>
                  <TableCell>{s.contact_name || 'N/A'}</TableCell>
                  <TableCell>{s.payment_terms_days ? `${s.payment_terms_days} days` : 'N/A'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
