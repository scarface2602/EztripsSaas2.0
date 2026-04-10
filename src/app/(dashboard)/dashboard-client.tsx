'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { FileText, Users, Clock, ArrowDownLeft, ArrowUpRight, Plus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { differenceInHours, format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

interface DashboardClientProps {
  proposals: Record<string, unknown>[];
  receivables: Record<string, unknown>[];
  payables: Record<string, unknown>[];
}

export function DashboardClient({ proposals, receivables, payables }: DashboardClientProps) {
  const allProposals = proposals || [];

  const statusCounts = { draft: 0, sent: 0, viewed: 0, confirmed: 0, cancelled: 0 };
  allProposals.forEach(p => {
    const s = p.status as string;
    if (s in statusCounts) statusCounts[s as keyof typeof statusCounts]++;
  });

  const outstandingReceivables = (receivables || []).reduce((s, r) => s + Number(r.amount), 0);
  const outstandingPayables = (payables || []).reduce((s, p) => s + Number(p.amount), 0);
  const confirmedProposals = allProposals.filter(p => p.status === 'confirmed');

  const now = new Date();
  const expiringSoon = allProposals.filter(p => {
    if (p.status === 'confirmed' || p.status === 'cancelled') return false;
    const flightExp = p.flight_expires_at ? new Date(p.flight_expires_at as string) : null;
    const landExp = p.land_expires_at ? new Date(p.land_expires_at as string) : null;
    const flightHours = flightExp ? differenceInHours(flightExp, now) : 999;
    const landHours = landExp ? differenceInHours(landExp, now) : 999;
    return flightHours < 48 || landHours < 48;
  });

  const recentProposals = allProposals.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/proposals/new">
            <Button><Plus className="h-4 w-4 mr-2" /> New Proposal</Button>
          </Link>
          <Link href="/clients">
            <Button variant="outline"><Users className="h-4 w-4 mr-2" /> Clients</Button>
          </Link>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-5 gap-4">
        {(Object.entries(statusCounts) as [string, number][]).map(([status, count]) => (
          <Link key={status} href={`/proposals?status=${status}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground capitalize">{status}</p>
                    <p className="text-3xl font-bold">{count}</p>
                  </div>
                  <Badge className={STATUS_COLORS[status]}>{status}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Financial Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowDownLeft className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Receivables</p>
                <p className="text-2xl font-bold">{outstandingReceivables.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowUpRight className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Payables</p>
                <p className="text-2xl font-bold">{outstandingPayables.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Confirmed Proposals</p>
                <p className="text-2xl font-bold">{confirmedProposals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon */}
      {expiringSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" /> Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Flight Expires</TableHead>
                  <TableHead>Land Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringSoon.map((p) => {
                  const flightHrs = p.flight_expires_at ? differenceInHours(new Date(p.flight_expires_at as string), now) : null;
                  const landHrs = p.land_expires_at ? differenceInHours(new Date(p.land_expires_at as string), now) : null;
                  return (
                    <TableRow key={p.id as string}>
                      <TableCell>
                        <Link href={`/proposals/${p.id}`} className="text-blue-600 hover:underline font-medium">
                          {(p.title as string) || 'Untitled'}
                        </Link>
                      </TableCell>
                      <TableCell>{(p.destination as string) || 'N/A'}</TableCell>
                      <TableCell>
                        {flightHrs !== null ? (
                          <span className={flightHrs < 0 ? 'text-red-600 font-bold' : flightHrs < 24 ? 'text-amber-600 font-medium' : ''}>
                            {flightHrs < 0 ? 'EXPIRED' : `${flightHrs}h remaining`}
                          </span>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {landHrs !== null ? (
                          <span className={landHrs < 24 ? 'text-amber-600 font-medium' : ''}>
                            {landHrs < 0 ? 'EXPIRED' : `${landHrs}h remaining`}
                          </span>
                        ) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" /> Recent Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProposals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No proposals yet. Create your first proposal!
                  </TableCell>
                </TableRow>
              ) : (
                recentProposals.map((p) => (
                  <TableRow key={p.id as string}>
                    <TableCell>
                      <Link href={`/proposals/${p.id}`} className="text-blue-600 hover:underline font-medium">
                        {(p.title as string) || 'Untitled'}
                      </Link>
                    </TableCell>
                    <TableCell>{(p.destination as string) || 'N/A'}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[p.status as string]}>{p.status as string}</Badge></TableCell>
                    <TableCell>V{p.version as number}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(p.created_at as string), 'dd/MM/yyyy')}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
