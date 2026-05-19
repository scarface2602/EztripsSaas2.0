'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { Pagination } from '@/components/pagination';
import { SortableHead, useSort } from '@/components/sortable-head';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  blocked: 'bg-purple-100 text-purple-700',
  confirmed: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

const TYPE_LABELS: Record<string, string> = {
  package: 'Package',
  hotel: 'Hotel',
  land: 'Land',
  flight: 'Flight',
};

interface Booking {
  id: string;
  title: string;
  booking_type: string;
  destination: string | null;
  status: string;
  travel_start: string | null;
  travel_end: string | null;
  pax_adults: number;
  pax_children: number;
  sell_price: number;
  cost_price: number;
  total_paid: number;
  next_payment_date: string | null;
  next_payment_amount: number | null;
  currency: string;
  created_at: string;
  clients: { full_name: string; phone: string | null; email: string | null } | null;
  suppliers: { name: string } | null;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { sortCol, sortDir, onSort } = useSort('created_at', 'desc');
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const proposalFilter = searchParams.get('proposal_id');
  const supabase = useMemo(() => createClient(), []);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('bookings')
      .select('*, clients(full_name, phone, email), suppliers(name)', { count: 'exact' })
      .order(sortCol, { ascending: sortDir === 'asc' });
    if (statusFilter) q = q.eq('status', statusFilter);
    if (proposalFilter) q = q.eq('proposal_id', proposalFilter);
    if (search) q = q.or(`title.ilike.%${search}%,destination.ilike.%${search}%`);
    const { data, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setBookings((data as Booking[]) || []);
    setTotalPages(Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)));
    setLoading(false);
  }, [supabase, statusFilter, proposalFilter, search, page, sortCol, sortDir]);

  useEffect(() => {
    const timer = setTimeout(() => fetchBookings(), 300);
    return () => clearTimeout(timer);
  }, [fetchBookings]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const margin = (b: Booking) => b.sell_price - b.cost_price;

  const statuses = ['pending', 'blocked', 'confirmed', 'in_progress', 'completed', 'cancelled'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Bookings</h1>
          {statusFilter && <Badge className={STATUS_COLORS[statusFilter]}>{statusFilter.replace('_', ' ')}</Badge>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        {statusFilter && (
          <Button variant="outline" onClick={() => router.push('/bookings')}>Clear Filter</Button>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {statuses.map((s) => {
          const count = bookings.filter((b) => b.status === s).length;
          return (
            <Card key={s} className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/bookings?status=${s}`)}>
              <p className="text-xs text-muted-foreground capitalize">{s.replace('_', ' ')}</p>
              <p className="text-xl font-bold">{count}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Title" column="title" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
              <SortableHead label="Type" column="booking_type" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
              <TableHead>Client</TableHead>
              <TableHead>Supplier</TableHead>
              <SortableHead label="Travel Dates" column="travel_start" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
              <SortableHead label="Status" column="status" currentSort={sortCol} currentDir={sortDir} onSort={onSort} />
              <SortableHead label="Cost" column="cost_price" currentSort={sortCol} currentDir={sortDir} onSort={onSort} className="text-right" />
              <SortableHead label="Sell" column="sell_price" currentSort={sortCol} currentDir={sortDir} onSort={onSort} className="text-right" />
              <TableHead className="text-right">Margin</TableHead>
              <SortableHead label="Paid" column="total_paid" currentSort={sortCol} currentDir={sortDir} onSort={onSort} className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : bookings.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No bookings found</TableCell></TableRow>
            ) : bookings.map((b) => (
              <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/bookings/${b.id}`)}>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{TYPE_LABELS[b.booking_type] || b.booking_type}</Badge></TableCell>
                <TableCell>{b.clients?.full_name || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{b.suppliers?.name || '-'}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {b.travel_start ? format(new Date(b.travel_start), 'dd MMM') : '-'}
                  {b.travel_end ? ` – ${format(new Date(b.travel_end), 'dd MMM')}` : ''}
                </TableCell>
                <TableCell><Badge className={STATUS_COLORS[b.status]}>{b.status.replace('_', ' ')}</Badge></TableCell>
                <TableCell className="text-right">{Number(b.cost_price).toLocaleString()}</TableCell>
                <TableCell className="text-right">{Number(b.sell_price).toLocaleString()}</TableCell>
                <TableCell className={`text-right font-medium ${margin(b) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {margin(b).toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{Number(b.total_paid).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
