'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface Enquiry {
  id: string;
  name: string;
  destination?: string;
  travel_date?: string;
  number_of_nights?: number;
  adults?: number;
  children?: number;
  budget_range?: string;
  hotel_category?: string;
  special_requirements?: string;
  requirement_type?: string;
  requirement_details?: Record<string, unknown>;
}

interface Supplier {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  contact_email: string | null;
}

interface SendToSupplierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiry: Enquiry;
  onSuccess: () => void;
}

function generateEmailBody(enquiry: Enquiry): string {
  const lines: string[] = [];
  lines.push('Dear Partner,');
  lines.push('');
  lines.push('We have a client enquiry and would appreciate your best rates and availability:');
  lines.push('');

  if (enquiry.destination) lines.push(`<strong>Destination:</strong> ${enquiry.destination}`);
  if (enquiry.travel_date) lines.push(`<strong>Travel Date:</strong> ${enquiry.travel_date}`);
  if (enquiry.number_of_nights) lines.push(`<strong>Nights:</strong> ${enquiry.number_of_nights}`);
  const pax = `${enquiry.adults || 0} Adults${(enquiry.children || 0) > 0 ? ` + ${enquiry.children} Children` : ''}`;
  lines.push(`<strong>Travellers:</strong> ${pax}`);
  if (enquiry.budget_range) lines.push(`<strong>Budget:</strong> ${enquiry.budget_range}`);
  if (enquiry.hotel_category) lines.push(`<strong>Hotel Category:</strong> ${enquiry.hotel_category}`);

  // Type-specific details
  const det = enquiry.requirement_details || {};
  if (enquiry.requirement_type === 'flight') {
    if (det.source_city) lines.push(`<strong>From:</strong> ${det.source_city}`);
    if (det.dest_city) lines.push(`<strong>To:</strong> ${det.dest_city}`);
    if (det.trip_type) lines.push(`<strong>Trip Type:</strong> ${det.trip_type}`);
    if (det.travel_class) lines.push(`<strong>Class:</strong> ${det.travel_class}`);
  } else if (enquiry.requirement_type === 'transfer') {
    if (det.mode) lines.push(`<strong>Mode:</strong> ${det.mode}`);
    if (det.going_from) lines.push(`<strong>From:</strong> ${det.going_from}`);
    if (det.going_to) lines.push(`<strong>To:</strong> ${det.going_to}`);
  } else if (enquiry.requirement_type === 'visa') {
    if (det.country) lines.push(`<strong>Country:</strong> ${det.country}`);
    if (det.visa_category) lines.push(`<strong>Category:</strong> ${det.visa_category}`);
  }

  if (enquiry.special_requirements) {
    lines.push('');
    lines.push(`<strong>Special Requirements:</strong> ${enquiry.special_requirements}`);
  }

  lines.push('');
  lines.push('Please share your best rates and availability at the earliest.');
  lines.push('');
  lines.push('Thank you,');
  lines.push('EzTrips Team');

  return lines.join('<br/>');
}

export function SendToSupplierModal({ open, onOpenChange, enquiry, onSuccess }: SendToSupplierModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  // Load suppliers
  useEffect(() => {
    if (!open) return;
    setLoadingSuppliers(true);
    supabase.from('suppliers').select('id, name, type, contact_name, contact_email')
      .order('name')
      .then(({ data }) => {
        setSuppliers(data || []);
        setLoadingSuppliers(false);
      });

    // Set default subject and body
    setEmailSubject(`Enquiry: ${enquiry.destination || 'Trip'} — ${enquiry.travel_date || 'Flexible Dates'} — ${enquiry.adults || 0} Pax`);
    setEmailBody(generateEmailBody(enquiry));
  }, [open, supabase, enquiry]);

  // When supplier selected, fill email
  useEffect(() => {
    if (!selectedSupplierId) return;
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (supplier?.contact_email) {
      setEmailTo(supplier.contact_email);
    }
  }, [selectedSupplierId, suppliers]);

  const handleSend = async () => {
    if (!selectedSupplierId || !emailTo || !emailSubject || !emailBody) {
      toast.error('Please fill all fields');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/enquiries/send-to-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enquiry_id: enquiry.id,
          supplier_id: selectedSupplierId,
          email_to: emailTo,
          email_subject: emailSubject,
          email_body: emailBody,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to send');
        return;
      }
      toast.success('Enquiry sent to supplier');
      onSuccess();
      onOpenChange(false);
      // Reset
      setSelectedSupplierId('');
      setEmailTo('');
    } catch {
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Enquiry to Supplier</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Supplier Selection */}
          <div>
            <Label>Select Supplier</Label>
            <Select value={selectedSupplierId} onValueChange={v => setSelectedSupplierId(v || '')}>
              <SelectTrigger>
                <SelectValue placeholder={loadingSuppliers ? 'Loading...' : 'Choose a supplier...'} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.type}){s.contact_email ? ` — ${s.contact_email}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Email To */}
          <div>
            <Label>Supplier Email</Label>
            <Input
              type="email"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              placeholder="supplier@example.com"
            />
          </div>

          {/* Subject */}
          <div>
            <Label>Subject</Label>
            <Input
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
            />
          </div>

          {/* Body - editable */}
          <div>
            <Label>Email Body (editable)</Label>
            <Textarea
              value={emailBody.replace(/<br\/>/g, '\n').replace(/<\/?strong>/g, '')}
              onChange={e => setEmailBody(e.target.value.replace(/\n/g, '<br/>'))}
              rows={12}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !selectedSupplierId || !emailTo}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Send to Supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
