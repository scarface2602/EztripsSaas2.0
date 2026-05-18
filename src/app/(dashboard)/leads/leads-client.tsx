'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Flame, Thermometer, Snowflake, FileText, Plus } from 'lucide-react';

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

const PRIORITY_ICONS: Record<string, { icon: typeof Flame; color: string }> = {
  urgent: { icon: Flame, color: 'text-red-500' },
  high: { icon: Flame, color: 'text-orange-500' },
  medium: { icon: Thermometer, color: 'text-yellow-500' },
  low: { icon: Snowflake, color: 'text-blue-400' },
};

const TABS = ['all', 'new', 'contacted', 'qualified', 'proposal_sent', 'won'] as const;

export default function LeadsClient({
  role,
  // Admin props
  allEnquiries: initialAll,
  agents = [],
  // Agent props
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
    return (
      <AdminView
        initialData={initialAll || []}
        agents={agents}
      />
    );
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

const EMPTY_FORM = { name: '', phone: '', email: '', destination: '', travel_date: '', adults: '1', children: '0', children_ages: [] as string[], budget_range: '', number_of_nights: '', special_requirements: '', notes: '', source: 'offline' };

function AdminView({ initialData, agents }: { initialData: Lead[]; agents: Agent[] }) {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState(initialData);
  const [filter, setFilter] = useState<string>('all');
  const [assignFilter, setAssignFilter] = useState<string>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleCreate() {
    setFormError('');
    if (!form.name || !form.phone) {
      setFormError('Name and phone are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/website/cms/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          adults: parseInt(form.adults) || 1,
          children: parseInt(form.children) || 0,
          children_ages: form.children_ages.filter(a => a).join(', ') || null,
          number_of_nights: form.number_of_nights ? parseInt(form.number_of_nights) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }
      const created = await res.json();
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

  async function handleAssign(enquiryId: string, agentId: string) {
    try {
      const res = await fetch('/api/website/cms/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: enquiryId, assigned_to: agentId || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to assign');
        return;
      }
      setEnquiries(prev => prev.map(e => e.id === enquiryId ? { ...e, assigned_to: agentId || null } : e));
    } catch {
      alert('Failed to assign lead');
    }
  }

  let filtered = filter === 'all' ? enquiries : enquiries.filter(e => e.status === filter);
  if (assignFilter === 'unassigned') {
    filtered = filtered.filter(e => !e.assigned_to);
  } else if (assignFilter !== 'all') {
    filtered = filtered.filter(e => e.assigned_to === assignFilter);
  }

  const unassignedCount = enquiries.filter(e => !e.assigned_to).length;

  return (
    <>
      {/* Add Enquiry button + Sheet */}
      <div className="flex justify-end">
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Offline Enquiry
        </Button>
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>Add Offline Enquiry</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Destination</Label>
                <Input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Bali" />
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
                  setForm(f => ({
                    ...f,
                    children: e.target.value,
                    children_ages: Array.from({ length: count }, (_, i) => f.children_ages[i] || ''),
                  }));
                }} />
              </div>
              <div>
                <Label>Nights</Label>
                <Input type="number" min="1" value={form.number_of_nights} onChange={e => setForm(f => ({ ...f, number_of_nights: e.target.value }))} placeholder="—" />
              </div>
            </div>
            {form.children_ages.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {form.children_ages.map((age, i) => (
                  <div key={i}>
                    <Label>Child {i + 1} Age</Label>
                    <Input
                      type="number"
                      min="0"
                      max="17"
                      value={age}
                      onChange={e => setForm(f => ({
                        ...f,
                        children_ages: f.children_ages.map((a, j) => j === i ? e.target.value : a),
                      }))}
                      placeholder="Age"
                    />
                  </div>
                ))}
              </div>
            )}
            <div>
              <Label>Budget Range</Label>
              <Select value={form.budget_range || undefined} onValueChange={v => setForm(f => ({ ...f, budget_range: v || '' }))}>
                <SelectTrigger><SelectValue placeholder="Select budget" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="under_50k">Under 50K</SelectItem>
                  <SelectItem value="50k_1l">50K - 1L</SelectItem>
                  <SelectItem value="1l_2l">1L - 2L</SelectItem>
                  <SelectItem value="2l_5l">2L - 5L</SelectItem>
                  <SelectItem value="above_5l">Above 5L</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v || 'offline' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
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
            <Button onClick={handleCreate} disabled={saving} className="w-full">
              {saving ? 'Creating...' : 'Create Enquiry'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-3xl font-bold">{enquiries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Unassigned</p>
            <p className="text-3xl font-bold text-orange-600">{unassignedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-3xl font-bold">{enquiries.filter(e => ['new', 'contacted', 'qualified'].includes(e.status as string)).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Won</p>
            <p className="text-3xl font-bold text-green-600">{enquiries.filter(e => e.status === 'won').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          {TABS.map(tab => (
            <Button
              key={tab}
              variant={filter === tab ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(tab)}
              className="capitalize"
            >
              {tab.replace('_', ' ')} {tab !== 'all' && `(${enquiries.filter(e => e.status === tab).length})`}
            </Button>
          ))}
        </div>
        <Select value={assignFilter} onValueChange={v => setAssignFilter(v || 'all')}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Filter by agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {agents.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel Date</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Proposals</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    No enquiries found
                  </TableCell>
                </TableRow>
              ) : filtered.map((e) => {
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
                      {(e.proposal_count as number) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm text-indigo-600 font-medium">
                          <FileText className="h-3.5 w-3.5" />
                          {e.proposal_count as number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Select
                        value={(e.assigned_to as string) || 'unassigned'}
                        onValueChange={v => { if (v) handleAssign(e.id as string, v === 'unassigned' ? '' : v); }}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {agents.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
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
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
                <TableHead>Phone</TableHead>
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No leads assigned to you yet
                  </TableCell>
                </TableRow>
              ) : myLeads.map(e => {
                const phone = (e.phone as string || '').replace(/\D/g, '').replace(/^0+/, '');
                const waPhone = phone.startsWith('91') ? phone : `91${phone}`;
                return (
                  <TableRow
                    key={e.id as string}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/website/enquiries/${e.id}`)}
                  >
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
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(e.created_at as string).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
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
