'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Phone, PhoneIncoming, PhoneMissed, Mail, MessageSquare, Send,
  Calendar, FileText, Plus, CheckCircle2, Flame, Thermometer,
  Snowflake, AlertCircle, Users,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { SendToSupplierModal } from '@/components/send-to-supplier-modal';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-100 text-purple-700' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-700' },
  { value: 'lost', label: 'Lost', color: 'bg-gray-100 text-gray-700' },
  { value: 'spam', label: 'Spam', color: 'bg-red-100 text-red-700' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', icon: Snowflake, color: 'text-blue-500' },
  { value: 'medium', label: 'Medium', icon: Thermometer, color: 'text-yellow-500' },
  { value: 'high', label: 'High', icon: Flame, color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', icon: AlertCircle, color: 'text-red-500' },
];

const TEMP_OPTIONS = [
  { value: 'hot', label: 'Hot', color: 'bg-red-100 text-red-700' },
  { value: 'warm', label: 'Warm', color: 'bg-orange-100 text-orange-700' },
  { value: 'cold', label: 'Cold', color: 'bg-blue-100 text-blue-700' },
  { value: 'lost', label: 'Lost', color: 'bg-gray-100 text-gray-700' },
];

const ACTIVITY_TYPES = [
  { value: 'call_outgoing', label: 'Outgoing Call', icon: Phone },
  { value: 'call_incoming', label: 'Incoming Call', icon: PhoneIncoming },
  { value: 'call_missed', label: 'Missed Call', icon: PhoneMissed },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'note', label: 'Note', icon: FileText },
  { value: 'follow_up', label: 'Follow-up Reminder', icon: Calendar },
];

const OUTCOME_OPTIONS = [
  { value: 'interested', label: 'Interested' },
  { value: 'callback', label: 'Callback Requested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'voicemail', label: 'Voicemail' },
];

const LOSS_REASONS = [
  { value: 'price_too_high', label: 'Price too high' },
  { value: 'chose_competitor', label: 'Chose competitor' },
  { value: 'trip_cancelled', label: 'Trip cancelled' },
  { value: 'no_response', label: 'No response / ghosted' },
  { value: 'budget_constraints', label: 'Budget constraints' },
  { value: 'dates_changed', label: 'Dates changed' },
  { value: 'other', label: 'Other' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Enquiry = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Activity = Record<string, any>;

function getActivityIcon(type: string) {
  const found = ACTIVITY_TYPES.find(a => a.value === type);
  return found?.icon || FileText;
}

export default function EnquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [proposals, setProposals] = useState<Enquiry[]>([]);
  const [teamMembers, setTeamMembers] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);

  // Requirements editing state
  const [isEditingReqs, setIsEditingReqs] = useState(false);
  const [editReqs, setEditReqs] = useState({
    destination: '',
    travel_date: '',
    number_of_nights: 0,
    adults: 1,
    children: 0,
    children_ages: '',
    budget_range: '',
    hotel_category: '',
    special_requirements: '',
  });

  const handleStartEditReqs = () => {
    setEditReqs({
      destination: enquiry?.destination || '',
      travel_date: enquiry?.travel_date || '',
      number_of_nights: enquiry?.number_of_nights || 0,
      adults: enquiry?.adults || 1,
      children: enquiry?.children || 0,
      children_ages: enquiry?.children_ages || '',
      budget_range: enquiry?.budget_range || '',
      hotel_category: enquiry?.hotel_category || '',
      special_requirements: enquiry?.special_requirements || '',
    });
    setIsEditingReqs(true);
  };

  const handleSaveReqs = async () => {
    await updateEnquiry(editReqs);
    setIsEditingReqs(false);
  };

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [actType, setActType] = useState('call_outgoing');
  const [actSubject, setActSubject] = useState('');
  const [actBody, setActBody] = useState('');
  const [actOutcome, setActOutcome] = useState('');
  const [actDuration, setActDuration] = useState('');
  const [actFollowUpDate, setActFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Send to supplier
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [supplierRequests, setSupplierRequests] = useState<any[]>([]);

  // Loss reason
  const [showLossDialog, setShowLossDialog] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [lossNotes, setLossNotes] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [eRes, aRes, pRes, uRes, srRes] = await Promise.all([
      supabase.from('website_enquiries').select('*').eq('id', id).single(),
      fetch(`/api/website/cms/enquiries/${id}/activities`).then(r => r.json()),
      supabase.from('proposals').select('id, title, status, destination, created_at, bookings(trip_id)').eq('enquiry_id', id).order('created_at', { ascending: false }),
      supabase.from('users').select('id, full_name, email'),
      fetch(`/api/enquiries/send-to-supplier?enquiry_id=${id}`).then(r => r.json()),
    ]);
    setEnquiry(eRes.data);
    setActivities(Array.isArray(aRes) ? aRes : []);
    setProposals(pRes.data || []);
    setTeamMembers(uRes.data || []);
    setSupplierRequests(Array.isArray(srRes) ? srRes : []);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function updateEnquiry(updates: Record<string, unknown>) {
    const res = await fetch('/api/website/cms/enquiries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) {
      const data = await res.json();
      setEnquiry(data);
      toast.success('Enquiry updated');
    } else {
      toast.error('Failed to update enquiry');
    }
  }

  function handleStatusChange(newStatus: string) {
    if (newStatus === 'lost') {
      setShowLossDialog(true);
    } else {
      updateEnquiry({ status: newStatus });
    }
  }

  function confirmLost() {
    if (!lossReason) return;
    updateEnquiry({ status: 'lost', lost_reason: lossReason, lost_notes: lossNotes || null });
    setShowLossDialog(false);
    setLossReason('');
    setLossNotes('');
  }

  async function addActivity() {
    setSubmitting(true);
    const body: Record<string, unknown> = {
      type: actType,
      subject: actSubject || undefined,
      body: actBody || undefined,
      outcome: actOutcome || undefined,
      duration_minutes: actDuration ? Number(actDuration) : undefined,
      follow_up_date: actFollowUpDate || undefined,
    };

    const res = await fetch(`/api/website/cms/enquiries/${id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setShowActivityForm(false);
      setActSubject('');
      setActBody('');
      setActOutcome('');
      setActDuration('');
      setActFollowUpDate('');
      fetchAll();
      toast.success('Activity logged');
    } else {
      toast.error('Failed to log activity');
    }
    setSubmitting(false);
  }

  async function markFollowUpDone(activityId: string) {
    await fetch(`/api/website/cms/enquiries/${id}/activities`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: activityId }),
    });
    fetchAll();
  }

  if (loading || !enquiry) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  const phone = (enquiry.phone || '').replace(/\D/g, '').replace(/^0+/, '');
  const waPhone = phone.startsWith('91') ? phone : `91${phone}`;
  const statusOption = STATUS_OPTIONS.find(s => s.value === enquiry.status);

  // Pending follow-ups
  const pendingFollowUps = activities.filter(a => a.follow_up_date && !a.follow_up_done);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Enquiries', href: '/leads' },
        { label: enquiry.name || 'Enquiry' },
      ]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/website/enquiries')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{enquiry.name}</h1>
              {enquiry.query_id && (
                <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded border">
                  {enquiry.query_id}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {enquiry.destination || 'No destination'} &bull; Enquired {formatDistanceToNow(new Date(enquiry.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSupplierModal(true)}>
            <Send className="h-4 w-4 mr-2" /> Send to Supplier
          </Button>
          <Button onClick={() => router.push(`/proposals/new?client_id=${enquiry.client_id}&enquiry_id=${id}`)}>
            <FileText className="h-4 w-4 mr-2" /> Create Proposal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {/* Left Column: Enquiry Details + Controls */}
        <div className="col-span-1 space-y-4">
          {/* Contact Card */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {enquiry.name}</p>
              <p><span className="text-muted-foreground">Email:</span> {enquiry.email || '-'}</p>
              <p>
                <span className="text-muted-foreground">Phone:</span>{' '}
                <a href={`tel:${enquiry.phone}`} className="hover:underline">{enquiry.phone}</a>
              </p>
              <div className="flex gap-2 pt-1">
                <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-muted">
                  <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <a href={`tel:${enquiry.phone}`}
                   className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-muted">
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Trip Details Card */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Trip Requirements</CardTitle>
              {!isEditingReqs ? (
                <Button variant="ghost" size="sm" onClick={handleStartEditReqs}>
                  Edit
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingReqs(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-8" onClick={handleSaveReqs}>
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isEditingReqs ? (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Destination</Label>
                    <Input
                      value={editReqs.destination}
                      onChange={(e) => setEditReqs({ ...editReqs, destination: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Travel Date</Label>
                      <Input
                        type="date"
                        value={editReqs.travel_date}
                        onChange={(e) => setEditReqs({ ...editReqs, travel_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nights</Label>
                      <Input
                        type="number"
                        value={editReqs.number_of_nights || ''}
                        onChange={(e) => setEditReqs({ ...editReqs, number_of_nights: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Adults</Label>
                      <Input
                        type="number"
                        value={editReqs.adults}
                        onChange={(e) => setEditReqs({ ...editReqs, adults: Number(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Children</Label>
                      <Input
                        type="number"
                        value={editReqs.children}
                        onChange={(e) => setEditReqs({ ...editReqs, children: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Child Ages</Label>
                      <Input
                        value={editReqs.children_ages}
                        placeholder="5,10"
                        onChange={(e) => setEditReqs({ ...editReqs, children_ages: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Budget</Label>
                      <Input
                        value={editReqs.budget_range}
                        onChange={(e) => setEditReqs({ ...editReqs, budget_range: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hotel Category</Label>
                      <Input
                        value={editReqs.hotel_category}
                        onChange={(e) => setEditReqs({ ...editReqs, hotel_category: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Special Requirements</Label>
                    <Textarea
                      rows={2}
                      value={editReqs.special_requirements}
                      onChange={(e) => setEditReqs({ ...editReqs, special_requirements: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p><span className="text-muted-foreground">Destination:</span> {enquiry.destination || '-'}</p>
                  <p><span className="text-muted-foreground">Travel Date:</span> {enquiry.travel_date || enquiry.requirement_details?.travel_month || '-'}
                    {enquiry.date_flexible && <span className="text-xs text-muted-foreground ml-1">(flexible {enquiry.flexibility_days ? `+/-${enquiry.flexibility_days}d` : ''})</span>}
                  </p>
                  <p><span className="text-muted-foreground">Nights:</span> {enquiry.number_of_nights || '-'}</p>
                  <p><span className="text-muted-foreground">Pax:</span> {enquiry.adults || 0}A {enquiry.children > 0 ? `+ ${enquiry.children}C` : ''}</p>
                  {enquiry.children_ages && <p><span className="text-muted-foreground">Children Ages:</span> {enquiry.children_ages}</p>}
                  <p><span className="text-muted-foreground">Budget:</span> {enquiry.budget_range || '-'} {enquiry.budget_type ? `(${enquiry.budget_type})` : ''}</p>
                  <p><span className="text-muted-foreground">Hotel Category:</span> {enquiry.hotel_category || '-'}</p>
                  {enquiry.special_requirements && (
                    <p><span className="text-muted-foreground">Special:</span> {enquiry.special_requirements}</p>
                  )}
                  <p><span className="text-muted-foreground">Source:</span> {enquiry.source || 'Website'}</p>

                  {/* Display Wizard Choices */}
                  {enquiry.requirement_details && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Wizard Selections</p>
                      
                      {enquiry.requirement_details.departure_city && (
                        <p>
                          <span className="text-muted-foreground">Origin Hub:</span>{' '}
                          <Badge variant="secondary" className="font-medium text-xs">
                            {enquiry.requirement_details.departure_city}
                          </Badge>
                        </p>
                      )}

                      {Array.isArray(enquiry.requirement_details.cities) && enquiry.requirement_details.cities.length > 0 && (
                        <div>
                          <span className="text-muted-foreground block text-xs mb-1">
                            {enquiry.requirement_details.is_pilgrimage ? 'Shrines in Focus:' : 'Cities in Focus:'}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {enquiry.requirement_details.cities.map((c: string) => (
                              <Badge key={c} variant="outline" className="text-[11px] bg-slate-50">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {Array.isArray(enquiry.requirement_details.special_services) && enquiry.requirement_details.special_services.length > 0 && (
                        <div className="pt-1">
                          <span className="text-muted-foreground block text-xs mb-1">Requested Yatra Services:</span>
                          <div className="flex flex-wrap gap-1">
                            {enquiry.requirement_details.special_services.map((s: string) => (
                              <Badge key={s} variant="outline" className="text-[11px] bg-amber-50 text-amber-800 border-amber-200">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* CRM Controls */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Lead Management</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={enquiry.status} onValueChange={(v) => v && handleStatusChange(v)}>
                  <SelectTrigger className="h-8">
                    <Badge className={statusOption?.color || ''}>{statusOption?.label || enquiry.status}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {enquiry.lost_reason && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Lost reason: {LOSS_REASONS.find(r => r.value === enquiry.lost_reason)?.label || enquiry.lost_reason}
                    {enquiry.lost_notes && ` — ${enquiry.lost_notes}`}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <Select value={enquiry.priority || 'medium'} onValueChange={(v) => v && updateEnquiry({ priority: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Lead Temperature</Label>
                <Select value={enquiry.lead_temperature || 'warm'} onValueChange={(v) => v && updateEnquiry({ lead_temperature: v })}>
                  <SelectTrigger className="h-8">
                    <Badge className={TEMP_OPTIONS.find(t => t.value === (enquiry.lead_temperature || 'warm'))?.color || ''}>
                      {TEMP_OPTIONS.find(t => t.value === (enquiry.lead_temperature || 'warm'))?.label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {TEMP_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Assigned To</Label>
                <Select value={enquiry.assigned_to || ''} onValueChange={(v) => updateEnquiry({ assigned_to: v || null })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Follow-up Date</Label>
                <Input
                  type="date"
                  className="h-8"
                  value={enquiry.follow_up_date || ''}
                  onChange={(e) => updateEnquiry({ follow_up_date: e.target.value || null })}
                />
              </div>

              {enquiry.last_contacted_at && (
                <p className="text-xs text-muted-foreground">
                  Last contacted: {formatDistanceToNow(new Date(enquiry.last_contacted_at), { addSuffix: true })}
                </p>
              )}

              <Separator />

              <div className="space-y-1">
                <Label className="text-xs">Internal Notes</Label>
                <Textarea
                  className="text-sm"
                  rows={3}
                  defaultValue={enquiry.notes || ''}
                  onBlur={(e) => updateEnquiry({ notes: e.target.value })}
                  placeholder="Add notes..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Linked Proposals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Linked Proposals ({proposals.length})</CardTitle></CardHeader>
            <CardContent>
              {proposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No proposals created yet</p>
              ) : (
                <div className="space-y-2">
                  {proposals.map(p => {
                    const bookingsArray = p.bookings as { trip_id: string | null }[] | undefined;
                    const tripId = bookingsArray?.[0]?.trip_id;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/proposals/${p.id}`)}
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {p.title || 'Untitled'}
                            {tripId && (
                              <span className="ml-2 font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {tripId}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{p.destination} &bull; {format(new Date(p.created_at), 'dd MMM yyyy')}</p>
                        </div>
                        <Badge className="text-xs">{p.status}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacted Suppliers */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Contacted Suppliers ({supplierRequests.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowSupplierModal(true)}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Send
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {supplierRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suppliers contacted yet</p>
              ) : (
                <div className="space-y-2">
                  {supplierRequests.map((sr: { id: string; suppliers?: { name: string }; email_to: string; response_status: string; sent_at: string }) => (
                    <div key={sr.id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div>
                        <p className="font-medium">{sr.suppliers?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{sr.email_to} &bull; {format(new Date(sr.sent_at), 'dd MMM HH:mm')}</p>
                      </div>
                      <Select
                        value={sr.response_status}
                        onValueChange={async (v) => {
                          if (!v) return;
                          await fetch('/api/enquiries/send-to-supplier', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: sr.id, response_status: v }),
                          });
                          fetchAll();
                        }}
                      >
                        <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="responded">Responded</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                          <SelectItem value="no_response">No Response</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Activity Timeline */}
        <div className="col-span-2 space-y-4">
          {/* Pending Follow-ups Alert */}
          {pendingFollowUps.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-orange-800 mb-2">Pending Follow-ups ({pendingFollowUps.length})</p>
                {pendingFollowUps.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-orange-700">
                      {a.follow_up_date} &mdash; {a.subject || a.body?.substring(0, 50) || 'Follow-up'}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => markFollowUpDone(a.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Done
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Add Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
              <Button size="sm" onClick={() => setShowActivityForm(!showActivityForm)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Log Activity
              </Button>
            </CardHeader>

            {showActivityForm && (
              <CardContent className="border-b pb-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={actType} onValueChange={(v) => v && setActType(v)}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACTIVITY_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Outcome</Label>
                      <Select value={actOutcome} onValueChange={(v) => setActOutcome(v || '')}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                        <SelectContent>
                          {OUTCOME_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Subject</Label>
                    <Input className="h-8" value={actSubject} onChange={(e) => setActSubject(e.target.value)} placeholder="Brief subject..." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Textarea rows={3} value={actBody} onChange={(e) => setActBody(e.target.value)} placeholder="What was discussed? Key points, client preferences, objections..." />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Duration (minutes)</Label>
                      <Input className="h-8" type="number" value={actDuration} onChange={(e) => setActDuration(e.target.value)} placeholder="e.g. 15" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Schedule Follow-up</Label>
                      <Input className="h-8" type="date" value={actFollowUpDate} onChange={(e) => setActFollowUpDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowActivityForm(false)}>Cancel</Button>
                    <Button size="sm" onClick={addActivity} disabled={submitting || !actBody}>Save Activity</Button>
                  </div>
                </div>
              </CardContent>
            )}

            <CardContent className="pt-4">
              {activities.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No activities logged yet. Start by logging your first interaction.</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                  <div className="space-y-4">
                    {activities.map((a) => {
                      const Icon = getActivityIcon(a.type);
                      return (
                        <div key={a.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-background border-2 border-primary" />

                          <div className="border rounded-lg p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium capitalize">{a.type.replace(/_/g, ' ')}</span>
                                {a.outcome && (
                                  <Badge variant="outline" className="text-xs">{a.outcome}</Badge>
                                )}
                                {a.duration_minutes && (
                                  <span className="text-xs text-muted-foreground">{a.duration_minutes} min</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {a.users?.full_name || 'System'} &bull; {format(new Date(a.created_at), 'dd MMM HH:mm')}
                              </span>
                            </div>
                            {a.subject && <p className="text-sm font-medium mt-1">{a.subject}</p>}
                            {a.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>}
                            {a.follow_up_date && (
                              <div className="flex items-center gap-2 mt-2 text-xs">
                                <Calendar className="h-3 w-3" />
                                <span className={a.follow_up_done ? 'line-through text-muted-foreground' : 'text-orange-600 font-medium'}>
                                  Follow-up: {a.follow_up_date}
                                </span>
                                {!a.follow_up_done && (
                                  <Button size="sm" variant="ghost" className="h-5 text-xs px-1" onClick={() => markFollowUpDone(a.id)}>
                                    Mark done
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send to Supplier Modal */}
      <SendToSupplierModal
        open={showSupplierModal}
        onOpenChange={setShowSupplierModal}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        enquiry={{ id, ...enquiry } as any}
        onSuccess={fetchAll}
      />

      {/* Loss Reason Dialog */}
      {showLossDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">Why was this lead lost?</h3>
            <div className="space-y-2">
              <Label className="text-sm">Reason *</Label>
              <Select value={lossReason} onValueChange={(v) => setLossReason(v || '')}>
                <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Notes (optional)</Label>
              <Textarea
                value={lossNotes}
                onChange={e => setLossNotes(e.target.value)}
                placeholder="Any additional context..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowLossDialog(false); setLossReason(''); setLossNotes(''); }}>
                Cancel
              </Button>
              <Button onClick={confirmLost} disabled={!lossReason}>
                Mark as Lost
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
