'use client';

import { useCallback, useEffect, useState } from 'react';
import { AsyncCombobox, type AsyncOption } from '@/components/ui/async-combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { gstinError, gstinStateCode, GST_STATE_CODES, normalizeGstin } from '@/lib/utils/gstin';
import type { Client } from '@/lib/types/database';

export interface ClientOption {
  id: string;
  full_name: string;
  client_kind: 'individual' | 'business';
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  contact_name?: string | null;
}

function describe(c: ClientOption): string {
  if (c.client_kind === 'business') {
    const bits = ['Business'];
    if (c.gstin) bits.push(`GSTIN …${c.gstin.slice(-4)}`);
    if (c.contact_name) bits.push(`contact: ${c.contact_name}`);
    return bits.join(' · ');
  }
  return [c.phone, c.email].filter(Boolean).join(' · ') || 'Individual';
}

interface ClientComboboxProps {
  value: { id: string; label: string } | null;
  onChange: (client: ClientOption | null) => void;
  placeholder?: string;
  /** Restrict results to a kind (e.g. contact person pickers want individuals). */
  kind?: 'individual' | 'business';
  /** Open the details dialog right after inline-creating a client. */
  promptDetailsOnCreate?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Billing-aware client picker: searches people AND the businesses they're
 * the contact for, creates new clients inline, and (optionally) prompts
 * for kind/GST details immediately after creation.
 */
export function ClientCombobox({
  value,
  onChange,
  placeholder = 'Search client / billing entity…',
  kind,
  promptDetailsOnCreate = false,
  disabled,
  className,
}: ClientComboboxProps) {
  const [optionCache, setOptionCache] = useState<Record<string, ClientOption>>({});
  const [detailsClientId, setDetailsClientId] = useState<string | null>(null);

  const search = useCallback(async (q: string): Promise<AsyncOption[]> => {
    const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    let rows: ClientOption[] = await res.json();
    if (kind) rows = rows.filter((r) => r.client_kind === kind);
    setOptionCache((prev) => ({ ...prev, ...Object.fromEntries(rows.map((r) => [r.id, r])) }));
    return rows.map((r) => ({ id: r.id, label: r.full_name, description: describe(r) }));
  }, [kind]);

  const handleCreate = useCallback(async (label: string): Promise<AsyncOption | null> => {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: label, client_kind: kind || 'individual' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || 'Failed to create client');
      return null;
    }
    const created: Client = await res.json();
    const opt: ClientOption = {
      id: created.id,
      full_name: created.full_name,
      client_kind: created.client_kind || 'individual',
    };
    setOptionCache((prev) => ({ ...prev, [created.id]: opt }));
    if (promptDetailsOnCreate) setDetailsClientId(created.id);
    return { id: created.id, label: created.full_name, description: describe(opt) };
  }, [kind, promptDetailsOnCreate]);

  return (
    <>
      <AsyncCombobox
        value={value ? { id: value.id, label: value.label } : null}
        onSelect={(opt) => {
          if (!opt) return onChange(null);
          const cached = optionCache[String(opt.id)];
          onChange(cached || { id: String(opt.id), full_name: opt.label, client_kind: 'individual' });
        }}
        search={search}
        onCreate={handleCreate}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {detailsClientId && (
        <ClientQuickEditDialog
          clientId={detailsClientId}
          open
          onOpenChange={(open) => { if (!open) setDetailsClientId(null); }}
          onSaved={(c) => {
            const opt: ClientOption = {
              id: c.id, full_name: c.full_name, client_kind: c.client_kind || 'individual',
              phone: c.phone, email: c.email, gstin: c.gstin,
            };
            setOptionCache((prev) => ({ ...prev, [c.id]: opt }));
            onChange(opt);
          }}
        />
      )}
    </>
  );
}

interface QuickEditProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (client: Client) => void;
}

/** Compact kind + contact + GST editor used inline after create and from client pages. */
export function ClientQuickEditDialog({ clientId, open, onOpenChange, onSaved }: QuickEditProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [clientKind, setClientKind] = useState<'individual' | 'business'>('individual');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [legalName, setLegalName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [pan, setPan] = useState('');
  const [contact, setContact] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const c: Client = await res.json();
        setFullName(c.full_name || '');
        setClientKind(c.client_kind || 'individual');
        setPhone(c.phone || '');
        setEmail(c.email || '');
        setGstin(c.gstin || '');
        setLegalName(c.gst_legal_name || '');
        setBillingAddress(c.billing_address || '');
        setPan(c.pan_number || '');
        if (c.contact_client_id) {
          const contactRes = await fetch(`/api/clients/${c.contact_client_id}`);
          if (contactRes.ok) {
            const cc: Client = await contactRes.json();
            setContact({ id: cc.id, label: cc.full_name });
          }
        } else {
          setContact(null);
        }
      }
      setLoading(false);
    })();
  }, [clientId, open]);

  const gstinValue = normalizeGstin(gstin);
  const gstinProblem = gstinValue ? gstinError(gstinValue) : null;
  const gstinState = gstinValue && !gstinProblem ? GST_STATE_CODES[gstinStateCode(gstinValue) || ''] : null;
  const isBusiness = clientKind === 'business';

  async function save() {
    if (isBusiness && gstinValue && gstinProblem) {
      toast.error(gstinProblem);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          client_kind: clientKind,
          phone,
          email,
          gstin: isBusiness ? gstinValue : '',
          gst_legal_name: isBusiness ? legalName : '',
          billing_address: billingAddress,
          pan_number: pan,
          contact_client_id: isBusiness ? contact?.id || null : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      const updated: Client = await res.json();
      toast.success('Client updated');
      onSaved?.(updated);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Client details</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button" size="sm" variant={isBusiness ? 'outline' : 'default'}
                onClick={() => setClientKind('individual')}
              >
                <User className="h-3.5 w-3.5 mr-1" /> Individual
              </Button>
              <Button
                type="button" size="sm" variant={isBusiness ? 'default' : 'outline'}
                onClick={() => setClientKind('business')}
              >
                <Building2 className="h-3.5 w-3.5 mr-1" /> Business
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-full">
                <Label>{isBusiness ? 'Business name' : 'Full name'}</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {isBusiness && (
                <>
                  <div className="space-y-1.5 col-span-full">
                    <Label>GSTIN</Label>
                    <Input
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="27AAPFU0939F1ZV"
                      className={gstinValue && gstinProblem ? 'border-red-400' : ''}
                    />
                    {gstinValue && gstinProblem && <p className="text-xs text-red-600">{gstinProblem}</p>}
                    {gstinState && (
                      <p className="text-xs text-green-700">
                        Valid · {gstinState} <Badge variant="outline" className="ml-1 text-xs">B2B GST invoices enabled</Badge>
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5 col-span-full">
                    <Label>Legal name (as per GST)</Label>
                    <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 col-span-full">
                    <Label>Contact person</Label>
                    <ClientCombobox
                      value={contact}
                      onChange={(c) => setContact(c ? { id: c.id, label: c.full_name } : null)}
                      kind="individual"
                      placeholder="Link the person behind this business…"
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>PAN</Label>
                <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="AAPFU0939F" />
              </div>
              <div className="space-y-1.5 col-span-full">
                <Label>Billing address</Label>
                <Textarea rows={2} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
