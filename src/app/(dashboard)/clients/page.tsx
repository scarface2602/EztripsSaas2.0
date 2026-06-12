'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Client } from '@/lib/types/database';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, X, Users, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { Pagination } from '@/components/pagination';
import { SortableHead, useSort } from '@/components/sortable-head';

const PAGE_SIZE = 20;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const { sortCol, sortDir, onSort } = useSort('created_at', 'desc');
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const fetchClients = useCallback(async (query: string) => {
    setLoading(true);
    let q = supabase.from('clients').select('*', { count: 'exact' }).order(sortCol, { ascending: sortDir === 'asc' });

    if (query) {
      q = q.or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
    }

    const { data, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setClients((data as Client[]) || []);
    setTotalPages(Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)));
    setLoading(false);
  }, [supabase, page, sortCol, sortDir]);

  useEffect(() => {
    const timer = setTimeout(() => fetchClients(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchClients]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const [newKind, setNewKind] = useState<'individual' | 'business'>('individual');

  async function handleAddClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = new FormData(e.currentTarget);

    // Through the API so GSTIN/PAN validation and normalization apply.
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: form.get('full_name') as string,
        client_kind: newKind,
        phone: (form.get('phone') as string) || '',
        email: (form.get('email') as string) || '',
        notes: (form.get('notes') as string) || undefined,
        ...(newKind === 'business' ? {
          gstin: (form.get('gstin') as string) || '',
          gst_legal_name: (form.get('gst_legal_name') as string) || '',
        } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = Array.isArray(err.details) && err.details[0]?.message
        ? `${err.details[0].path?.join('.')}: ${err.details[0].message}`
        : err.error || 'Failed to create client';
      setFormError(detail);
      return;
    }
    setShowAddForm(false);
    setNewKind('individual');
    fetchClients(search);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Clients</h1>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showAddForm ? 'Cancel' : 'Add Client'}
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Client</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddClient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {formError && (
                <div className="col-span-full p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{formError}</div>
              )}
              <div className="col-span-full flex gap-2">
                <Button type="button" size="sm" variant={newKind === 'individual' ? 'default' : 'outline'} onClick={() => setNewKind('individual')}>
                  <Users className="h-3.5 w-3.5 mr-1" /> Individual
                </Button>
                <Button type="button" size="sm" variant={newKind === 'business' ? 'default' : 'outline'} onClick={() => setNewKind('business')}>
                  <Building2 className="h-3.5 w-3.5 mr-1" /> Business
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">{newKind === 'business' ? 'Business Name *' : 'Full Name *'}</Label>
                <Input id="full_name" name="full_name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone {newKind === 'individual' ? '*' : ''}</Label>
                <Input id="phone" name="phone" required={newKind === 'individual'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              {newKind === 'business' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="gstin">GSTIN</Label>
                    <Input id="gstin" name="gstin" placeholder="27AAPFU0939F1ZV" className="uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gst_legal_name">Legal Name (as per GST)</Label>
                    <Input id="gst_legal_name" name="gst_legal_name" />
                  </div>
                </>
              )}
              <div className="col-span-full space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
              </div>
              <div className="col-span-full">
                <Button type="submit">Create {newKind === 'business' ? 'Business' : 'Client'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Name" column="full_name" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
              <SortableHead label="Type" column="client_kind" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <SortableHead label="Created" column="created_at" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {search ? 'No clients match your search' : 'No clients yet'}
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <TableCell className="font-medium">{client.full_name}</TableCell>
                  <TableCell>
                    {(client.client_kind || 'individual') === 'business' ? (
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" /> Business{client.gstin ? ' · GST' : ''}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Individual</span>
                    )}
                  </TableCell>
                  <TableCell>{client.phone || <Badge variant="outline">N/A</Badge>}</TableCell>
                  <TableCell>{client.email || <Badge variant="outline">N/A</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(client.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
