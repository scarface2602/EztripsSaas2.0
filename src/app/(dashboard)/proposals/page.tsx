'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
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
import { Pagination } from '@/components/pagination';
import { SortableHead, useSort } from '@/components/sortable-head';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function ProposalsPage() {
  return (
    <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading proposals...</div>}>
      <ProposalsContent />
    </Suspense>
  );
}

function ProposalsContent() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { sortCol, sortDir, onSort } = useSort('created_at', 'desc');
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const supabase = useMemo(() => createClient(), []);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('proposals').select('*, clients(full_name)', { count: 'exact' }).order(sortCol, { ascending: sortDir === 'asc' });
    if (statusFilter) q = q.eq('status', statusFilter);
    if (search) q = q.or(`title.ilike.%${search}%,destination.ilike.%${search}%`);
    const { data, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setProposals((data as Proposal[]) || []);
    setTotalPages(Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)));
    setLoading(false);
  }, [supabase, statusFilter, search, page, sortCol, sortDir]);

  useEffect(() => {
    const timer = setTimeout(() => fetchProposals(), 300);
    return () => clearTimeout(timer);
  }, [fetchProposals]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

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
              <SortableHead label="Title" column="destination" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
              <TableHead>Trip ID</TableHead>
              <SortableHead label="Destination" column="destination" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
              <SortableHead label="Status" column="status" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
              <TableHead>Version</TableHead>
              <TableHead>Pax</TableHead>
              <SortableHead label="Created" column="created_at" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : proposals.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No proposals found</TableCell></TableRow>
            ) : proposals.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/proposals/${p.id}`)}>
                <TableCell className="font-medium">{(p as Proposal & { clients?: { full_name: string } }).clients?.full_name ? `${(p as Proposal & { clients?: { full_name: string } }).clients!.full_name.split(' ')[0]}'s Trip to ${p.destination}` : `Trip to ${p.destination}`}</TableCell>
                <TableCell><span className="text-[11px] font-mono text-blue-600">{(p as unknown as Record<string, unknown>).trip_id as string || '—'}</span></TableCell>
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
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
