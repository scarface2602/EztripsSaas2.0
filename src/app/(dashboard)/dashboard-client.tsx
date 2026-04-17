'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  FileText, Users, Clock, ArrowDownLeft, ArrowUpRight, Plus,
  TrendingUp, Search, Edit, Copy, ExternalLink, ChevronDown, ChevronRight,
} from 'lucide-react';
import { differenceInHours, format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Proposal } from '@/lib/types/database';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_ORDER = ['sent', 'viewed', 'draft', 'confirmed', 'cancelled'];
const STATUS_LABELS: Record<string, string> = {
  sent: 'Sent',
  viewed: 'Viewed',
  draft: 'Drafts',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

interface DashboardClientProps {
  proposals: Proposal[];
  receivables: Record<string, unknown>[];
  payables: Record<string, unknown>[];
}

export function DashboardClient({ proposals, receivables, payables }: DashboardClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    confirmed: true,
    cancelled: true,
  });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const allProposals = useMemo(() => proposals || [], [proposals]);
  const now = new Date();

  const filtered = useMemo(() => {
    if (!search.trim()) return allProposals;
    const q = search.toLowerCase();
    return allProposals.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.destination || '').toLowerCase().includes(q)
    );
  }, [allProposals, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Proposal[]> = {};
    STATUS_ORDER.forEach(s => { groups[s] = []; });
    filtered.forEach(p => {
      if (p.status in groups) groups[p.status].push(p);
    });
    return groups;
  }, [filtered]);

  const statusCounts: Record<string, number> = {};
  STATUS_ORDER.forEach(s => { statusCounts[s] = allProposals.filter(p => p.status === s).length; });

  const outstandingReceivables = (receivables || []).reduce((s, r) => s + Number(r.amount), 0);
  const outstandingPayables = (payables || []).reduce((s, p) => s + Number(p.amount), 0);

  const expiringSoon = allProposals.filter(p => {
    if (p.status === 'confirmed' || p.status === 'cancelled') return false;
    const flightHrs = p.flight_expires_at ? differenceInHours(new Date(p.flight_expires_at), now) : 999;
    const landHrs = p.land_expires_at ? differenceInHours(new Date(p.land_expires_at), now) : 999;
    return flightHrs < 48 || landHrs < 48;
  });

  function toggleGroup(status: string) {
    setCollapsedGroups(prev => ({ ...prev, [status]: !prev[status] }));
  }

  async function handleCopyLink(p: Proposal) {
    if (!p.share_token) return;
    const url = `${window.location.origin}/p/${p.share_token}`;
    await navigator.clipboard.writeText(url);
    setCopyFeedback(p.id);
    setTimeout(() => setCopyFeedback(null), 1500);
  }

  async function handleDuplicate(p: Proposal) {
    setDuplicating(p.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch full proposal data including related records
      const [hotelsRes, flightsRes, ancillariesRes] = await Promise.all([
        supabase.from('hotels').select('*').eq('proposal_id', p.id),
        supabase.from('flights').select('*').eq('proposal_id', p.id),
        supabase.from('line_items').select('*').eq('proposal_id', p.id),
      ]);

      // Create new proposal
      const { data: newProposal, error } = await supabase.from('proposals').insert({
        created_by: user.id,
        client_id: (p as unknown as Record<string, unknown>).client_id ?? null,
        title: `${p.title || 'Untitled'} (Copy)`,
        destination: p.destination,
        travel_start: (p as unknown as Record<string, unknown>).travel_start ?? null,
        travel_end: (p as unknown as Record<string, unknown>).travel_end ?? null,
        pax_adults: p.pax_adults,
        pax_children: p.pax_children,
        children_ages: (p as unknown as Record<string, unknown>).children_ages ?? null,
        currency: (p as unknown as Record<string, unknown>).currency ?? 'INR',
        status: 'draft',
        version: 1,
        pricing_mode: (p as unknown as Record<string, unknown>).pricing_mode ?? 'standard',
        gst_enabled: (p as unknown as Record<string, unknown>).gst_enabled ?? false,
        gst_rate: (p as unknown as Record<string, unknown>).gst_rate ?? 5,
        tcs_enabled: (p as unknown as Record<string, unknown>).tcs_enabled ?? false,
        discount_amount: (p as unknown as Record<string, unknown>).discount_amount ?? 0,
        discount_note: (p as unknown as Record<string, unknown>).discount_note ?? null,
        special_notes: (p as unknown as Record<string, unknown>).special_notes ?? null,
        dietary_notes: (p as unknown as Record<string, unknown>).dietary_notes ?? null,
        payment_terms: (p as unknown as Record<string, unknown>).payment_terms ?? null,
        rounding_unit: (p as unknown as Record<string, unknown>).rounding_unit ?? 0,
      }).select().single();

      if (error || !newProposal) throw error;

      // Duplicate hotels
      if (hotelsRes.data && hotelsRes.data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const hotelRows = hotelsRes.data.map(({ id, proposal_id, ...rest }: Record<string, unknown>) => ({
          ...rest,
          proposal_id: newProposal.id,
        }));
        await supabase.from('hotels').insert(hotelRows);
      }

      // Duplicate flights
      if (flightsRes.data && flightsRes.data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const flightRows = flightsRes.data.map(({ id, proposal_id, ...rest }: Record<string, unknown>) => ({
          ...rest,
          proposal_id: newProposal.id,
          fare_expires_at: null,
        }));
        await supabase.from('flights').insert(flightRows);
      }

      // Duplicate line items
      if (ancillariesRes.data && ancillariesRes.data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const lineRows = ancillariesRes.data.map(({ id, proposal_id, ...rest }: Record<string, unknown>) => ({
          ...rest,
          proposal_id: newProposal.id,
        }));
        await supabase.from('line_items').insert(lineRows);
      }

      router.push(`/proposals/${newProposal.id}`);
    } catch (err) {
      console.error('Duplicate failed:', err);
      alert('Failed to duplicate proposal.');
    } finally {
      setDuplicating(null);
    }
  }

  function handlePdf(p: Proposal) {
    window.open(`/api/proposals/${p.id}/pdf`, '_blank');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Stats bar — status counts */}
      <div className="grid grid-cols-5 gap-3">
        {STATUS_ORDER.map(status => (
          <Link key={status} href={`/proposals?status=${status}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{STATUS_LABELS[status]}</p>
                <p className="text-3xl font-bold">{statusCounts[status]}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <ArrowDownLeft className="h-7 w-7 text-green-600 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Receivables (pending)</p>
                <p className="text-xl font-bold">{outstandingReceivables.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <ArrowUpRight className="h-7 w-7 text-red-600 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Payables (pending)</p>
                <p className="text-xl font-bold">{outstandingPayables.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Confirmed</p>
                <p className="text-xl font-bold">{statusCounts.confirmed} proposals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring soon alert */}
      {expiringSoon.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <Clock className="h-4 w-4" /> {expiringSoon.length} proposal{expiringSoon.length > 1 ? 's' : ''} expiring within 48 hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {expiringSoon.map(p => {
                const flightHrs = p.flight_expires_at ? differenceInHours(new Date(p.flight_expires_at), now) : null;
                return (
                  <Link key={p.id} href={`/proposals/${p.id}`}>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer py-1 px-2 text-xs">
                      {p.title || 'Untitled'} {flightHrs !== null && flightHrs >= 0 ? `· ${flightHrs}h` : '· EXPIRED'}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search proposals by title or destination..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Grouped proposal lists */}
      {STATUS_ORDER.map(status => {
        const group = grouped[status];
        if (group.length === 0) return null;
        const isCollapsed = collapsedGroups[status];

        return (
          <Card key={status}>
            <CardHeader className="pb-0 pt-4 px-4 cursor-pointer" onClick={() => toggleGroup(status)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-semibold text-sm uppercase tracking-wide">{STATUS_LABELS[status]}</span>
                  <Badge className={`${STATUS_COLORS[status]} text-xs`}>{group.length}</Badge>
                </div>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="pt-3 px-0 pb-0">
                <div className="divide-y">
                  {group.map(p => {
                    const flightHrs = p.flight_expires_at ? differenceInHours(new Date(p.flight_expires_at), now) : null;
                    const isExpiring = flightHrs !== null && flightHrs >= 0 && flightHrs < 48;

                    return (
                      <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/proposals/${p.id}`} className="font-medium text-sm hover:underline truncate">
                                {p.title || 'Untitled'}
                              </Link>
                              <Badge variant="outline" className="text-xs shrink-0">V{p.version}</Badge>
                              {isExpiring && (
                                <Badge className="bg-amber-100 text-amber-700 text-xs shrink-0">
                                  <Clock className="h-2.5 w-2.5 mr-1" />{flightHrs}h
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                              <span>{p.destination || 'No destination'}</span>
                              <span>·</span>
                              <span>{p.pax_adults}A{p.pax_children > 0 ? ` + ${p.pax_children}C` : ''}</span>
                              {p.travel_start && (
                                <>
                                  <span>·</span>
                                  <span>{format(new Date(p.travel_start), 'dd MMM yyyy')}</span>
                                </>
                              )}
                              <span>·</span>
                              <span>Created {format(new Date(p.created_at), 'dd/MM/yy')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => router.push(`/proposals/${p.id}`)}
                          >
                            <Edit className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handlePdf(p)}
                          >
                            <FileText className="h-3 w-3 mr-1" /> PDF
                          </Button>
                          {p.share_token && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCopyLink(p)}
                            >
                              {copyFeedback === p.id ? (
                                <><Copy className="h-3 w-3 mr-1" /> Copied!</>
                              ) : (
                                <><ExternalLink className="h-3 w-3 mr-1" /> Copy Link</>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleDuplicate(p)}
                            disabled={duplicating === p.id}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            {duplicating === p.id ? 'Duplicating...' : 'Duplicate'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search ? `No proposals matching "${search}"` : 'No proposals yet. Create your first proposal!'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
