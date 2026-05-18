'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Lead = Record<string, unknown>;

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  qualified: 'bg-purple-100 text-purple-700',
  proposal_sent: 'bg-indigo-100 text-indigo-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-gray-100 text-gray-700',
};

export default function LeadsClient({
  myLeads: initialMyLeads,
  unassignedLeads: initialUnassigned,
  activeCount: initialActive,
  maxLeads,
}: {
  myLeads: Lead[];
  unassignedLeads: Lead[];
  activeCount: number;
  maxLeads: number;
}) {
  const router = useRouter();
  const [myLeads, setMyLeads] = useState(initialMyLeads);
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [activeCount, setActiveCount] = useState(initialActive);
  const [picking, setPicking] = useState<string | null>(null);

  async function handlePick(enquiryId: string) {
    setPicking(enquiryId);
    try {
      const res = await fetch('/api/enquiries/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiry_id: enquiryId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to pick lead');
        return;
      }
      const picked = await res.json();
      setUnassigned(prev => prev.filter(e => e.id !== enquiryId));
      setMyLeads(prev => [picked, ...prev]);
      setActiveCount(prev => prev + 1);
      router.refresh();
    } catch {
      alert('Failed to pick lead');
    } finally {
      setPicking(null);
    }
  }

  return (
    <>
      {/* Capacity indicator */}
      <Card>
        <CardContent className="pt-6 flex items-center gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Active Leads</p>
            <p className="text-3xl font-bold">{activeCount} <span className="text-lg text-muted-foreground">/ {maxLeads}</span></p>
          </div>
          <div className="flex-1">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${activeCount >= maxLeads ? 'bg-red-500' : activeCount >= maxLeads * 0.8 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, (activeCount / maxLeads) * 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Leads */}
      <Card>
        <CardHeader>
          <CardTitle>My Assigned Leads ({myLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel Date</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No leads assigned to you yet
                  </TableCell>
                </TableRow>
              ) : myLeads.map(e => (
                <TableRow
                  key={e.id as string}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/admin/website/enquiries/${e.id}`)}
                >
                  <TableCell className="font-medium">{e.name as string}</TableCell>
                  <TableCell>{e.destination as string}</TableCell>
                  <TableCell className="text-sm">{(e.travel_date as string) || '—'}</TableCell>
                  <TableCell>{e.adults as number}{(e.children as number) > 0 ? ` + ${e.children}C` : ''}</TableCell>
                  <TableCell className="text-sm">{(e.budget_range as string) || '—'}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[(e.status as string) || 'new']}>
                      {(e.status as string)?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(e.created_at as string).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unassigned Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Available Leads ({unassigned.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel Date</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unassigned.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No unassigned leads available
                  </TableCell>
                </TableRow>
              ) : unassigned.map(e => (
                <TableRow key={e.id as string}>
                  <TableCell className="font-medium">{e.name as string}</TableCell>
                  <TableCell>{e.destination as string}</TableCell>
                  <TableCell className="text-sm">{(e.travel_date as string) || '—'}</TableCell>
                  <TableCell>{e.adults as number}{(e.children as number) > 0 ? ` + ${e.children}C` : ''}</TableCell>
                  <TableCell className="text-sm">{(e.budget_range as string) || '—'}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[(e.status as string) || 'new']}>
                      {(e.status as string)?.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={picking === (e.id as string) || activeCount >= maxLeads}
                      onClick={() => handlePick(e.id as string)}
                    >
                      {picking === (e.id as string) ? 'Picking...' : 'Pick'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
