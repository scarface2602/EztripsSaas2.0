'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Client, Proposal, ClientLedgerEntry } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Building2, GitMerge, Pencil, Trash2, User } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ClientCombobox, ClientQuickEditDialog } from '@/components/clients/client-combobox';
import { GST_STATE_CODES } from '@/lib/utils/gstin';

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
  const [contactName, setContactName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<{ id: string; label: string } | null>(null);
  const [merging, setMerging] = useState(false);

  const fetchData = useCallback(async () => {
    const [clientRes, proposalsRes, ledgerRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('proposals').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('client_ledger').select('*').eq('client_id', clientId).order('created_at', { ascending: true }),
    ]);

    const c = clientRes.data as Client | null;
    if (c) {
      setClient(c);
      if (c.contact_client_id) {
        const { data: contact } = await supabase.from('clients').select('full_name').eq('id', c.contact_client_id).single();
        setContactName(contact?.full_name || null);
      } else {
        setContactName(null);
      }
    }
    setProposals((proposalsRes.data as Proposal[]) || []);
    setLedger((ledgerRes.data as ClientLedgerEntry[]) || []);
  }, [clientId, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleMerge() {
    if (!mergeTarget || merging) return;
    setMerging(true);
    try {
      const res = await fetch('/api/clients/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: clientId, target_id: mergeTarget.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Merge failed');
      toast.success(`Merged into ${mergeTarget.label}`);
      router.push(`/clients/${mergeTarget.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Merge failed');
      setMerging(false);
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
          <CardTitle className="flex items-center gap-2">
            {client.full_name}
            {(client.client_kind || 'individual') === 'business' ? (
              <Badge variant="outline" className="text-xs"><Building2 className="h-3 w-3 mr-1" /> Business</Badge>
            ) : (
              <Badge variant="outline" className="text-xs"><User className="h-3 w-3 mr-1" /> Individual</Badge>
            )}
            {client.gstin && (
              <Badge variant="outline" className="text-xs text-green-700 border-green-300">GST registered</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}>
              <GitMerge className="h-4 w-4 mr-1" /> Merge
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Phone:</span> {client.phone || 'N/A'}</div>
            <div><span className="text-muted-foreground">Email:</span> {client.email || 'N/A'}</div>
            <div><span className="text-muted-foreground">Nationality:</span> {client.nationality || 'N/A'}</div>
            <div><span className="text-muted-foreground">Created:</span> {format(new Date(client.created_at), 'dd/MM/yyyy')}</div>
            {client.gstin && (
              <>
                <div><span className="text-muted-foreground">GSTIN:</span> <span className="font-mono">{client.gstin}</span></div>
                <div>
                  <span className="text-muted-foreground">GST State:</span>{' '}
                  {client.gst_state_code ? GST_STATE_CODES[client.gst_state_code] || client.gst_state_code : 'N/A'}
                </div>
              </>
            )}
            {client.gst_legal_name && (
              <div><span className="text-muted-foreground">Legal Name:</span> {client.gst_legal_name}</div>
            )}
            {client.pan_number && (
              <div><span className="text-muted-foreground">PAN:</span> <span className="font-mono">{client.pan_number}</span></div>
            )}
            {contactName && (
              <div><span className="text-muted-foreground">Contact Person:</span> {contactName}</div>
            )}
            {client.billing_address && (
              <div className="col-span-full"><span className="text-muted-foreground">Billing Address:</span> {client.billing_address}</div>
            )}
            {client.notes && <div className="col-span-full"><span className="text-muted-foreground">Notes:</span> {client.notes}</div>}
          </div>
        </CardContent>
      </Card>

      {editing && (
        <ClientQuickEditDialog
          clientId={clientId}
          open={editing}
          onOpenChange={setEditing}
          onSaved={() => fetchData()}
        />
      )}

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge duplicate client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Everything linked to <strong>{client.full_name}</strong> — bookings, proposals, payments, ledger —
              moves to the client you pick below, and this record is deleted. This cannot be undone.
            </p>
            <ClientCombobox
              value={mergeTarget}
              onChange={(c) => setMergeTarget(c ? { id: c.id, label: c.full_name } : null)}
              placeholder="Merge into…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!mergeTarget || merging} onClick={handleMerge}>
              {merging ? 'Merging…' : 'Merge & delete this record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
