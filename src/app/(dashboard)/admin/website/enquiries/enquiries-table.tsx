'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Flame, Thermometer, Snowflake } from 'lucide-react';

type Enquiry = Record<string, unknown>;

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  qualified: 'bg-purple-100 text-purple-700',
  proposal_sent: 'bg-indigo-100 text-indigo-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-gray-100 text-gray-700',
  spam: 'bg-red-100 text-red-700',
};

const PRIORITY_ICONS: Record<string, { icon: typeof Flame; color: string }> = {
  urgent: { icon: Flame, color: 'text-red-500' },
  high: { icon: Flame, color: 'text-orange-500' },
  medium: { icon: Thermometer, color: 'text-yellow-500' },
  low: { icon: Snowflake, color: 'text-blue-400' },
};

const TABS = ['all', 'new', 'contacted', 'qualified', 'proposal_sent', 'won'] as const;

export default function EnquiriesTable({ initialData }: { initialData: Enquiry[] }) {
  const router = useRouter();
  const enquiries = initialData;
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? enquiries : enquiries.filter(e => e.status === filter);

  return (
    <>
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {TABS.map(tab => (
          <Button
            key={tab}
            variant={filter === tab ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(tab)}
            className="capitalize"
          >
            {tab} {tab !== 'all' && `(${enquiries.filter(e => e.status === tab).length})`}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel Date</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No enquiries found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => {
                  const phone = (e.phone as string || '').replace(/\D/g, '').replace(/^0+/, '');
                  const waPhone = phone.startsWith('91') ? phone : `91${phone}`;
                  const pri = PRIORITY_ICONS[(e.priority as string) || 'medium'];
                  const PriIcon = pri?.icon || Thermometer;
                  return (
                    <TableRow
                      key={e.id as string}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/admin/website/enquiries/${e.id}`)}
                    >
                      <TableCell className="w-8">
                        <PriIcon className={`h-4 w-4 ${pri?.color || 'text-yellow-500'}`} />
                      </TableCell>
                      <TableCell className="font-medium">{e.name as string}</TableCell>
                      <TableCell>
                        <a
                          href={`https://wa.me/${waPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline text-sm"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {e.phone as string}
                        </a>
                      </TableCell>
                      <TableCell>{e.destination as string}</TableCell>
                      <TableCell className="text-sm">{(e.travel_date as string) || '—'}</TableCell>
                      <TableCell>{e.adults as number}{(e.children as number) > 0 ? ` + ${e.children}C` : ''}</TableCell>
                      <TableCell className="text-sm">{(e.budget_range as string) || '—'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[(e.status as string) || 'new']}>
                          {(e.status as string)?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(e.follow_up_date as string) || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {new Date(e.created_at as string).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
