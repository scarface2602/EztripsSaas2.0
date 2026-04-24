'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

interface Booking {
  id: string;
  title: string;
  destination: string | null;
  status: string;
  travel_start: string | null;
  travel_end: string | null;
  pax_adults: number;
  pax_children: number;
  total_sell_price: number;
  total_cost_price: number;
  currency: string;
  created_at: string;
  clients: { full_name: string; phone: string | null; email: string | null } | null;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const supabase = useMemo(() => createClient(), []);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('bookings')
      .select('*, clients(full_name, phone, email)')
      .order('travel_start', { ascending: true });
    if (statusFilter) q = q.eq('status', statusFilter);
    if (search) q = q.or(`title.ilike.%${search}%,destination.ilike.%${search}%`);
    const { data } = await q;
    setBookings((data as Booking[]) || []);
    setLoading(false);
  }, [supabase, statusFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchBookings(), 300);
    return () => clearTimeout(timer);
  }, [fetchBookings]);

  const margin = (b: Booking) => b.total_sell_price - b.total_cost_price;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Bookings</h1>
          {statusFilter && <Badge className={STATUS_COLORS[statusFilter]}>{statusFilter.replace('_', ' ')}</Badge>}
        </div>
        <Link href="/bookings/new"><Button><Plus className="h-4 w-4 mr-2" /> New Booking</Button></Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        {statusFilter && (
          <Button variant="outline" onClick={() => router.push('/bookings')}>Clear Filter</Button>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4">
        {['confirmed', 'in_progress', 'completed', 'cancelled'].map((s) => {
          const count = bookings.filter((b) => b.status === s).length;
          return (
            <Card key={s} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/bookings?status=${s}`)}>
              <p className="text-sm text-muted-foreground capitalize">{s.replace('_', ' ')}</p>
              <p className="text-2xl font-bold">{count}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Travel Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pax</TableHead>
              <TableHead className="text-right">Sell</TableHead>
              <TableHead className="text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : bookings.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bookings found</TableCell></TableRow>
            ) : bookings.map((b) => (
              <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/bookings/${b.id}`)}>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell>{b.clients?.full_name || '-'}</TableCell>
                <TableCell>{b.destination || '-'}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {b.travel_start ? format(new Date(b.travel_start), 'dd MMM') : '-'}
                  {b.travel_end ? ` - ${format(new Date(b.travel_end), 'dd MMM')}` : ''}
                </TableCell>
                <TableCell><Badge className={STATUS_COLORS[b.status]}>{b.status.replace('_', ' ')}</Badge></TableCell>
                <TableCell>{b.pax_adults}A{b.pax_children > 0 ? ` + ${b.pax_children}C` : ''}</TableCell>
                <TableCell className="text-right">{b.currency} {b.total_sell_price.toLocaleString()}</TableCell>
                <TableCell className={`text-right font-medium ${margin(b) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {b.currency} {margin(b).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
