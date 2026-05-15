'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Proposal } from '@/lib/types/database';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, FileText } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const supabase = useMemo(() => createClient(), []);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('proposals').select('*, clients(full_name)').order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    if (search) q = q.or(`title.ilike.%${search}%,destination.ilike.%${search}%`);
    const { data } = await q;
    setProposals((data as Proposal[]) || []);
    setLoading(false);
  }, [supabase, statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchProposals(), 300);
    return () => clearTimeout(timer);
  }, [fetchProposals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Proposals</h1>
          {statusFilter && <Badge className={STATUS_COLORS[statusFilter]}>{statusFilter}</Badge>}
        </div>
        <Link href="/proposals/new"><Button><Plus className="h-4 w-4 mr-2" /> New Proposal</Button></Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search proposals..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        {statusFilter && (
          <Button variant="outline" onClick={() => router.push('/proposals')}>Clear Filter</Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Pax</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : proposals.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No proposals found</TableCell></TableRow>
            ) : proposals.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/proposals/${p.id}`)}>
                <TableCell className="font-medium">{(p as Proposal & { clients?: { full_name: string } }).clients?.full_name ? `${(p as Proposal & { clients?: { full_name: string } }).clients!.full_name.split(' ')[0]}'s Trip to ${p.destination}` : `Trip to ${p.destination}`}</TableCell>
                <TableCell>{p.destination || 'N/A'}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge></TableCell>
                <TableCell>V{p.version}</TableCell>
                <TableCell>{p.pax_adults}A{p.pax_children > 0 ? ` + ${p.pax_children}C` : ''}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(p.created_at), 'dd/MM/yyyy')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
