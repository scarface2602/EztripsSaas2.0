'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Client, Proposal, ClientLedgerEntry } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Save, Trash2, X } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [client, setClient] = useState<Client | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [ledger, setLedger] = useState<ClientLedgerEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});

  const fetchData = useCallback(async () => {
    const [clientRes, proposalsRes, ledgerRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('proposals').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('client_ledger').select('*').eq('client_id', clientId).order('created_at', { ascending: true }),
    ]);

    if (clientRes.data) {
      setClient(clientRes.data as Client);
      setEditData(clientRes.data);
    }
    setProposals((proposalsRes.data as Proposal[]) || []);
    setLedger((ledgerRes.data as ClientLedgerEntry[]) || []);
  }, [clientId, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave() {
    const { error } = await supabase
      .from('clients')
      .update({
        full_name: editData.full_name,
        phone: editData.phone,
        email: editData.email,
        nationality: editData.nationality,
        notes: editData.notes,
      })
      .eq('id', clientId);

    if (!error) {
      setEditing(false);
      fetchData();
      toast.success('Client updated');
    } else {
      toast.error('Failed to update client');
    }
  }

  async function handleDelete() {
    if (proposals.length > 0) {
      toast.error('Cannot delete a client with linked proposals');
      return;
    }
    if (!confirm('Are you sure you want to delete this client?')) return;

    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (!error) router.push('/clients');
    else toast.error('Failed to delete client');
  }

  if (!client) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  let runningBalance = 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Clients', href: '/clients' },
        { label: client.full_name },
      ]} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{editing ? 'Edit Client' : client.full_name}</CardTitle>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditData(client); }}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={editData.full_name || ''} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editData.phone || ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input value={editData.nationality || ''} onChange={(e) => setEditData({ ...editData, nationality: e.target.value })} />
              </div>
              <div className="col-span-full space-y-2">
                <Label>Notes</Label>
                <Input value={editData.notes || ''} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Phone:</span> {client.phone}</div>
              <div><span className="text-muted-foreground">Email:</span> {client.email || 'N/A'}</div>
              <div><span className="text-muted-foreground">Nationality:</span> {client.nationality || 'N/A'}</div>
              <div><span className="text-muted-foreground">Created:</span> {format(new Date(client.created_at), 'dd/MM/yyyy')}</div>
              {client.notes && <div className="col-span-full"><span className="text-muted-foreground">Notes:</span> {client.notes}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Linked Proposals ({proposals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <p className="text-muted-foreground text-sm">No proposals yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/proposals/${p.id}`)}
                  >
                    <TableCell className="font-medium">{p.title || 'Untitled'}</TableCell>
                    <TableCell>{p.destination || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(p.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ledger History</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-muted-foreground text-sm">No transactions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => {
                  if (entry.type === 'credit') runningBalance += entry.amount;
                  else runningBalance -= entry.amount;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(entry.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {entry.type === 'credit' ? `+${entry.amount.toLocaleString()}` : ''}
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {entry.type === 'debit' ? `-${entry.amount.toLocaleString()}` : ''}
                      </TableCell>
                      <TableCell className={runningBalance >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {runningBalance.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
