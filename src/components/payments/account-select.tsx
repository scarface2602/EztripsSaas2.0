'use client';

import { useCallback, useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { toast } from 'sonner';

export interface PaymentAccountOption {
  id: string;
  account_name: string;
  account_type: string;
  bank_name?: string | null;
  is_active?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  bank: 'Bank', upi: 'UPI', cash: 'Cash', card: 'Card',
  payment_gateway: 'Gateway', wallet: 'Wallet',
};

const ADD_VALUE = '__add__';

interface AccountSelectProps {
  value: string | null;
  onChange: (account: PaymentAccountOption | null) => void;
  className?: string;
}

/**
 * Org-wide payment account picker with inline add — "Cash — Nishan"
 * gets created the first time it's needed, right in the flow.
 */
export function AccountSelect({ value, onChange, className }: AccountSelectProps) {
  const [accounts, setAccounts] = useState<PaymentAccountOption[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('bank');
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/settings/payment-accounts?scope=org');
    if (res.ok) {
      const data = await res.json();
      setAccounts((data.accounts || []).filter((a: PaymentAccountOption) => a.is_active !== false));
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  async function createAccount() {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings/payment-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_name: newName.trim(), account_type: newType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');
      const created: PaymentAccountOption = data.account || data;
      setAccounts((prev) => [...prev, created]);
      onChange(created);
      setAdding(false);
      setNewName('');
      toast.success(`Account "${created.account_name}" added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <div className="p-3 border border-blue-200 rounded-md bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">New payment account</p>
          <button type="button" onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder='e.g. "IDBI Current", "Kotak UPI", "Cash — Nishan"'
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createAccount(); } }}
          />
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={newType} onValueChange={(v) => v && setNewType(v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-8" disabled={!newName.trim() || saving} onClick={createAccount}>
            {saving ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Select
      value={value || ''}
      onValueChange={(v) => {
        if (v === ADD_VALUE) { setAdding(true); return; }
        onChange(accounts.find((a) => a.id === v) || null);
      }}
    >
      <SelectTrigger className={className}><SelectValue placeholder="Received into…" /></SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.account_name} <span className="text-muted-foreground text-xs">· {TYPE_LABELS[a.account_type] || a.account_type}</span>
          </SelectItem>
        ))}
        <SelectItem value={ADD_VALUE} className="text-primary font-medium">+ Add account…</SelectItem>
      </SelectContent>
    </Select>
  );
}
