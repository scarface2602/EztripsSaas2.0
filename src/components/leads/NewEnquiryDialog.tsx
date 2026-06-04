'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const SERVICE_OPTIONS = [
  { id: 'flight', label: 'Flight' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'activity', label: 'Activity' },
] as const;

type NewEnquiryForm = {
  name: string;
  phone: string;
  email: string;
  adults: string;
  children: string;
  destination: string;
  service_requirements: string[];
};

const EMPTY_FORM: NewEnquiryForm = {
  name: '',
  phone: '',
  email: '',
  adults: '1',
  children: '0',
  destination: '',
  service_requirements: [],
};

export function NewEnquiryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (enquiry: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<NewEnquiryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleService = (id: string) => {
    setForm(f => ({
      ...f,
      service_requirements: f.service_requirements.includes(id)
        ? f.service_requirements.filter(s => s !== id)
        : [...f.service_requirements, id],
    }));
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.name || !form.phone) {
      setError('Name and phone are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/website/cms/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email || null,
          adults: parseInt(form.adults) || 1,
          children: parseInt(form.children) || 0,
          destination: form.destination || null,
          service_requirements: form.service_requirements,
          source: 'offline',
          requirement_type: 'package',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }
      const created = await res.json();
      if (created.duplicate_warning) toast.warning(created.duplicate_warning);
      onCreated({ ...created, proposal_count: 0 });
      setForm(EMPTY_FORM);
      onOpenChange(false);
      toast.success('Enquiry created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create enquiry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Enquiry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Client name"
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+91..."
              />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label>Destination</Label>
            <Input
              value={form.destination}
              onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
              placeholder="e.g. Bali, Thailand"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Adults</Label>
              <Input
                type="number"
                min="1"
                value={form.adults}
                onChange={e => setForm(f => ({ ...f, adults: e.target.value }))}
              />
            </div>
            <div>
              <Label>Children</Label>
              <Input
                type="number"
                min="0"
                value={form.children}
                onChange={e => setForm(f => ({ ...f, children: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Service Requirements</Label>
            <div className="flex gap-4 mt-2">
              {SERVICE_OPTIONS.map(svc => (
                <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.service_requirements.includes(svc.id)}
                    onCheckedChange={() => toggleService(svc.id)}
                  />
                  {svc.label}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating...' : 'Create Enquiry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
