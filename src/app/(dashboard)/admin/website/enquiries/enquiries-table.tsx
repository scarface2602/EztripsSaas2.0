'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

type Enquiry = Record<string, unknown>;

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-green-100 text-green-700',
  spam: 'bg-red-100 text-red-700',
};

const TABS = ['all', 'new', 'contacted', 'closed'] as const;

export default function EnquiriesTable({ initialData }: { initialData: Enquiry[] }) {
  const [enquiries, setEnquiries] = useState<Enquiry[]>(initialData);
  const [filter, setFilter] = useState<string>('all');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  const filtered = filter === 'all' ? enquiries : enquiries.filter(e => e.status === filter);

  async function updateStatus(id: string, status: string) {
    const res = await fetch('/api/website/cms/enquiries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    }
  }

  async function saveNotes(id: string) {
    const res = await fetch('/api/website/cms/enquiries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes: notesValue }),
    });
    if (res.ok) {
      setEnquiries(prev => prev.map(e => e.id === id ? { ...e, notes: notesValue } : e));
      setEditingNotes(null);
    }
  }

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
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel Date</TableHead>
                <TableHead>Adults</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
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
                  return (
                    <TableRow key={e.id as string}>
                      <TableCell className="font-medium">{e.name as string}</TableCell>
                      <TableCell className="text-sm">{e.email as string}</TableCell>
                      <TableCell>
                        <a
                          href={`https://wa.me/${waPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline text-sm"
                        >
                          {e.phone as string}
                        </a>
                      </TableCell>
                      <TableCell>{e.destination as string}</TableCell>
                      <TableCell className="text-sm">{(e.travel_date as string) || '—'}</TableCell>
                      <TableCell>{e.adults as number}</TableCell>
                      <TableCell className="text-sm">{(e.budget_range as string) || '—'}</TableCell>
                      <TableCell>
                        <Select
                          value={e.status as string}
                          onValueChange={(val) => val && updateStatus(e.id as string, val)}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <Badge className={STATUS_COLORS[(e.status as string) || 'new']}>
                              {e.status as string}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="spam">Spam</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {editingNotes === (e.id as string) ? (
                          <div className="flex gap-1">
                            <Input
                              value={notesValue}
                              onChange={(ev) => setNotesValue(ev.target.value)}
                              className="h-8 text-sm w-40"
                              onKeyDown={(ev) => ev.key === 'Enter' && saveNotes(e.id as string)}
                            />
                            <Button size="sm" variant="outline" onClick={() => saveNotes(e.id as string)}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="text-sm text-muted-foreground hover:text-foreground text-left"
                            onClick={() => {
                              setEditingNotes(e.id as string);
                              setNotesValue((e.notes as string) || '');
                            }}
                          >
                            {(e.notes as string) || 'Add note...'}
                          </button>
                        )}
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
