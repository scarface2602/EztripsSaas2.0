'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Tag, Loader2, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DiscountCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  usage_mode: 'single' | 'per_customer' | 'n_per_customer' | 'unlimited';
  max_uses: number | null;
  max_uses_per_customer: number | null;
  used_count: number;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
}

const USAGE_MODE_LABELS: Record<string, string> = {
  single: 'One-time (global)',
  per_customer: 'Once per customer',
  n_per_customer: 'N per customer',
  unlimited: 'Unlimited',
};

interface CodeForm {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  usage_mode: 'single' | 'per_customer' | 'n_per_customer' | 'unlimited';
  max_uses: string;
  max_uses_per_customer: string;
  valid_from: string;
  valid_to: string;
}

const EMPTY_FORM: CodeForm = {
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  usage_mode: 'unlimited',
  max_uses: '',
  max_uses_per_customer: '',
  valid_from: '',
  valid_to: '',
};

export function DiscountCodesSection() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/discount-codes');
      if (res.ok) setCodes(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleCreate = async () => {
    if (!form.code.trim() || !form.discount_value) {
      toast.error('Code and value are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim(),
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          usage_mode: form.usage_mode,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          max_uses_per_customer: form.max_uses_per_customer ? Number(form.max_uses_per_customer) : null,
          valid_from: form.valid_from || null,
          valid_to: form.valid_to || null,
        }),
      });
      if (res.ok) {
        toast.success('Discount code created');
        setShowDialog(false);
        setForm(EMPTY_FORM);
        fetchCodes();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create');
      }
    } catch {
      toast.error('Failed to create code');
    }
    setSaving(false);
  };

  const toggleActive = async (code: DiscountCode) => {
    const res = await fetch('/api/discount-codes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: code.id, is_active: !code.is_active }),
    });
    if (res.ok) {
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, is_active: !c.is_active } : c));
      toast.success(code.is_active ? 'Code deactivated' : 'Code activated');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Discount Codes</CardTitle>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Code
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No discount codes yet. Create one to get started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage Mode</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map(c => {
                const now = new Date().toISOString().split('T')[0];
                const isExpired = c.valid_to && now > c.valid_to;
                const isExhausted = c.usage_mode === 'single' && c.used_count >= 1
                  || (c.max_uses && c.used_count >= c.max_uses);

                return (
                  <TableRow key={c.id} className={!c.is_active || isExpired ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold text-sm">{c.code}</code>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyCode(c.code)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {c.discount_type === 'percentage' ? `${c.discount_value}%` : `₹${c.discount_value.toLocaleString('en-IN')}`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{USAGE_MODE_LABELS[c.usage_mode]}</span>
                      {c.usage_mode === 'n_per_customer' && c.max_uses_per_customer && (
                        <span className="text-xs text-muted-foreground ml-1">({c.max_uses_per_customer}x)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{c.used_count}</span>
                      {c.max_uses && <span className="text-xs text-muted-foreground">/{c.max_uses}</span>}
                      {isExhausted && <Badge className="ml-1 text-[10px] bg-red-100 text-red-700">Exhausted</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.valid_from || c.valid_to ? (
                        <span className={isExpired ? 'text-red-600' : ''}>
                          {c.valid_from ? format(new Date(c.valid_from), 'dd MMM') : '—'}
                          {' → '}
                          {c.valid_to ? format(new Date(c.valid_to), 'dd MMM yy') : '∞'}
                          {isExpired && ' (expired)'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No limit</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={async () => {
                          await fetch('/api/discount-codes', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: c.id, is_active: false }),
                          });
                          setCodes(prev => prev.filter(x => x.id !== c.id));
                          toast.success('Code removed');
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Discount Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. SUMMER20"
                className="uppercase font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v as 'percentage' | 'fixed' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.discount_type === 'percentage' ? 'Percentage' : 'Amount (₹)'}</Label>
                <Input
                  type="number"
                  value={form.discount_value}
                  onChange={e => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 5000'}
                />
              </div>
            </div>

            <div>
              <Label>Usage Mode</Label>
              <Select value={form.usage_mode} onValueChange={v => setForm({ ...form, usage_mode: v as typeof form.usage_mode })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">One-time use (globally)</SelectItem>
                  <SelectItem value="per_customer">Once per customer</SelectItem>
                  <SelectItem value="n_per_customer">N times per customer</SelectItem>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.usage_mode === 'n_per_customer' && (
              <div>
                <Label>Max uses per customer</Label>
                <Input
                  type="number"
                  value={form.max_uses_per_customer}
                  onChange={e => setForm({ ...form, max_uses_per_customer: e.target.value })}
                  placeholder="e.g. 3"
                />
              </div>
            )}

            <div>
              <Label>Global max uses (optional)</Label>
              <Input
                type="number"
                value={form.max_uses}
                onChange={e => setForm({ ...form, max_uses: e.target.value })}
                placeholder="Leave empty for no limit"
              />
              <p className="text-xs text-muted-foreground mt-1">Total number of times this code can be used across all customers</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={e => setForm({ ...form, valid_from: e.target.value })}
                />
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={form.valid_to}
                  onChange={e => setForm({ ...form, valid_to: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.code.trim() || !form.discount_value}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
