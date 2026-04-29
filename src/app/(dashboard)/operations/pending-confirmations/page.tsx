'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { ITEM_TYPE_LABELS, SUPPLIER_STATUS_COLORS } from '@/lib/types/booking-items';
import type { BookingItem, ItemType, SupplierStatus } from '@/lib/types/booking-items';

interface PendingItem extends BookingItem {
  bookings: {
    id: string;
    title: string;
    destination: string | null;
    suppliers: { name: string } | null;
    clients: { full_name: string } | null;
  };
}

export default function PendingConfirmationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('booking_items')
      .select('*, bookings(id, title, destination, suppliers(name), clients(full_name))')
      .in('supplier_status', ['pending', 'requested'])
      .order('start_date', { ascending: true });
    setItems((data || []) as PendingItem[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const markConfirmed = async (item: PendingItem) => {
    await fetch(`/api/bookings/${item.booking_id}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, supplier_status: 'confirmed' }),
    });
    fetchItems();
  };

  // Group items by booking
  const grouped = items.reduce<Record<string, PendingItem[]>>((acc, item) => {
    (acc[item.booking_id] ||= []).push(item);
    return acc;
  }, {});

  const totalPending = items.length;
  const totalBookings = Object.keys(grouped).length;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading pending confirmations...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pending Confirmations</h1>
        <p className="text-muted-foreground">
          {totalPending} item{totalPending !== 1 ? 's' : ''} pending confirmation across {totalBookings} booking{totalBookings !== 1 ? 's' : ''}
        </p>
      </div>

      {totalPending === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-medium">All clear!</p>
          <p className="text-muted-foreground">No pending supplier confirmations.</p>
        </Card>
      ) : (
        Object.entries(grouped).map(([bookingId, bookingItems]) => {
          const booking = bookingItems[0].bookings;
          return (
            <Card key={bookingId}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {booking.title}
                    <Badge variant="outline" className="text-xs">{bookingItems.length} pending</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {booking.clients?.full_name || 'No client'}
                    {booking.suppliers?.name && ` · ${booking.suppliers.name}`}
                    {booking.destination && ` · ${booking.destination}`}
                  </p>
                </div>
                <Link href={`/bookings/${bookingId}`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> View Booking
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell><Badge variant="outline">{ITEM_TYPE_LABELS[item.item_type as ItemType]}</Badge></TableCell>
                        <TableCell className="font-medium">{item.label}</TableCell>
                        <TableCell>{item.start_date ? format(new Date(item.start_date), 'dd MMM yyyy') : '-'}</TableCell>
                        <TableCell><Badge className={SUPPLIER_STATUS_COLORS[item.supplier_status as SupplierStatus]}>{item.supplier_status}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="text-green-600" onClick={() => markConfirmed(item)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
