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
  Inbox, ArrowRight, CalendarCheck, CheckCircle2, HelpCircle, Wallet,
  Activity, MapPin, Send, Eye, XCircle, Calendar, RefreshCw
} from 'lucide-react';
import { differenceInHours, format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Proposal } from '@/lib/types/database';
import type { DashboardEnquiry, FollowUpEnquiry } from './page';

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

const STATUS_CONFIG: Record<string, { icon: any, color: string, bg: string, text: string }> = {
  draft: { icon: Edit, color: 'text-slate-700', bg: 'text-slate-600', text: 'text-slate-500' },
  sent: { icon: Send, color: 'text-blue-600', bg: 'text-blue-600', text: 'text-slate-500' },
  viewed: { icon: Eye, color: 'text-purple-600', bg: 'text-purple-600', text: 'text-slate-500' },
  confirmed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'text-emerald-600', text: 'text-slate-500' },
  cancelled: { icon: XCircle, color: 'text-slate-400', bg: 'text-red-600', text: 'text-slate-500' },
};

interface DashboardClientProps {
  proposals: Proposal[];
  receivables: Record<string, unknown>[];
  payables: Record<string, unknown>[];
  newEnquiryCount: number;
  recentEnquiries: DashboardEnquiry[];
  todayFollowUps: FollowUpEnquiry[];
  overdueFollowUpCount: number;
}

export function DashboardClient({ proposals, receivables, payables, newEnquiryCount, recentEnquiries, todayFollowUps, overdueFollowUpCount }: DashboardClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    confirmed: true,
    cancelled: true,
  });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState(todayFollowUps);
  const [markingDone, setMarkingDone] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState<string | null>(null);

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

  const outstandingReceivables = (receivables || []).reduce((s, r) => s + (Number(r.amount) - Number(r.amount_paid || 0)), 0);
  const outstandingPayables = (payables || []).reduce((s, p) => s + Number(p.cost_price || 0), 0);

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
    toast.success('Share link copied to clipboard');
    setTimeout(() => setCopyFeedback(null), 1500);
  }

  async function handleRevalidate(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRevalidating(id);
    try {
      const res = await fetch(`/api/proposals/${id}/revalidate`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to revalidate');
      toast.success('Proposal prices revalidated for 24h');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revalidate');
    } finally {
      setRevalidating(null);
    }
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

      // Duplicate hotels (exclude `id`, `proposal_id`, and `nights` which is a GENERATED column)
      if (hotelsRes.data && hotelsRes.data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const hotelRows = hotelsRes.data.map(({ id, proposal_id, nights, ...rest }: Record<string, unknown>) => ({
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
      toast.error('Failed to duplicate proposal');
    } finally {
      setDuplicating(null);
    }
  }

  function handlePdf(p: Proposal) {
    window.open(`/api/proposals/${p.id}/pdf`, '_blank');
  }

  async function handleMarkFollowUpDone(enquiryId: string) {
    setMarkingDone(enquiryId);
    try {
      await fetch('/api/website/cms/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: enquiryId, follow_up_date: null }),
      });
      setFollowUps(prev => prev.filter(f => f.id !== enquiryId));
    } catch {
      // ignore
    } finally {
      setMarkingDone(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/proposals/new">
          <Button className="rounded-full shadow-sm" size="sm"><Plus className="h-4 w-4 mr-1" /> New Proposal</Button>
        </Link>
        <Link href="/leads">
          <Button size="sm" variant="outline" className="rounded-full shadow-sm bg-white hover:bg-slate-50 text-slate-700 border-slate-200"><Inbox className="h-4 w-4 mr-1 text-slate-400" /> Enquiries</Button>
        </Link>
        <Link href="/clients">
          <Button size="sm" variant="outline" className="rounded-full shadow-sm bg-white hover:bg-slate-50 text-slate-700 border-slate-200"><Users className="h-4 w-4 mr-1 text-slate-400" /> Clients</Button>
        </Link>
        <Link href="/accounts">
          <Button size="sm" variant="outline" className="rounded-full shadow-sm bg-white hover:bg-slate-50 text-slate-700 border-slate-200"><Wallet className="h-4 w-4 mr-1 text-slate-400" /> Treasury</Button>
        </Link>
        <Link href="/bookings">
          <Button size="sm" variant="outline" className="rounded-full shadow-sm bg-white hover:bg-slate-50 text-slate-700 border-slate-200"><FileText className="h-4 w-4 mr-1 text-slate-400" /> Bookings</Button>
        </Link>
      </div>

      {/* Today's Follow-Ups */}
      {(followUps.length > 0 || overdueFollowUpCount > 0) && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-800">
              <CalendarCheck className="h-4 w-4" />
              Today&apos;s Follow-Ups ({followUps.length})
              {overdueFollowUpCount > 0 && (
                <Badge variant="destructive" className="text-xs ml-2">
                  {overdueFollowUpCount} overdue
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          {followUps.length > 0 && (
            <CardContent className="pt-0 px-0 pb-0">
              <div className="divide-y">
                {followUps.map(f => (
                  <div key={f.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-orange-100/50">
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{f.name || 'Unknown'}</span>
                      <p className="text-xs text-muted-foreground">
                        {f.destination || 'No destination'}
                        <span className="ml-2">·</span>
                        <span className="ml-2 capitalize">{f.status.replace('_', ' ')}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/admin/website/enquiries/${f.id}`}>
                        <Button size="sm" variant="outline" className="text-xs h-8">View</Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => handleMarkFollowUpDone(f.id)}
                        disabled={markingDone === f.id}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {markingDone === f.id ? 'Done...' : 'Mark Done'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Stats bar — enquiries + status counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Link href="/admin/website/enquiries?status=new">
          <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Inbox className="w-12 h-12 text-orange-600" />
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">New Enquiries</p>
            <p className="text-3xl font-bold text-orange-600">{newEnquiryCount}</p>
          </div>
        </Link>
        {STATUS_ORDER.map(status => {
          const count = status === 'draft'
            ? allProposals.filter(p => p.status === 'draft' && !p.published_data).length
            : statusCounts[status];
          const config = STATUS_CONFIG[status];
          const IconComponent = config.icon;
          return (
            <Link key={status} href={`/proposals?status=${status}`}>
              <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <IconComponent className={`w-12 h-12 ${config.bg}`} />
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{STATUS_LABELS[status]}</p>
                <p className={`text-3xl font-bold ${config.color}`}>{count}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <ArrowDownLeft className="h-7 w-7 text-green-600 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Client Invoiced (Uncollected)</p>
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
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Supplier Liabilities</p>
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
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 font-medium mb-3 text-sm">
            <Clock className="w-4 h-4 animate-pulse text-amber-600" />
            {expiringSoon.length} proposal{expiringSoon.length > 1 ? 's' : ''} expiring within 48 hours
          </div>
          <div className="flex gap-2 flex-wrap">
            {expiringSoon.map(p => {
              const flightHrs = p.flight_expires_at ? differenceInHours(new Date(p.flight_expires_at), now) : null;
              return (
                <div key={p.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-amber-200 text-amber-800 text-xs font-medium shadow-sm transition-colors">
                  <Link href={`/proposals/${p.id}`} className="hover:underline cursor-pointer">
                    {p.title || 'Untitled'} 
                  </Link>
                  <span className={flightHrs !== null && flightHrs >= 0 ? "text-amber-600 font-semibold ml-1" : "text-red-600 font-semibold ml-1"}>
                    {flightHrs !== null && flightHrs >= 0 ? `${flightHrs}h` : 'EXPIRED'}
                  </span>
                  {flightHrs !== null && flightHrs < 0 && (
                    <button 
                      onClick={(e) => handleRevalidate(p.id, e)}
                      disabled={revalidating === p.id}
                      className="ml-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Revalidate for 24h"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${revalidating === p.id ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Enquiries */}
      {recentEnquiries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Inbox className="h-4 w-4 text-orange-600" /> Recent Enquiries
              </CardTitle>
              <Link href="/admin/website/enquiries">
                <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-0 pb-0">
            <div className="divide-y">
              {recentEnquiries.map(eq => (
                <div key={eq.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 hover:bg-muted/30 gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{eq.name || 'Unknown'}</span>
                      {eq.query_id && (
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border">
                          {eq.query_id}
                        </span>
                      )}
                      <Badge className={eq.status === 'new' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'} variant="secondary">
                        {eq.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {eq.destination || 'No destination'}
                      {eq.travel_date && ` · ${eq.travel_date}`}
                      {eq.adults && ` · ${eq.adults}A${eq.children ? ` + ${eq.children}C` : ''}`}
                    </p>
                  </div>
                  <Link href={`/proposals/new?enquiry_id=${eq.id}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      Create Proposal <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recently Updated Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-8 gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
          <Activity className="w-5 h-5 text-blue-600" />
          Recently Updated
        </h2>
        
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search proposals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border-slate-200 rounded-full text-sm shadow-sm transition-all h-9"
          />
        </div>
      </div>

      {/* Proposal List */}
      {filtered.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.slice(0, search ? undefined : 15).map(p => {
              const flightHrs = p.flight_expires_at ? differenceInHours(new Date(p.flight_expires_at), now) : null;
              const isExpiring = flightHrs !== null && flightHrs >= 0 && flightHrs < 48;
              
              return (
                <div key={p.id} className="p-4 hover:bg-slate-50/80 transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <Link href={`/proposals/${p.id}`} className="font-semibold text-slate-900 hover:text-blue-600 text-base truncate">
                        {p.title || 'Untitled'}
                      </Link>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
                        V{p.version}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.status === 'confirmed' ? "bg-emerald-100 text-emerald-700" : p.status === 'sent' ? "bg-blue-100 text-blue-700" : p.status === 'viewed' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                      {isExpiring && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
                          <Clock className="h-3 w-3 mr-1" /> {flightHrs}h
                        </span>
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> 
                        {p.destination || 'No destination'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> 
                        {p.pax_adults}A{p.pax_children > 0 ? ` + ${p.pax_children}C` : ''}
                      </div>
                      {p.travel_start && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" /> 
                          {format(new Date(p.travel_start), 'dd MMM yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Hover Actions */}
                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => router.push(`/proposals/${p.id}`)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handlePdf(p)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="PDF">
                      <FileText className="w-4 h-4" />
                    </button>
                    {p.share_token && (
                      <button onClick={() => handleCopyLink(p)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" title="Copy Link">
                        {copyFeedback === p.id ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <ExternalLink className="w-4 h-4" />}
                      </button>
                    )}
                    <button onClick={() => handleDuplicate(p)} disabled={duplicating === p.id} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50" title="Duplicate">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search ? `No proposals matching "${search}"` : 'No proposals yet. Create your first proposal!'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
