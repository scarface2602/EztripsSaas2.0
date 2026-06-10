'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Flame, Thermometer, Snowflake, Archive, FileText, Plus, Search, Phone, ChevronDown, ChevronRight, Eye, Edit2, Share2, Download, BookOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import { Pagination, paginateArray } from '@/components/pagination';
import { FollowUpModal } from '@/components/follow-up-modal';
import { differenceInHours, differenceInDays, format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { useLookup } from '@/lib/hooks/use-lookup';

type Lead = Record<string, unknown>;
type Agent = { id: string; full_name: string; role: string; max_active_leads: number };

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  qualified: 'bg-purple-100 text-purple-700',
  proposal_sent: 'bg-indigo-100 text-indigo-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-gray-100 text-gray-700',
  spam: 'bg-red-100 text-red-700',
};

const TEMP_COLORS: Record<string, string> = {
  hot: 'border-l-red-500',
  warm: 'border-l-orange-400',
  cold: 'border-l-blue-400',
  lost: 'border-l-gray-300',
};

const TEMP_ICONS: Record<string, { icon: typeof Flame; color: string }> = {
  hot: { icon: Flame, color: 'text-red-500' },
  warm: { icon: Thermometer, color: 'text-orange-500' },
  cold: { icon: Snowflake, color: 'text-blue-400' },
  archive: { icon: Archive, color: 'text-gray-400' },
};

const REQ_TYPE_COLORS: Record<string, string> = {
  package: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  flight: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  hotel: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  transfer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  visa: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const TABS = ['all', 'new', 'contacted', 'qualified', 'proposal_sent', 'won'] as const;
const TEMPERATURE_FILTERS = ['all', 'hot', 'warm', 'cold', 'archive'] as const;
const PIPELINE_STAGES = ['all', 'in_progress', 'proposal_sent', 'verbal_confirmed', 'rejected'] as const;
const PIPELINE_LABELS: Record<string, string> = {
  all: 'All Stages',
  in_progress: 'In Progress',
  proposal_sent: 'Proposal Sent',
  verbal_confirmed: 'Verbal Confirmed',
  rejected: 'Rejected',
};
const PAGE_SIZE = 20;

function queryAge(createdAt: string): string {
  const hours = differenceInHours(new Date(), new Date(createdAt));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(new Date(), new Date(createdAt));
  return `${days}d`;
}

export default function LeadsClient({
  role,
  allEnquiries: initialAll,
  agents = [],
  myLeads: initialMyLeads,
  unassignedLeads: initialUnassigned,
  activeCount: initialActive,
  maxLeads,
}: {
  role: string;
  allEnquiries?: Lead[];
  agents?: Agent[];
  myLeads?: Lead[];
  unassignedLeads?: Lead[];
  activeCount?: number;
  maxLeads?: number;
}) {
  const isAdmin = role === 'super_admin' || role === 'manager';

  if (isAdmin) {
    return <AdminView initialData={initialAll || []} agents={agents} />;
  }

  return (
    <AgentView
      initialMyLeads={initialMyLeads || []}
      initialUnassigned={initialUnassigned || []}
      initialActive={initialActive ?? 0}
      maxLeads={maxLeads ?? 10}
    />
  );
}

/* ─── Admin / Manager View ─── */

const EMPTY_FORM = {
  name: '', phone: '', email: '', destination: '', travel_date: '', adults: '1', children: '0',
  children_ages: [] as string[], budget_range: '', number_of_nights: '', special_requirements: '',
  notes: '', source: 'offline', requirement_type: 'package',
  // Flight fields
  trip_type: 'round_trip', source_city: '', dest_city: '', preferred_airline: '', cabin_class: 'economy',
  // Hotel fields
  star_rating: '', food_preference: '', nationality: 'Indian',
  // Transfer fields
  transfer_mode: 'cab', going_from: '', going_to: '', pickup_datetime: '', num_days: '1',
  // Visa fields
  visa_country: '', visa_category: 'tourist', entry_type: 'single', visa_duration: '',
};

function AdminView({ initialData, agents }: { initialData: Lead[]; agents: Agent[] }) {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState(initialData);
  const [filter, setFilter] = useState<string>('all');
  const [tempFilter, setTempFilter] = useState<string>('all');
  const [pipelineFilter, setPipelineFilter] = useState<string>('all');
  const [assignFilter, setAssignFilter] = useState<string>('all');
  const [reqTypeFilter, setReqTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);

  // Follow-up modal
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Dynamic lookups
  const { items: destinations } = useLookup('destination');
  const { items: tripTypes } = useLookup('trip_type');
  const { items: flightClasses } = useLookup('flight_class');
  const { items: airlines } = useLookup('airline');
  const { items: hotelCategories } = useLookup('hotel_category');
  const { items: foodPreferences } = useLookup('food_preference');
  const { items: transferModes } = useLookup('transfer_mode');
  const { items: visaCategories } = useLookup('visa_category');
  const { items: visaCountries } = useLookup('visa_country');
  const { items: visaEntryTypes } = useLookup('visa_entry_type');
  const { items: budgetRanges } = useLookup('budget_range');
  const { items: leadSources } = useLookup('lead_source');

  // Expandable proposal rows
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [proposalsCache, setProposalsCache] = useState<Record<string, any[]>>({});
  const supabaseClient = useMemo(() => createClient(), []);

  const opsAgents = agents;

  async function handleCreate() {
    setFormError('');
    if (!form.name || !form.phone) {
      setFormError('Name and phone are required');
      return;
    }
    setSaving(true);
    try {
      // Build requirement_details from type-specific fields
      const reqDetails: Record<string, unknown> = {};
      if (form.requirement_type === 'flight') {
        reqDetails.trip_type = form.trip_type;
        reqDetails.source_city = form.source_city;
        reqDetails.dest_city = form.dest_city;
        reqDetails.preferred_airline = form.preferred_airline;
        reqDetails.cabin_class = form.cabin_class;
      } else if (form.requirement_type === 'hotel') {
        reqDetails.star_rating = form.star_rating;
        reqDetails.food_preference = form.food_preference;
        reqDetails.nationality = form.nationality;
      } else if (form.requirement_type === 'transfer') {
        reqDetails.transfer_mode = form.transfer_mode;
        reqDetails.going_from = form.going_from;
        reqDetails.going_to = form.going_to;
        reqDetails.pickup_datetime = form.pickup_datetime;
        reqDetails.num_days = form.num_days;
      } else if (form.requirement_type === 'visa') {
        reqDetails.visa_country = form.visa_country;
        reqDetails.visa_category = form.visa_category;
        reqDetails.entry_type = form.entry_type;
        reqDetails.visa_duration = form.visa_duration;
      }

      const res = await fetch('/api/website/cms/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          adults: parseInt(form.adults) || 1,
          children: parseInt(form.children) || 0,
          children_ages: form.children_ages.filter(a => a).join(', ') || null,
          number_of_nights: form.number_of_nights ? parseInt(form.number_of_nights) : null,
          requirement_type: form.requirement_type,
          requirement_details: reqDetails,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }
      const created = await res.json();
      if (created.duplicate_warning) toast.warning(created.duplicate_warning);
      setEnquiries(prev => [{ ...created, proposal_count: 0 }, ...prev]);
      setForm(EMPTY_FORM);
      setSheetOpen(false);
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create enquiry');
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(enquiryId: string, agentId: string, field: 'assigned_to' | 'assigned_to_ops' = 'assigned_to') {
    try {
      const res = await fetch('/api/website/cms/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: enquiryId, [field]: agentId || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to assign');
        return;
      }
      setEnquiries(prev => prev.map(e => e.id === enquiryId ? { ...e, [field]: agentId || null } : e));
      toast.success(agentId ? 'Assigned' : 'Unassigned');
    } catch {
      toast.error('Failed to assign');
    }
  }

  const handleInlineStatusChange = useCallback(async (enquiryId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/website/cms/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: enquiryId, status: newStatus }),
      });
      if (!res.ok) {
        toast.error('Failed to update status');
        return;
      }
      setEnquiries(prev => prev.map(e => e.id === enquiryId ? { ...e, status: newStatus } : e));
    } catch {
      toast.error('Failed to update status');
    }
  }, []);

  const handleBulkAssign = async (field: 'assigned_to' | 'assigned_to_ops', agentId: string) => {
    if (selectedIds.size === 0) return;
    setBulkAssigning(true);
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch('/api/website/cms/enquiries', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, [field]: agentId || null }),
        })
      );
      await Promise.all(promises);
      setEnquiries(prev => prev.map(e =>
        selectedIds.has(e.id as string) ? { ...e, [field]: agentId || null } : e
      ));
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} enquiries assigned`);
    } catch {
      toast.error('Failed to bulk assign');
    }
    setBulkAssigning(false);
  };

  const toggleProposalRow = async (enquiryId: string) => {
    if (expandedRow === enquiryId) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(enquiryId);
    if (!proposalsCache[enquiryId]) {
      const { data } = await supabaseClient
        .from('proposals')
        .select('id, title, status, destination, created_at, share_token')
        .eq('enquiry_id', enquiryId)
        .order('created_at', { ascending: false });
      setProposalsCache(prev => ({ ...prev, [enquiryId]: data || [] }));
    }
  };

  const handleFollowUpSuccess = (updates: Record<string, unknown>) => {
    if (!followUpLead) return;
    setEnquiries(prev => prev.map(e =>
      e.id === followUpLead.id ? { ...e, ...updates } : e
    ));
    setFollowUpLead(null);
  };

  // Filters
  let filtered = filter === 'all' ? enquiries : enquiries.filter(e => e.status === filter);
  if (tempFilter !== 'all') {
    filtered = filtered.filter(e => (e.lead_temperature || 'warm') === tempFilter);
  }
  if (pipelineFilter !== 'all') {
    filtered = filtered.filter(e => (e.pipeline_stage || 'in_progress') === pipelineFilter);
  }
  if (assignFilter === 'unassigned') {
    filtered = filtered.filter(e => !e.assigned_to);
  } else if (assignFilter !== 'all') {
    filtered = filtered.filter(e => e.assigned_to === assignFilter);
  }
  if (reqTypeFilter !== 'all') {
    filtered = filtered.filter(e => (e.requirement_type || 'package') === reqTypeFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      (e.name as string || '').toLowerCase().includes(q) ||
      (e.phone as string || '').toLowerCase().includes(q) ||
      (e.destination as string || '').toLowerCase().includes(q) ||
      (e.email as string || '').toLowerCase().includes(q)
    );
  }

  const { data: pagedFiltered, totalPages } = useMemo(
    () => paginateArray(filtered, page, PAGE_SIZE),
    [filtered, page]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [filter, tempFilter, pipelineFilter, assignFilter, reqTypeFilter, searchQuery]);

  const unassignedCount = enquiries.filter(e => !e.assigned_to).length;
  const hotCount = enquiries.filter(e => e.lead_temperature === 'hot').length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === pagedFiltered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedFiltered.map(e => e.id as string)));
    }
  };

  return (
    <>
      {/* Add Enquiry button */}
      <div className="flex justify-end gap-2">
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Enquiry
        </Button>
      </div>

      {/* Temperature macro-filter */}
      <div className="flex gap-2 flex-wrap">
        {TEMPERATURE_FILTERS.map(temp => {
          const TIcon = TEMP_ICONS[temp]?.icon;
          const tColor = TEMP_ICONS[temp]?.color || '';
          const count = temp === 'all' ? enquiries.length : enquiries.filter(e => (e.lead_temperature || 'warm') === temp).length;
          return (
            <Button
              key={temp}
              variant={tempFilter === temp ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTempFilter(temp)}
              className="capitalize gap-1.5"
            >
              {TIcon && <TIcon className={`h-3.5 w-3.5 ${tempFilter === temp ? '' : tColor}`} />}
              {temp === 'all' ? 'All' : temp}
              <span className="text-xs opacity-70">({count})</span>
            </Button>
          );
        })}
      </div>

      {/* Pipeline stage tabs */}
      <div className="flex gap-1 border-b">
        {PIPELINE_STAGES.map(stage => {
          const count = stage === 'all' ? enquiries.length : enquiries.filter(e => (e.pipeline_stage || 'in_progress') === stage).length;
          return (
            <button
              key={stage}
              onClick={() => setPipelineFilter(stage)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                pipelineFilter === stage
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {PIPELINE_LABELS[stage]} <span className="text-xs opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Add Enquiry Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="p-0 flex flex-col sm:max-w-lg">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <SheetTitle>Add Enquiry</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
            {/* Requirement Type Selector */}
            <div>
              <Label>Requirement Type</Label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {['package', 'flight', 'hotel', 'transfer', 'visa'].map(t => (
                  <Button
                    key={t}
                    size="sm"
                    variant={form.requirement_type === t ? 'default' : 'outline'}
                    onClick={() => setForm(f => ({ ...f, requirement_type: t }))}
                    className="capitalize text-xs"
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Client name" />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91..." />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Optional" />
            </div>

            {/* Shared datalist for destination inputs */}
            <datalist id="destination-list">
              {destinations.map(t => <option key={t.value} value={t.label} />)}
            </datalist>

            {/* Package-specific */}
            {form.requirement_type === 'package' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Destination</Label>
                    <Input list="destination-list" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Bali" />
                  </div>
                  <div>
                    <Label>Travel Date</Label>
                    <Input type="date" value={form.travel_date} onChange={e => setForm(f => ({ ...f, travel_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Adults</Label>
                    <Input type="number" min="1" value={form.adults} onChange={e => setForm(f => ({ ...f, adults: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Children</Label>
                    <Input type="number" min="0" value={form.children} onChange={e => {
                      const count = parseInt(e.target.value) || 0;
                      setForm(f => ({ ...f, children: e.target.value, children_ages: Array.from({ length: count }, (_, i) => f.children_ages[i] || '') }));
                    }} />
                  </div>
                  <div>
                    <Label>Nights</Label>
                    <Input type="number" min="1" value={form.number_of_nights} onChange={e => setForm(f => ({ ...f, number_of_nights: e.target.value }))} placeholder="—" />
                  </div>
                </div>
              </>
            )}

            {/* Flight-specific */}
            {form.requirement_type === 'flight' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Trip Type</Label>
                    <Select value={form.trip_type} onValueChange={v => setForm(f => ({ ...f, trip_type: v || 'round_trip' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tripTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Class</Label>
                    <Select value={form.cabin_class} onValueChange={v => setForm(f => ({ ...f, cabin_class: v || 'economy' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {flightClasses.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>From City</Label>
                    <Input value={form.source_city} onChange={e => setForm(f => ({ ...f, source_city: e.target.value }))} placeholder="e.g. Delhi" />
                  </div>
                  <div>
                    <Label>To City</Label>
                    <Input value={form.dest_city} onChange={e => setForm(f => ({ ...f, dest_city: e.target.value }))} placeholder="e.g. Bangkok" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Travel Date</Label>
                    <Input type="date" value={form.travel_date} onChange={e => setForm(f => ({ ...f, travel_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Preferred Airline</Label>
                    <Input
                      list="airline-list"
                      value={form.preferred_airline}
                      onChange={e => setForm(f => ({ ...f, preferred_airline: e.target.value }))}
                      placeholder="Select or type airline..."
                    />
                    <datalist id="airline-list">
                      {airlines.map(t => <option key={t.value} value={t.label} />)}
                    </datalist>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Adults</Label>
                    <Input type="number" min="1" value={form.adults} onChange={e => setForm(f => ({ ...f, adults: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Children</Label>
                    <Input type="number" min="0" value={form.children} onChange={e => setForm(f => ({ ...f, children: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Infants</Label>
                    <Input type="number" min="0" defaultValue="0" />
                  </div>
                </div>
              </>
            )}

            {/* Hotel-specific */}
            {form.requirement_type === 'hotel' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Destination</Label>
                    <Input list="destination-list" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Bali" />
                  </div>
                  <div>
                    <Label>Hotel Category</Label>
                    <Select value={form.star_rating || undefined} onValueChange={v => setForm(f => ({ ...f, star_rating: v || '' }))}>
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        {hotelCategories.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Check-in</Label>
                    <Input type="date" value={form.travel_date} onChange={e => setForm(f => ({ ...f, travel_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Nights</Label>
                    <Input type="number" min="1" value={form.number_of_nights} onChange={e => setForm(f => ({ ...f, number_of_nights: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Food Preference</Label>
                    <Select value={form.food_preference || undefined} onValueChange={v => setForm(f => ({ ...f, food_preference: v || '' }))}>
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        {foodPreferences.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Guests</Label>
                    <Input type="number" min="1" value={form.adults} onChange={e => setForm(f => ({ ...f, adults: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {/* Transfer-specific */}
            {form.requirement_type === 'transfer' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Mode</Label>
                    <Select value={form.transfer_mode} onValueChange={v => setForm(f => ({ ...f, transfer_mode: v || 'cab' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {transferModes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Trip Type</Label>
                    <Select value={form.trip_type} onValueChange={v => setForm(f => ({ ...f, trip_type: v || 'one_way' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tripTypes.filter(t => t.value !== 'multi_city').map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>From</Label>
                    <Input value={form.going_from} onChange={e => setForm(f => ({ ...f, going_from: e.target.value }))} placeholder="Pickup location" />
                  </div>
                  <div>
                    <Label>To</Label>
                    <Input value={form.going_to} onChange={e => setForm(f => ({ ...f, going_to: e.target.value }))} placeholder="Drop location" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pickup Date & Time</Label>
                    <Input type="datetime-local" value={form.pickup_datetime} onChange={e => setForm(f => ({ ...f, pickup_datetime: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Travelers</Label>
                    <Input type="number" min="1" value={form.adults} onChange={e => setForm(f => ({ ...f, adults: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {/* Visa-specific */}
            {form.requirement_type === 'visa' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Country</Label>
                    <Input
                      list="visa-country-list"
                      value={form.visa_country}
                      onChange={e => setForm(f => ({ ...f, visa_country: e.target.value }))}
                      placeholder="Select or type country..."
                    />
                    <datalist id="visa-country-list">
                      {visaCountries.map(t => <option key={t.value} value={t.label} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={form.visa_category} onValueChange={v => setForm(f => ({ ...f, visa_category: v || 'tourist' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {visaCategories.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Entry Type</Label>
                    <Select value={form.entry_type} onValueChange={v => setForm(f => ({ ...f, entry_type: v || 'single' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {visaEntryTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Travel Date</Label>
                    <Input type="date" value={form.travel_date} onChange={e => setForm(f => ({ ...f, travel_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pax</Label>
                    <Input type="number" min="1" value={form.adults} onChange={e => setForm(f => ({ ...f, adults: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Nationality</Label>
                    <Input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            {/* Common bottom fields */}
            {form.requirement_type === 'package' && (
              <div>
                <Label>Budget Range</Label>
                <Select value={form.budget_range || undefined} onValueChange={v => setForm(f => ({ ...f, budget_range: v || '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select budget" /></SelectTrigger>
                  <SelectContent>
                    {budgetRanges.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.requirement_type === 'hotel' && (
              <div>
                <Label>Budget (per night)</Label>
                <Input value={form.budget_range} onChange={e => setForm(f => ({ ...f, budget_range: e.target.value }))} placeholder="e.g. ₹5,000 - ₹8,000" />
              </div>
            )}
            <div>
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v || 'offline' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leadSources.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Special Requirements</Label>
              <Textarea value={form.special_requirements} onChange={e => setForm(f => ({ ...f, special_requirements: e.target.value }))} placeholder="Any special requests..." rows={2} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." rows={2} />
            </div>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
          </div>
          <div className="border-t bg-background px-6 py-4 flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setSheetOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="flex-1">
              {saving ? 'Creating...' : 'Create Enquiry'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total</p><p className="text-3xl font-bold">{enquiries.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Unassigned</p><p className="text-3xl font-bold text-orange-600">{unassignedCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Hot</p><p className="text-3xl font-bold text-red-500">{hotCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Active</p><p className="text-3xl font-bold">{enquiries.filter(e => ['new', 'contacted', 'qualified'].includes(e.status as string)).length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Won</p><p className="text-3xl font-bold text-green-600">{enquiries.filter(e => e.status === 'won').length}</p></CardContent></Card>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, phone, destination, email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-9" />
        </div>
        <Select value={reqTypeFilter} onValueChange={v => setReqTypeFilter(v || 'all')}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="package">Package</SelectItem>
            <SelectItem value="flight">Flight</SelectItem>
            <SelectItem value="hotel">Hotel</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="visa">Visa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assignFilter} onValueChange={v => setAssignFilter(v || 'all')}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Filter by agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {agents.map(a => (<SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <Button key={tab} variant={filter === tab ? 'default' : 'outline'} size="sm" onClick={() => setFilter(tab)} className="capitalize">
            {tab.replace('_', ' ')} {tab !== 'all' && `(${enquiries.filter(e => e.status === tab).length})`}
          </Button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-muted/80 rounded-lg p-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Select onValueChange={v => { if (v) handleBulkAssign('assigned_to', v === 'unassigned' ? '' : String(v)); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Assign Sales..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassign</SelectItem>
              {agents.map(a => (<SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>))}
            </SelectContent>
          </Select>
          {opsAgents.length > 0 && (
            <Select onValueChange={v => { if (v) handleBulkAssign('assigned_to_ops', v === 'unassigned' ? '' : String(v)); }}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Assign Ops..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassign</SelectItem>
                {opsAgents.map(a => (<SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} disabled={bulkAssigning}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="pt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={pagedFiltered.length > 0 && selectedIds.size === pagedFiltered.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-1"></TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Proposals</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Ops</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-8">No enquiries found</TableCell></TableRow>
              ) : pagedFiltered.map((e) => {
                const phone = (e.phone as string || '').replace(/\D/g, '').replace(/^0+/, '');
                const waPhone = phone.startsWith('91') ? phone : `91${phone}`;
                const temp = (e.lead_temperature as string) || 'warm';
                const TempIcon = TEMP_ICONS[temp]?.icon || Thermometer;
                const tempColor = TEMP_ICONS[temp]?.color || 'text-yellow-500';
                const reqType = (e.requirement_type as string) || 'package';

                return (
                  <React.Fragment key={e.id as string}>
                  <TableRow
                    className={`cursor-pointer hover:bg-muted/50 border-l-4 ${TEMP_COLORS[temp] || 'border-l-transparent'}`}
                    onClick={() => router.push(`/admin/website/enquiries/${e.id}`)}
                  >
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(e.id as string)}
                        onCheckedChange={() => toggleSelect(e.id as string)}
                      />
                    </TableCell>
                    <TableCell className="w-1 px-0">
                      <TempIcon className={`h-3.5 w-3.5 ${tempColor}`} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{e.name as string}</span>
                        {(e.sla_breached_at as string) && !(e.first_responded_at as string) && (
                          <Badge className="ml-1.5 bg-red-100 text-red-700 text-[10px] align-middle">SLA</Badge>
                        )}
                        <span className="block text-[10px] text-blue-600 font-mono">{(e.trip_id as string) || (e.query_id as string) || (e.id as string).slice(0, 8)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${REQ_TYPE_COLORS[reqType] || ''}`}>
                        {reqType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <a
                          href={`https://wa.me/${waPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline text-sm"
                          onClick={ev => ev.stopPropagation()}
                        >
                          {e.phone as string}
                        </a>
                        {(e.email as string) && (
                          <span className="block text-[11px] text-muted-foreground truncate max-w-[140px]">{e.email as string}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {(e.destination as string) || (e.requirement_details as Record<string, unknown>)?.dest_city as string || '—'}
                        {((e.requirement_details as Record<string, unknown>)?.package_title as string) && (
                          <span className="block text-[10px] text-indigo-600 truncate max-w-[160px]" title={(e.requirement_details as Record<string, unknown>).package_title as string}>
                            📦 {(e.requirement_details as Record<string, unknown>).package_title as string}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm">{(e.travel_date as string) || '—'}</span>
                        <span className="block text-[11px] text-muted-foreground">{format(new Date(e.created_at as string), 'dd MMM yy')}</span>
                      </div>
                    </TableCell>
                    <TableCell>{e.adults as number}{(e.children as number) > 0 ? `+${e.children}C` : ''}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{queryAge(e.created_at as string)}</span>
                    </TableCell>
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      {(e.proposal_count as number) > 0 ? (
                        <button
                          className="inline-flex items-center gap-1 text-sm text-indigo-600 font-medium hover:underline"
                          onClick={() => toggleProposalRow(e.id as string)}
                        >
                          {expandedRow === e.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <FileText className="h-3.5 w-3.5" />{e.proposal_count as number}
                        </button>
                      ) : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    {/* Sales assignment */}
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      <Select
                        value={(e.assigned_to as string) || 'unassigned'}
                        onValueChange={v => { if (v) handleAssign(e.id as string, v === 'unassigned' ? '' : v); }}
                      >
                        <SelectTrigger className="w-[130px] h-7 text-xs">
                          <span className="truncate">{e.assigned_to ? (agents.find(a => a.id === e.assigned_to)?.full_name || 'Unknown') : 'Unassigned'}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {agents.map(a => (<SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {/* Ops assignment */}
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      <Select
                        value={(e.assigned_to_ops as string) || 'unassigned'}
                        onValueChange={v => { if (v) handleAssign(e.id as string, v === 'unassigned' ? '' : v, 'assigned_to_ops'); }}
                      >
                        <SelectTrigger className="w-[130px] h-7 text-xs">
                          <span className="truncate">{e.assigned_to_ops ? (opsAgents.find(a => a.id === e.assigned_to_ops)?.full_name || 'Unknown') : 'Unassigned'}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {opsAgents.map(a => (<SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {/* Inline status */}
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      <Select
                        value={(e.status as string) || 'new'}
                        onValueChange={v => { if (v) handleInlineStatusChange(e.id as string, v); }}
                      >
                        <SelectTrigger className="w-[120px] h-7 text-xs">
                          <Badge className={`${STATUS_COLORS[(e.status as string) || 'new']} text-[10px]`}>
                            {(e.status as string)?.replace('_', ' ')}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'spam'].map(s => (
                            <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {/* Follow-up */}
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => setFollowUpLead(e)}
                      >
                        <Phone className="h-3 w-3" />
                        {(e.follow_up_date as string) || 'Log'}
                      </Button>
                    </TableCell>
                    {/* Actions */}
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors">
                          Actions
                          <ChevronDown className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/admin/website/enquiries/${e.id}`)}>
                            <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit Lead
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/proposals/new?enquiry_id=${e.id}`)}>
                            <FileText className="h-3.5 w-3.5 mr-2" /> Build Proposal
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFollowUpLead(e)}>
                            <Phone className="h-3.5 w-3.5 mr-2" /> Log Call
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {/* Expanded proposals sub-row */}
                  {expandedRow === e.id && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={15} className="p-0">
                        <div className="px-6 py-3 border-t">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Linked Proposals</p>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setExpandedRow(null)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          {!proposalsCache[e.id as string] ? (
                            <p className="text-sm text-muted-foreground">Loading...</p>
                          ) : proposalsCache[e.id as string].length === 0 ? (
                            <p className="text-sm text-muted-foreground">No proposals found</p>
                          ) : (
                            <div className="space-y-1.5">
                              {proposalsCache[e.id as string].map((p, idx) => (
                                <div key={p.id} className="flex items-center justify-between bg-background border rounded px-3 py-2 text-sm">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground font-mono">V{proposalsCache[e.id as string].length - idx}</span>
                                    <span className="font-medium">{p.title || 'Untitled'}</span>
                                    <span className="text-xs text-muted-foreground">{p.destination}</span>
                                    <Badge className={`text-[10px] ${STATUS_COLORS[p.status] || ''}`}>{p.status}</Badge>
                                    <span className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'dd MMM yyyy')}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="View" onClick={() => router.push(`/proposals/${p.id}`)}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Edit" onClick={() => router.push(`/proposals/${p.id}`)}>
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    {p.share_token && (
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Copy share link" onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/p/${p.share_token}`);
                                        toast.success('Share link copied');
                                      }}>
                                        <Share2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Download PDF" onClick={() => window.open(`/api/proposals/${p.id}/pdf`, '_blank')}>
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                    {p.status !== 'booked' && (
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Book" onClick={() => router.push(`/bookings/new-offline?proposal_id=${p.id}`)}>
                                        <BookOpen className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Follow-up Modal */}
      {followUpLead && (
        <FollowUpModal
          open={!!followUpLead}
          onOpenChange={open => { if (!open) setFollowUpLead(null); }}
          enquiryId={followUpLead.id as string}
          enquiryName={followUpLead.name as string}
          currentTemperature={(followUpLead.lead_temperature as string) || 'warm'}
          onSuccess={handleFollowUpSuccess}
        />
      )}
    </>
  );
}

/* ─── Agent View ─── */

function AgentView({
  initialMyLeads,
  initialUnassigned,
  initialActive,
  maxLeads,
}: {
  initialMyLeads: Lead[];
  initialUnassigned: Lead[];
  initialActive: number;
  maxLeads: number;
}) {
  const router = useRouter();
  const [myLeads, setMyLeads] = useState(initialMyLeads);
  const [unassigned, setUnassigned] = useState(initialUnassigned);
  const [activeCount, setActiveCount] = useState(initialActive);
  const [picking, setPicking] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);

  const q = searchQuery.toLowerCase();
  const filteredMyLeads = q ? myLeads.filter(e =>
    (e.name as string || '').toLowerCase().includes(q) ||
    (e.phone as string || '').toLowerCase().includes(q) ||
    (e.destination as string || '').toLowerCase().includes(q)
  ) : myLeads;
  const filteredUnassigned = q ? unassigned.filter(e =>
    (e.name as string || '').toLowerCase().includes(q) ||
    (e.destination as string || '').toLowerCase().includes(q)
  ) : unassigned;

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
        toast.error(data.error || 'Failed to pick enquiry');
        return;
      }
      const picked = await res.json();
      setUnassigned(prev => prev.filter(e => e.id !== enquiryId));
      setMyLeads(prev => [picked, ...prev]);
      setActiveCount(prev => prev + 1);
      toast.success('Enquiry added to your queue');
      router.refresh();
    } catch {
      toast.error('Failed to pick enquiry');
    } finally {
      setPicking(null);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6 flex items-center gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Active Enquiries</p>
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search enquiries..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-9" />
      </div>

      <Card>
        <CardHeader><CardTitle>My Assigned Enquiries ({filteredMyLeads.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel Date</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMyLeads.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{searchQuery ? 'No matching enquiries' : 'No enquiries assigned yet'}</TableCell></TableRow>
              ) : filteredMyLeads.map(e => {
                const phone = (e.phone as string || '').replace(/\D/g, '').replace(/^0+/, '');
                const waPhone = phone.startsWith('91') ? phone : `91${phone}`;
                const temp = (e.lead_temperature as string) || 'warm';
                const TempIcon = TEMP_ICONS[temp]?.icon || Thermometer;
                const reqType = (e.requirement_type as string) || 'package';
                return (
                  <TableRow key={e.id as string} className={`cursor-pointer hover:bg-muted/50 border-l-4 ${TEMP_COLORS[temp] || ''}`} onClick={() => router.push(`/admin/website/enquiries/${e.id}`)}>
                    <TableCell className="w-1 px-0"><TempIcon className={`h-3.5 w-3.5 ${TEMP_ICONS[temp]?.color || ''}`} /></TableCell>
                    <TableCell className="font-medium">{e.name as string}</TableCell>
                    <TableCell><Badge className={`text-[10px] ${REQ_TYPE_COLORS[reqType] || ''}`}>{reqType}</Badge></TableCell>
                    <TableCell>
                      <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline text-sm" onClick={ev => ev.stopPropagation()}>{e.phone as string}</a>
                    </TableCell>
                    <TableCell>{e.destination as string}</TableCell>
                    <TableCell className="text-sm">{(e.travel_date as string) || '—'}</TableCell>
                    <TableCell>{e.adults as number}{(e.children as number) > 0 ? `+${e.children}C` : ''}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[(e.status as string) || 'new']}>{(e.status as string)?.replace('_', ' ')}</Badge></TableCell>
                    <TableCell onClick={ev => ev.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setFollowUpLead(e)}>
                        <Phone className="h-3 w-3" />{(e.follow_up_date as string) || 'Log'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Available Enquiries ({filteredUnassigned.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel Date</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnassigned.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{searchQuery ? 'No matching enquiries' : 'No unassigned enquiries'}</TableCell></TableRow>
              ) : filteredUnassigned.map(e => {
                const reqType = (e.requirement_type as string) || 'package';
                return (
                  <TableRow key={e.id as string}>
                    <TableCell className="font-medium">{e.name as string}</TableCell>
                    <TableCell><Badge className={`text-[10px] ${REQ_TYPE_COLORS[reqType] || ''}`}>{reqType}</Badge></TableCell>
                    <TableCell>{e.destination as string}</TableCell>
                    <TableCell className="text-sm">{(e.travel_date as string) || '—'}</TableCell>
                    <TableCell>{e.adults as number}{(e.children as number) > 0 ? `+${e.children}C` : ''}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[(e.status as string) || 'new']}>{(e.status as string)?.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" disabled={picking === (e.id as string) || activeCount >= maxLeads} onClick={() => handlePick(e.id as string)}>
                        {picking === (e.id as string) ? 'Picking...' : 'Pick'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {followUpLead && (
        <FollowUpModal
          open={!!followUpLead}
          onOpenChange={open => { if (!open) setFollowUpLead(null); }}
          enquiryId={followUpLead.id as string}
          enquiryName={followUpLead.name as string}
          currentTemperature={(followUpLead.lead_temperature as string) || 'warm'}
          onSuccess={(updates) => {
            setMyLeads(prev => prev.map(e => e.id === followUpLead.id ? { ...e, ...updates } : e));
            setFollowUpLead(null);
          }}
        />
      )}
    </>
  );
}
