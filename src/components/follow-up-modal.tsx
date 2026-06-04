'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Phone, ListTodo, Flame, Thermometer, Snowflake } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

interface FollowUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiryId: string;
  enquiryName: string;
  currentTemperature?: string;
  onSuccess: (updates: { follow_up_date?: string; lead_temperature?: string; status?: string; last_contacted_at?: string }) => void;
}

const ACTIVITY_TYPES = [
  { value: 'call_outgoing', label: 'Outgoing Call', icon: Phone },
  { value: 'call_incoming', label: 'Incoming Call', icon: Phone },
  { value: 'follow_up', label: 'To Do / Task', icon: ListTodo },
];

const OUTCOMES = [
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'callback', label: 'Call Back Later' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'voicemail', label: 'Voicemail' },
];

const NEXT_ACTIONS = [
  { value: 'call_back', label: 'Call Back' },
  { value: 'todo', label: 'To Do' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'send_proposal', label: 'Send Proposal' },
  { value: 'confirm', label: 'Confirm Booking' },
  { value: 'lost', label: 'Mark as Lost' },
];

const TEMP_OPTIONS = [
  { value: 'hot', label: 'Hot', icon: Flame, color: 'text-red-500' },
  { value: 'warm', label: 'Warm', icon: Thermometer, color: 'text-orange-500' },
  { value: 'cold', label: 'Cold', icon: Snowflake, color: 'text-blue-500' },
];

export function FollowUpModal({ open, onOpenChange, enquiryId, enquiryName, currentTemperature, onSuccess }: FollowUpModalProps) {
  const [activityType, setActivityType] = useState('call_outgoing');
  const [outcome, setOutcome] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [temperature, setTemperature] = useState(currentTemperature || 'warm');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const in2Days = format(addDays(new Date(), 2), 'yyyy-MM-dd');
  const in3Days = format(addDays(new Date(), 3), 'yyyy-MM-dd');

  const handleSave = async () => {
    setSaving(true);
    try {
      // Determine status update based on next action
      let statusUpdate: string | undefined;
      if (nextAction === 'lost') statusUpdate = 'lost';
      else if (nextAction === 'confirm') statusUpdate = 'won';
      else if (nextAction === 'send_proposal') statusUpdate = 'proposal_sent';
      else if (outcome === 'interested') statusUpdate = 'qualified';

      const res = await fetch('/api/enquiries/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enquiry_id: enquiryId,
          type: activityType,
          subject: `${ACTIVITY_TYPES.find(t => t.value === activityType)?.label || activityType}${outcome ? ` — ${outcome}` : ''}`,
          body: details || null,
          outcome: outcome || null,
          follow_up_date: followUpDate || null,
          lead_temperature: temperature,
          status: statusUpdate || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to save');
        return;
      }

      toast.success('Follow-up logged');
      onSuccess({
        follow_up_date: followUpDate || undefined,
        lead_temperature: temperature,
        status: statusUpdate,
        last_contacted_at: new Date().toISOString(),
      });
      onOpenChange(false);

      // Reset form
      setOutcome('');
      setNextAction('');
      setFollowUpDate('');
      setDetails('');
    } catch {
      toast.error('Failed to save follow-up');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Follow-Up — {enquiryName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Activity Type */}
          <div>
            <Label>Activity Type</Label>
            <div className="flex gap-2 mt-1">
              {ACTIVITY_TYPES.map(t => (
                <Button
                  key={t.value}
                  size="sm"
                  variant={activityType === t.value ? 'default' : 'outline'}
                  onClick={() => setActivityType(t.value)}
                  className="gap-1"
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Outcome */}
          {(activityType === 'call_outgoing' || activityType === 'call_incoming') && (
            <div>
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={v => setOutcome(v || '')}>
                <SelectTrigger><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Next Action */}
          <div>
            <Label>Next Action</Label>
            <Select value={nextAction} onValueChange={v => setNextAction(v || '')}>
              <SelectTrigger><SelectValue placeholder="What's next?" /></SelectTrigger>
              <SelectContent>
                {NEXT_ACTIONS.map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Schedule Quick Buttons */}
          {nextAction && nextAction !== 'lost' && nextAction !== 'confirm' && (
            <div>
              <Label>Schedule Follow-Up</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {[
                  { label: 'Today', value: today },
                  { label: 'Tomorrow', value: tomorrow },
                  { label: 'In 2 days', value: in2Days },
                  { label: 'In 3 days', value: in3Days },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={followUpDate === opt.value ? 'default' : 'outline'}
                    onClick={() => setFollowUpDate(opt.value)}
                    className="text-xs"
                  >
                    {opt.label}
                  </Button>
                ))}
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="w-40 h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* Temperature */}
          <div>
            <Label>Lead Temperature</Label>
            <div className="flex gap-2 mt-1">
              {TEMP_OPTIONS.map(t => {
                const Icon = t.icon;
                return (
                  <Button
                    key={t.value}
                    size="sm"
                    variant={temperature === t.value ? 'default' : 'outline'}
                    onClick={() => setTemperature(t.value)}
                    className="gap-1"
                  >
                    <Icon className={`h-3.5 w-3.5 ${temperature === t.value ? '' : t.color}`} />
                    {t.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Details */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Call notes, next steps..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save Follow-Up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
