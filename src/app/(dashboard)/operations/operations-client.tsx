'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import {
  AlertTriangle, Clock, CheckCircle2, Plane, Hotel,
  Car, MapPin, Send, CalendarClock, MailCheck, Phone,
  ShieldAlert, Loader2, Filter, UserCircle, LogIn, LogOut,
  ListChecks, LayoutGrid, Square, CheckSquare, CreditCard, PhoneForwarded,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { SUPPLIER_STATUS_LABELS, SUPPLIER_STATUS_COLORS, ITEM_TYPE_LABELS } from '@/lib/types/booking-items';
import type { SupplierStatus, ItemType } from '@/lib/types/booking-items';
import Link from 'next/link';
import { EmailComposerDialog, type EmailComposerData } from '@/components/operations/EmailComposerDialog';
import { toast } from 'sonner';

/* eslint-disable @typescript-eslint/no-explicit-any */

const TYPE_ICONS: Record<string, React.ReactNode> = {
  flight_segment: <Plane className="h-4 w-4" />,
  hotel_room: <Hotel className="h-4 w-4" />,
  vehicle: <Car className="h-4 w-4" />,
  transfer: <Car className="h-4 w-4" />,
  activity: <MapPin className="h-4 w-4" />,
};

type ActionType = 'request_confirmation' | 'mark_confirmed' | 'mark_on_hold' | 'follow_up' | 'escalate' | 'check_in' | 'check_out';

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
}

interface OperationsClientProps {
  items: any[];
  todayItems: any[];
  todayCheckouts: any[];
  teamMembers: TeamMember[];
  currentUserId: string;
  supplierDues: { total: number; supplierCount: number };
}

function daysWaiting(dateStr: string | null): number {
  if (!dateStr) return 0;
  return differenceInDays(new Date(), new Date(dateStr));
}

function dueDateUrgency(dueDate: string | null): { color: string; label: string } {
  if (!dueDate) return { color: '', label: '' };
  const hours = differenceInHours(new Date(dueDate), new Date());
  if (hours < 0) return { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Overdue' };
  if (hours < 48) return { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'Due soon' };
  if (hours < 168) return { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: `${Math.ceil(hours / 24)}d left` };
  return { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: `${Math.ceil(hours / 24)}d left` };
}

export default function OperationsClient({ items: initialItems, todayItems: initialTodayItems, todayCheckouts: initialCheckouts, teamMembers, currentUserId, supplierDues }: OperationsClientProps) {
  const [items, setItems] = useState(initialItems);
  const [todayItems, setTodayItems] = useState(initialTodayItems);
  const [todayCheckouts, setTodayCheckouts] = useState(initialCheckouts);

  // View mode
  const [viewMode, setViewMode] = useState<'board' | 'checklist'>('board');

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Action modal state
  const [actionModal, setActionModal] = useState<{ type: ActionType; item: any } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionForm, setActionForm] = useState<Record<string, string>>({});
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);

  // Email composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerData, setComposerData] = useState<EmailComposerData | null>(null);

  const openComposer = useCallback((action: string, item: any, emailData: { to: string; subject: string; html: string }, formExtra?: Record<string, string>) => {
    const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
    setComposerData({
      action,
      item_id: item.id,
      booking_id: booking?.id || item.booking_id,
      to: emailData.to,
      cc: '',
      subject: emailData.subject,
      html_body: emailData.html,
      ...formExtra,
    });
    setComposerOpen(true);
  }, []);

  const handleComposerSend = useCallback(async (payload: {
    action: string;
    item_id: string;
    to: string;
    cc: string;
    html_body: string;
    attachments: File[];
    attach_system_voucher: boolean;
    vendor_name?: string;
    vendor_email?: string;
    supplier_reference?: string;
    supplier_notes?: string;
    payment_due_date?: string;
  }) => {
    // Find the booking_id from composer data
    const bookingId = composerData?.booking_id;
    if (!bookingId) throw new Error('No booking ID');

    const formData = new FormData();
    formData.append('action', payload.action);
    formData.append('item_id', payload.item_id);
    formData.append('html_body', payload.html_body);
    formData.append('to', payload.to);
    if (payload.cc) formData.append('cc', payload.cc);
    formData.append('attach_system_voucher', String(payload.attach_system_voucher));
    if (payload.vendor_name) formData.append('vendor_name', payload.vendor_name);
    if (payload.vendor_email) formData.append('vendor_email', payload.vendor_email);
    if (payload.supplier_reference) formData.append('supplier_reference', payload.supplier_reference);
    if (payload.supplier_notes) formData.append('supplier_notes', payload.supplier_notes);
    if (payload.payment_due_date) formData.append('payment_due_date', payload.payment_due_date);
    for (const file of payload.attachments) {
      formData.append('attachments', file);
    }

    const res = await fetch(`/api/bookings/${bookingId}/ops-action`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Action failed');
    }

    const data = await res.json();
    toast.success(data.emailSent ? 'Email sent successfully' : 'Action completed');

    // Update local state same as executeAction does
    setItems(prev => prev.map(i => {
      if (i.id !== payload.item_id) return i;
      const updated = { ...i };
      if (payload.action === 'request_confirmation') {
        updated.supplier_status = 'confirmation_requested';
        if (payload.vendor_name) updated.vendor_name = payload.vendor_name;
        if (payload.vendor_email) updated.vendor_email = payload.vendor_email;
      } else if (payload.action === 'follow_up') {
        updated.followup_count = (updated.followup_count || 0) + 1;
        updated.last_followup_at = new Date().toISOString();
      } else if (payload.action === 'escalate') {
        updated.escalated = true;
      }
      return updated;
    }));
  }, [composerData]);

  // Assign handler
  const handleAssign = useCallback(async (itemId: string, assignTo: string | null) => {
    try {
      const res = await fetch(`/api/booking-items/${itemId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: assignTo }),
      });
      if (res.ok) {
        const updateFn = (prev: any[]) => prev.map(i => i.id === itemId ? { ...i, assigned_to: assignTo } : i);
        setItems(updateFn);
        setTodayItems(updateFn);
      }
    } catch { /* ignore */ }
  }, []);

  // Apply filters
  const filteredItems = items.filter((i: any) => {
    if (typeFilter !== 'all' && i.item_type !== typeFilter) return false;
    if (statusFilter !== 'all' && i.supplier_status !== statusFilter) return false;
    if (assigneeFilter === 'mine' && i.assigned_to !== currentUserId) return false;
    if (assigneeFilter === 'unassigned' && i.assigned_to) return false;
    if (assigneeFilter !== 'all' && assigneeFilter !== 'mine' && assigneeFilter !== 'unassigned' && i.assigned_to !== assigneeFilter) return false;
    return true;
  });

  // Categorize
  const urgent = filteredItems.filter((i: any) => {
    if (i.escalated) return true;
    if (i.payment_due_date) {
      const hours = differenceInHours(new Date(i.payment_due_date), new Date());
      return hours < 48 && hours >= 0;
    }
    return false;
  });
  const overdue = filteredItems.filter((i: any) => {
    if (!i.payment_due_date) return false;
    return new Date(i.payment_due_date) < new Date();
  });
  const awaitingVendor = filteredItems.filter((i: any) => i.supplier_status === 'confirmation_requested');
  const pendingOnly = filteredItems.filter((i: any) => i.supplier_status === 'pending');
  const confirmedCount = filteredItems.filter((i: any) => i.supplier_status === 'confirmed').length;

  const openAction = useCallback((type: ActionType, item: any) => {
    setActionForm({});
    setActionResult(null);
    setActionModal({ type, item });
  }, []);

  const executeAction = useCallback(async () => {
    if (!actionModal) return;
    setActionLoading(true);
    setActionResult(null);

    const { type, item } = actionModal;
    const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;

    try {
      const res = await fetch(`/api/bookings/${booking?.id || item.booking_id}/ops-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: type,
          item_id: item.id,
          ...actionForm,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setActionResult({ success: false, message: err.error || 'Action failed' });
        return;
      }

      const data = await res.json();

      // Update item in local state
      setItems(prev => prev.map(i => {
        if (i.id !== item.id) return i;
        const updated = { ...i };
        switch (type) {
          case 'request_confirmation':
            updated.supplier_status = 'confirmation_requested';
            if (actionForm.vendor_name) updated.vendor_name = actionForm.vendor_name;
            if (actionForm.vendor_email) updated.vendor_email = actionForm.vendor_email;
            break;
          case 'mark_confirmed':
            updated.supplier_status = 'confirmed';
            if (actionForm.supplier_reference) updated.supplier_reference = actionForm.supplier_reference;
            break;
          case 'mark_on_hold':
            updated.supplier_status = 'on_hold';
            if (actionForm.payment_due_date) updated.payment_due_date = actionForm.payment_due_date;
            break;
          case 'follow_up':
            updated.followup_count = (updated.followup_count || 0) + 1;
            updated.last_followup_at = new Date().toISOString();
            break;
          case 'escalate':
            updated.escalated = true;
            break;
          case 'check_in':
            updated.checked_in_at = new Date().toISOString();
            break;
          case 'check_out':
            updated.checked_out_at = new Date().toISOString();
            break;
        }
        return updated;
      }));

      // Also update todayItems and todayCheckouts
      if (type === 'check_in' || type === 'check_out') {
        const updateFn = (prev: any[]) => prev.map(i => {
          if (i.id !== item.id) return i;
          return { ...i, ...(type === 'check_in' ? { checked_in_at: new Date().toISOString() } : { checked_out_at: new Date().toISOString() }) };
        });
        setTodayItems(updateFn);
        setTodayCheckouts(updateFn);
      }

      setActionResult({
        success: true,
        message: data.emailSent
          ? 'Done! Email sent.'
          : type === 'follow_up' && !item.vendor_email
          ? 'Follow-up logged. No vendor email — email not sent.'
          : 'Done!',
      });

      setTimeout(() => setActionModal(null), 1200);
    } catch {
      setActionResult({ success: false, message: 'Network error' });
    } finally {
      setActionLoading(false);
    }
  }, [actionModal, actionForm]);

  const todayStr = new Date().toISOString().split('T')[0];

  const ActionButtons = ({ item }: { item: any }) => {
    const status = item.supplier_status as SupplierStatus;
    const isToday = item.start_date === todayStr;
    const isCheckoutDay = item.end_date === todayStr;
    const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
    const vendorEmail = item.vendor_email || '';
    const vendorName = item.vendor_name || 'Supplier';

    const handleRequestConfirmation = (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (vendorEmail) {
        // Pre-load email template and open composer
        const subject = `Confirmation Request — ${item.label} for ${booking?.clients?.full_name || 'Guest'}`;
        const html = `<p>Dear ${vendorName},</p><p>Please confirm the following booking at the earliest:</p><p><strong>${item.label}</strong></p><p>Please share the confirmation number once done.</p><p>Regards</p>`;
        openComposer('request_confirmation', item, { to: vendorEmail, subject, html }, { vendor_name: vendorName, vendor_email: vendorEmail });
      } else {
        openAction('request_confirmation', item);
      }
    };

    const handleFollowUp = (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (vendorEmail) {
        const followupNum = (item.followup_count || 0) + 1;
        const subject = `Follow Up #${followupNum} — ${item.label} for ${booking?.clients?.full_name || 'Guest'}`;
        const html = `<p>Dear ${vendorName},</p><p>This is follow-up <strong>#${followupNum}</strong> regarding our earlier request for confirmation on <strong>${item.label}</strong>.</p><p>Kindly expedite the confirmation.</p><p>Regards</p>`;
        openComposer('follow_up', item, { to: vendorEmail, subject, html });
      } else {
        openAction('follow_up', item);
      }
    };

    return (
      <div className="flex items-center gap-1 flex-wrap" onClick={e => e.preventDefault()}>
        {(status === 'pending' || status === 'on_hold') && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
            onClick={handleRequestConfirmation}>
            <Send className="h-3 w-3" /> Request
          </Button>
        )}
        {(status === 'pending' || status === 'confirmation_requested' || status === 'on_hold') && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
            onClick={e => { e.preventDefault(); e.stopPropagation(); openAction('mark_confirmed', item); }}>
            <CheckCircle2 className="h-3 w-3" /> Confirm
          </Button>
        )}
        {(status === 'pending' || status === 'confirmation_requested') && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-900/20"
            onClick={e => { e.preventDefault(); e.stopPropagation(); openAction('mark_on_hold', item); }}>
            <Clock className="h-3 w-3" /> Hold
          </Button>
        )}
        {status === 'confirmation_requested' && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-blue-700 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/20"
            onClick={handleFollowUp}>
            <Phone className="h-3 w-3" /> Follow Up
          </Button>
        )}
        {!item.escalated && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
            onClick={e => { e.preventDefault(); e.stopPropagation(); openAction('escalate', item); }}>
            <ShieldAlert className="h-3 w-3" /> Escalate
          </Button>
        )}
        {/* Check-in: show for today's items that haven't checked in */}
        {isToday && !item.checked_in_at && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-teal-700 border-teal-300 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-700 dark:hover:bg-teal-900/20"
            onClick={e => { e.preventDefault(); e.stopPropagation(); openAction('check_in', item); }}>
            <LogIn className="h-3 w-3" /> Check In
          </Button>
        )}
        {/* Check-out: show for items that are checked in and end today */}
        {isCheckoutDay && item.checked_in_at && !item.checked_out_at && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/20"
            onClick={e => { e.preventDefault(); e.stopPropagation(); openAction('check_out', item); }}>
            <LogOut className="h-3 w-3" /> Check Out
          </Button>
        )}
        {/* Show checked-in badge */}
        {item.checked_in_at && !item.checked_out_at && (
          <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-[10px]">Checked In</Badge>
        )}
        {item.checked_out_at && (
          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[10px]">Checked Out</Badge>
        )}
      </div>
    );
  };

  // Checklist View Component — grouped by overdue / due today / upcoming
  // Uses both scheduled_reminders (API) and booking items (props, 30-day window)
  const ChecklistView = () => {
    const [taskGroups, setTaskGroups] = useState<{ overdue: any[]; due_today: any[]; upcoming: any[] }>({ overdue: [], due_today: [], upcoming: [] });
    const [checklistLoading, setChecklistLoading] = useState(true);
    const [handledItems, setHandledItems] = useState<Set<string>>(new Set());

    useEffect(() => {
      fetch('/api/ops/daily-tasks')
        .then(r => r.ok ? r.json() : { overdue: [], due_today: [], upcoming: [] })
        .then(data => {
          // Supplement with booking items from the 30-day window (items prop)
          // that aren't already covered by a scheduled_reminder
          const itemTasks: { overdue: any[]; due_today: any[]; upcoming: any[] } = { overdue: [], due_today: [], upcoming: [] };
          const actionableStatuses = ['pending', 'confirmation_requested', 'on_hold'];

          for (const item of items) {
            if (!actionableStatuses.includes(item.supplier_status)) continue;
            // Skip if already represented by a reminder
            const hasReminder = (data.overdue || []).concat(data.due_today || [], data.upcoming || [])
              .some((t: any) => t.booking_item?.id === item.id);
            if (hasReminder) continue;

            const booking = item.bookings as any;
            const task = {
              id: `item-${item.id}`,
              type: item.supplier_status === 'confirmation_requested' ? 'supplier_followup' : 'supplier_followup',
              scheduled_for: item.start_date,
              status: 'pending',
              booking_id: item.booking_id,
              booking_item: item,
              booking: booking ? {
                id: booking.id,
                title: booking.title,
                destination: booking.destination,
                client_name: booking.clients?.full_name || 'Guest',
              } : null,
            };

            const startDate = (item.start_date || '').split('T')[0];
            if (startDate < todayStr) {
              itemTasks.overdue.push(task);
            } else if (startDate === todayStr) {
              itemTasks.due_today.push(task);
            } else {
              itemTasks.upcoming.push(task);
            }
          }

          setTaskGroups({
            overdue: [...(data.overdue || []), ...itemTasks.overdue],
            due_today: [...(data.due_today || []), ...itemTasks.due_today],
            upcoming: [...(data.upcoming || []), ...itemTasks.upcoming],
          });
        })
        .catch(() => {})
        .finally(() => setChecklistLoading(false));
    }, []);

    const toggleHandled = (id: string) => {
      setHandledItems(prev => {
        const next = new Set(prev);
        if (next.has(id)) { next.delete(id); } else { next.add(id); }
        return next;
      });
    };

    const allTasks = [...taskGroups.overdue, ...taskGroups.due_today, ...taskGroups.upcoming];
    const total = allTasks.length;
    const handled = handledItems.size;
    const pct = total > 0 ? Math.round((handled / total) * 100) : 0;

    const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
      supplier_followup: { icon: <PhoneForwarded className="h-3.5 w-3.5" />, color: 'text-orange-600', label: 'Follow Up' },
      payment_due: { icon: <CreditCard className="h-3.5 w-3.5" />, color: 'text-red-600', label: 'Payment Due' },
      booking_confirmed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-green-600', label: 'Confirmed' },
    };

    // Dynamic action buttons based on booking item state
    const TaskActions = ({ task }: { task: any }) => {
      const item = task.booking_item;
      if (!item) return null;
      const status = item.supplier_status;
      const isOverdue = task.scheduled_for?.split('T')[0] < todayStr;

      return (
        <div className="flex items-center gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
          {(status === 'pending' || status === 'on_hold') && (
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
              onClick={() => { console.log('[ops-action] request_confirmation', { item_id: item.id, booking_id: task.booking_id }); openAction('request_confirmation', { ...item, bookings: task.booking, booking_id: task.booking_id }); }}>
              <Send className="h-3 w-3" /> Request
            </Button>
          )}
          {status === 'confirmation_requested' && (
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-green-700 border-green-300"
              onClick={() => { console.log('[ops-action] mark_confirmed', { item_id: item.id }); openAction('mark_confirmed', { ...item, bookings: task.booking, booking_id: task.booking_id }); }}>
              <CheckCircle2 className="h-3 w-3" /> Confirm
            </Button>
          )}
          {status === 'confirmation_requested' && (
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-blue-700 border-blue-300"
              onClick={() => { console.log('[ops-action] follow_up', { item_id: item.id }); openAction('follow_up', { ...item, bookings: task.booking, booking_id: task.booking_id }); }}>
              <Phone className="h-3 w-3" /> Follow Up
            </Button>
          )}
          {isOverdue && !item.escalated && (
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-red-700 border-red-300"
              onClick={() => { console.log('[ops-action] escalate', { item_id: item.id }); openAction('escalate', { ...item, bookings: task.booking, booking_id: task.booking_id }); }}>
              <ShieldAlert className="h-3 w-3" /> Escalate
            </Button>
          )}
          {item.escalated && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">Escalated</Badge>
          )}
        </div>
      );
    };

    const TaskGroup = ({ title, subtitle, tasks, color }: { title: string; subtitle: string; tasks: any[]; color: string }) => {
      if (tasks.length === 0) return null;
      return (
        <div>
          <div className="mb-2">
            <h3 className={`text-sm font-semibold ${color}`}>{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="space-y-1">
            {tasks.map((task: any) => {
              const config = TYPE_CONFIG[task.type] || TYPE_CONFIG.supplier_followup;
              const isHandled = handledItems.has(task.id);
              const itemLabel = task.booking_item?.label || task.type?.replace(/_/g, ' ');
              return (
                <Card
                  key={task.id}
                  className={`p-3 transition-colors cursor-pointer hover:bg-muted/50 ${isHandled ? 'opacity-50' : ''}`}
                  onClick={() => toggleHandled(task.id)}
                >
                  <div className="flex items-start gap-3">
                    <button className="shrink-0 mt-0.5" onClick={e => { e.stopPropagation(); toggleHandled(task.id); }}>
                      {isHandled
                        ? <CheckSquare className="h-5 w-5 text-green-600" />
                        : <Square className="h-5 w-5 text-muted-foreground" />
                      }
                    </button>
                    <div className={`shrink-0 mt-0.5 ${config.color}`}>{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isHandled ? 'line-through' : ''}`}>{itemLabel}</span>
                        <Badge variant="outline" className="text-[10px]">{config.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <span>{task.booking?.client_name || 'Guest'}</span>
                        {task.booking?.title && <span> · {task.booking.title}</span>}
                      </div>
                      {!isHandled && <TaskActions task={task} />}
                    </div>
                    <Link
                      href={`/bookings/${task.booking_id}`}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      View
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      );
    };

    if (checklistLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (total === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-green-500" />
            <p className="font-medium">All clear for today!</p>
            <p className="text-sm mt-1">No action items on your checklist.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* Progress */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Today&apos;s Progress</span>
            <span className="text-sm text-muted-foreground">{handled} of {total} items handled</span>
          </div>
          <Progress value={pct} className="h-2" />
        </Card>

        <TaskGroup
          title="Overdue"
          subtitle={`${taskGroups.overdue.length} task${taskGroups.overdue.length !== 1 ? 's' : ''} past due`}
          tasks={taskGroups.overdue}
          color="text-red-600"
        />
        <TaskGroup
          title="Due Today"
          subtitle={`${taskGroups.due_today.length} task${taskGroups.due_today.length !== 1 ? 's' : ''} for today`}
          tasks={taskGroups.due_today}
          color="text-foreground"
        />
        <TaskGroup
          title="Upcoming"
          subtitle={`${taskGroups.upcoming.length} task${taskGroups.upcoming.length !== 1 ? 's' : ''} scheduled`}
          tasks={taskGroups.upcoming}
          color="text-blue-600"
        />
      </div>
    );
  };

  const AssigneeSelect = ({ item }: { item: any }) => {
    const assigneeName = item.assigned_to
      ? teamMembers.find(m => m.id === item.assigned_to)?.full_name || 'Unknown'
      : null;

    return (
      <Select
        value={item.assigned_to || '_unassigned'}
        onValueChange={v => handleAssign(item.id, v === '_unassigned' ? null : v)}
      >
        <SelectTrigger className="h-6 text-[10px] w-auto min-w-[100px] max-w-[140px] gap-1 border-dashed" onClick={e => e.preventDefault()}>
          <UserCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">{assigneeName || 'Assign'}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_unassigned">Unassigned</SelectItem>
          {teamMembers.map(m => (
            <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const ItemRow = ({ item, showUrgency, showWaiting }: { item: any; showUrgency?: boolean; showWaiting?: boolean }) => {
    const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
    const client = booking?.clients;
    const status = item.supplier_status as SupplierStatus;
    const itemType = item.item_type as ItemType;
    const vendor = item.vendor_name || item.portal_name || '';
    const urgency = showUrgency && item.payment_due_date ? dueDateUrgency(item.payment_due_date) : null;
    const waitDays = showWaiting ? daysWaiting(item.last_followup_at) : 0;

    return (
      <Card className="p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-start gap-3">
          <div className="text-muted-foreground mt-1">
            {TYPE_ICONS[itemType] || <MapPin className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/bookings/${item.booking_id}`} className="font-medium text-sm truncate hover:underline">
                {item.label}
              </Link>
              <Badge className={`text-[10px] px-1.5 py-0 ${SUPPLIER_STATUS_COLORS[status]}`}>
                {SUPPLIER_STATUS_LABELS[status]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {ITEM_TYPE_LABELS[itemType]}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span>{client?.full_name || 'Guest'}</span>
              {booking?.title && <span>· {booking.title}</span>}
              {vendor && <span>· {vendor}</span>}
              {item.supplier_reference && (
                <span className="font-mono">· Ref: {item.supplier_reference}</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <ActionButtons item={item} />
              <div onClick={e => e.stopPropagation()}>
                <AssigneeSelect item={item} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.escalated && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">Escalated</Badge>
            )}
            {urgency && (
              <Badge className={`text-[10px] ${urgency.color}`}>{urgency.label}</Badge>
            )}
            {showWaiting && waitDays > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {waitDays}d waiting
                {item.followup_count > 0 && ` · ${item.followup_count} follow-up${item.followup_count > 1 ? 's' : ''}`}
              </Badge>
            )}
            {item.start_date && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(item.start_date), 'dd MMM')}
              </span>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Operations</h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1 rounded-r-none"
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="h-4 w-4" /> Board
            </Button>
            <Button
              variant={viewMode === 'checklist' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1 rounded-l-none"
              onClick={() => setViewMode('checklist')}
            >
              <ListChecks className="h-4 w-4" /> Checklist
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4" /> Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="flex gap-4 flex-wrap">
            <div className="w-48">
              <Label className="text-xs mb-1 block">Item Type</Label>
              <Select value={typeFilter} onValueChange={v => setTypeFilter(v || 'all')}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v || 'all')}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(['pending', 'confirmation_requested', 'on_hold', 'confirmed'] as SupplierStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{SUPPLIER_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs mb-1 block">Assigned To</Label>
              <Select value={assigneeFilter} onValueChange={v => setAssigneeFilter(v || 'all')}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  <SelectItem value="mine">My Items</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Checklist View */}
      {viewMode === 'checklist' && <ChecklistView />}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-xs text-muted-foreground">Urgent</p>
          </div>
          <p className="text-2xl font-bold mt-1">{urgent.length + overdue.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-600" />
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <p className="text-2xl font-bold mt-1">{pendingOnly.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-muted-foreground">Awaiting Vendor</p>
          </div>
          <p className="text-2xl font-bold mt-1">{awaitingVendor.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-xs text-muted-foreground">Confirmed</p>
          </div>
          <p className="text-2xl font-bold mt-1">{confirmedCount} <span className="text-sm text-muted-foreground font-normal">of {filteredItems.length}</span></p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-purple-600" />
            <p className="text-xs text-muted-foreground">Today&apos;s Travel</p>
          </div>
          <p className="text-2xl font-bold mt-1">{todayItems.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <LogIn className="h-4 w-4 text-teal-600" />
            <p className="text-xs text-muted-foreground">Check-ins</p>
          </div>
          <p className="text-2xl font-bold mt-1">
            {todayItems.filter((i: any) => i.checked_in_at).length} <span className="text-sm text-muted-foreground font-normal">of {todayItems.length}</span>
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <LogOut className="h-4 w-4 text-amber-600" />
            <p className="text-xs text-muted-foreground">Check-outs</p>
          </div>
          <p className="text-2xl font-bold mt-1">
            {todayCheckouts.filter((i: any) => i.checked_out_at).length} <span className="text-sm text-muted-foreground font-normal">of {todayCheckouts.length}</span>
          </p>
        </Card>
        {supplierDues.total > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-rose-600" />
              <p className="text-xs text-muted-foreground">Supplier Dues</p>
            </div>
            <p className="text-lg font-bold mt-1">
              {supplierDues.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground">{supplierDues.supplierCount} supplier{supplierDues.supplierCount !== 1 ? 's' : ''} this week</p>
          </Card>
        )}
      </div>

      {/* Urgent & Overdue */}
      {viewMode === 'board' && (urgent.length > 0 || overdue.length > 0) && (
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" /> Action Required
            </h2>
            <p className="text-xs text-muted-foreground ml-7">Needs immediate attention</p>
          </div>
          <div className="grid gap-2">
            {[...overdue, ...urgent.filter(u => !overdue.includes(u))].map((item: any) => (
              <ItemRow key={item.id} item={item} showUrgency />
            ))}
          </div>
        </div>
      )}

      {/* Awaiting Vendor */}
      {viewMode === 'board' && awaitingVendor.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" /> Waiting on Supplier
            </h2>
            <p className="text-xs text-muted-foreground ml-7">Confirmation requested, pending response</p>
          </div>
          <div className="grid gap-2">
            {awaitingVendor
              .sort((a: any, b: any) => daysWaiting(b.last_followup_at || b.created_at) - daysWaiting(a.last_followup_at || a.created_at))
              .map((item: any) => (
                <ItemRow key={item.id} item={item} showWaiting />
              ))}
          </div>
        </div>
      )}

      {/* Pending */}
      {viewMode === 'board' && pendingOnly.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" /> Pending
            </h2>
            <p className="text-xs text-muted-foreground ml-7">Not yet sent to supplier</p>
          </div>
          <div className="grid gap-2">
            {pendingOnly.map((item: any) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Today's Travel / Check-ins */}
      {viewMode === 'board' && todayItems.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <LogIn className="h-5 w-5 text-teal-600" /> Today&apos;s Check-ins
            </h2>
            <p className="text-xs text-muted-foreground ml-7">Guest arrivals scheduled for today</p>
          </div>
          <div className="grid gap-2">
            {todayItems.map((item: any) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Today's Check-outs */}
      {viewMode === 'board' && todayCheckouts.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <LogOut className="h-5 w-5 text-amber-600" /> Today&apos;s Check-outs
            </h2>
            <p className="text-xs text-muted-foreground ml-7">Guest departures scheduled for today</p>
          </div>
          <div className="grid gap-2">
            {todayCheckouts.map((item: any) => (
              <ItemRow key={`checkout-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {viewMode === 'board' && filteredItems.length === 0 && todayItems.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-green-500" />
            <p className="font-medium">All clear!</p>
            <p className="text-sm mt-1">No pending items or travel today.</p>
          </CardContent>
        </Card>
      )}

      {/* Action Modal */}
      <Dialog open={!!actionModal} onOpenChange={open => { if (!open) setActionModal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionModal?.type === 'request_confirmation' && 'Request Confirmation'}
              {actionModal?.type === 'mark_confirmed' && 'Mark as Confirmed'}
              {actionModal?.type === 'mark_on_hold' && 'Put On Hold'}
              {actionModal?.type === 'follow_up' && 'Send Follow Up'}
              {actionModal?.type === 'escalate' && 'Escalate Item'}
              {actionModal?.type === 'check_in' && 'Check In Guest'}
              {actionModal?.type === 'check_out' && 'Check Out Guest'}
            </DialogTitle>
          </DialogHeader>

          {actionModal && (
            <div className="space-y-4">
              {/* Item context */}
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p className="font-medium">{actionModal.item.label}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {(() => {
                    const b = Array.isArray(actionModal.item.bookings) ? actionModal.item.bookings[0] : actionModal.item.bookings;
                    return `${b?.clients?.full_name || 'Guest'} · ${b?.title || ''}`;
                  })()}
                </p>
              </div>

              {/* Request Confirmation fields */}
              {actionModal.type === 'request_confirmation' && (
                <>
                  <div>
                    <Label>Vendor Name</Label>
                    <Input
                      placeholder={actionModal.item.vendor_name || 'Supplier name'}
                      defaultValue={actionModal.item.vendor_name || ''}
                      onChange={e => setActionForm(f => ({ ...f, vendor_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Vendor Email</Label>
                    <Input
                      type="email"
                      placeholder={actionModal.item.vendor_email || 'supplier@email.com'}
                      defaultValue={actionModal.item.vendor_email || ''}
                      onChange={e => setActionForm(f => ({ ...f, vendor_email: e.target.value }))}
                    />
                    {!actionModal.item.vendor_email && !actionForm.vendor_email && (
                      <p className="text-xs text-amber-600 mt-1">No email — status will update but no email will be sent.</p>
                    )}
                  </div>
                </>
              )}

              {/* Mark Confirmed fields */}
              {actionModal.type === 'mark_confirmed' && (
                <>
                  <div>
                    <Label>Confirmation Number / Reference</Label>
                    <Input
                      placeholder="e.g. CONF-12345"
                      onChange={e => setActionForm(f => ({ ...f, supplier_reference: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Notes (optional)</Label>
                    <Textarea
                      placeholder="Any notes..."
                      rows={2}
                      onChange={e => setActionForm(f => ({ ...f, supplier_notes: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* On Hold fields */}
              {actionModal.type === 'mark_on_hold' && (
                <>
                  <div>
                    <Label>Blocking Reference</Label>
                    <Input
                      placeholder="e.g. hold ref or PNR"
                      onChange={e => setActionForm(f => ({ ...f, supplier_reference: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Hold Expiry / Payment Due Date</Label>
                    <Input
                      type="date"
                      onChange={e => setActionForm(f => ({ ...f, payment_due_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Notes (optional)</Label>
                    <Textarea
                      placeholder="Any notes..."
                      rows={2}
                      onChange={e => setActionForm(f => ({ ...f, supplier_notes: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Follow Up */}
              {actionModal.type === 'follow_up' && (
                <div className="text-sm text-muted-foreground">
                  {actionModal.item.vendor_email ? (
                    <p className="flex items-center gap-2">
                      <MailCheck className="h-4 w-4 text-blue-500" />
                      Follow-up email will be sent to <strong>{actionModal.item.vendor_email}</strong>
                      {actionModal.item.followup_count > 0 && (
                        <span> (follow-up #{(actionModal.item.followup_count || 0) + 1})</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-amber-600">No vendor email on file. Follow-up will be logged but no email sent.</p>
                  )}
                </div>
              )}

              {/* Escalate */}
              {actionModal.type === 'escalate' && (
                <div>
                  <Label>Escalation Notes</Label>
                  <Textarea
                    placeholder="Why is this being escalated?"
                    rows={2}
                    onChange={e => setActionForm(f => ({ ...f, supplier_notes: e.target.value }))}
                  />
                </div>
              )}

              {/* Check In */}
              {actionModal.type === 'check_in' && (
                <div className="text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <LogIn className="h-4 w-4 text-teal-500" />
                    Mark guest as checked in for <strong>{actionModal.item.label}</strong>
                  </p>
                  {actionModal.item.start_date && (
                    <p className="mt-1">Start date: {format(new Date(actionModal.item.start_date), 'dd MMM yyyy')}</p>
                  )}
                </div>
              )}

              {/* Check Out */}
              {actionModal.type === 'check_out' && (
                <div className="text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-amber-500" />
                    Mark guest as checked out from <strong>{actionModal.item.label}</strong>
                  </p>
                  {actionModal.item.end_date && (
                    <p className="mt-1">End date: {format(new Date(actionModal.item.end_date), 'dd MMM yyyy')}</p>
                  )}
                </div>
              )}

              {/* Result message */}
              {actionResult && (
                <p className={`text-sm font-medium ${actionResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {actionResult.message}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={executeAction} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {actionModal?.type === 'request_confirmation' && 'Send Request'}
              {actionModal?.type === 'mark_confirmed' && 'Confirm'}
              {actionModal?.type === 'mark_on_hold' && 'Put On Hold'}
              {actionModal?.type === 'follow_up' && 'Send Follow Up'}
              {actionModal?.type === 'escalate' && 'Escalate'}
              {actionModal?.type === 'check_in' && 'Check In'}
              {actionModal?.type === 'check_out' && 'Check Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Composer */}
      <EmailComposerDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        data={composerData}
        onSend={handleComposerSend}
      />
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
