'use client';

import Link from 'next/link';
import { Breadcrumbs } from '@/components/breadcrumbs';
import type { User } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, FileText, Users, ClipboardList, ArrowDownLeft, ArrowUpRight, UserCircle } from 'lucide-react';

interface Props {
  agent: User;
  proposals: Record<string, unknown>[];
  clients: Record<string, unknown>[];
  receivables: Record<string, unknown>[];
  payables: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function AgentDetailClient({ agent, proposals, clients, receivables, payables, bookings }: Props) {
  const pendingReceivables = receivables.filter(r => r.status === 'pending');
  const pendingPayables = payables.filter(p => p.status === 'pending');
  const totalReceivable = pendingReceivables.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalPayable = pendingPayables.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const statusCounts: Record<string, number> = {};
  proposals.forEach(p => {
    const s = p.status as string;
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Team', href: '/admin/users' },
        { label: agent.full_name },
      ]} />
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{agent.full_name}</h1>
            <p className="text-sm text-muted-foreground">{agent.email} &middot; <span className="capitalize">{agent.role.replace('_', ' ')}</span></p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Agent Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span className="text-muted-foreground">Agency:</span> {agent.agency_name || '—'}</div>
        <div><span className="text-muted-foreground">WhatsApp:</span> {agent.whatsapp_number || '—'}</div>
        <div><span className="text-muted-foreground">Currency:</span> {agent.default_currency}</div>
        <div><span className="text-muted-foreground">Joined:</span> {new Date(agent.created_at).toLocaleDateString()}</div>
      </div>

      {/* Stats — simulated dashboard view */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Proposals</span>
            </div>
            <p className="text-3xl font-bold">{proposals.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Clients</span>
            </div>
            <p className="text-3xl font-bold">{clients.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardList className="h-4 w-4" />
              <span className="text-sm">Bookings</span>
            </div>
            <p className="text-3xl font-bold">{bookings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <ArrowDownLeft className="h-4 w-4" />
              <span className="text-sm">Receivable</span>
            </div>
            <p className="text-2xl font-bold">₹{totalReceivable.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-sm">Payable</span>
            </div>
            <p className="text-2xl font-bold">₹{totalPayable.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Proposal status breakdown */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Badge key={status} className={STATUS_COLORS[status] || 'bg-gray-100'}>
            {status}: {count}
          </Badge>
        ))}
      </div>

      {/* Recent Proposals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {!proposals.length ? (
            <p className="text-sm text-muted-foreground">No proposals yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.slice(0, 10).map((p) => (
                  <TableRow key={p.id as string}>
                    <TableCell className="font-medium">{p.title as string}</TableCell>
                    <TableCell>{(p.clients as Record<string, unknown>)?.full_name as string || '—'}</TableCell>
                    <TableCell>{p.destination as string || '—'}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[p.status as string] || ''}>{p.status as string}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(p.created_at as string).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {!clients.length ? (
            <p className="text-sm text-muted-foreground">No clients yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.slice(0, 10).map((c) => (
                  <TableRow key={c.id as string}>
                    <TableCell className="font-medium">{c.full_name as string}</TableCell>
                    <TableCell>{c.email as string || '—'}</TableCell>
                    <TableCell>{c.phone as string || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.created_at as string).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      {bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id as string}>
                    <TableCell>{(b.proposals as Record<string, unknown>)?.title as string || '—'}</TableCell>
                    <TableCell>{(b.suppliers as Record<string, unknown>)?.name as string || '—'}</TableCell>
                    <TableCell>{b.service_type as string || '—'}</TableCell>
                    <TableCell>₹{Number(b.cost_amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{b.status as string}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
