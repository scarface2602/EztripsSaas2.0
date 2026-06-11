'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AsyncCombobox, type AsyncOption } from '@/components/ui/async-combobox';
import { createClient } from '@/lib/supabase/client';
import { Trash2, Plus, IndianRupee } from 'lucide-react';
import type { BuilderData, PriceGroupRow } from '../types';
import { computeSell, rollupTotals } from '../types';

interface StepProps {
  data: BuilderData;
  update: (patch: Partial<BuilderData> | ((d: BuilderData) => BuilderData)) => void;
}

// Price groups: each row is one price tag. A DMC lump-sum quote is one
// group covering many items; anything not covered is priced on its own
// row in the "Individually priced" list below.
export function PricingStep({ data, update }: StepProps) {
  const totals = useMemo(() => rollupTotals(data), [data]);
  const cur = data.proposal.currency;

  const patchGroup = (id: string, patch: Partial<PriceGroupRow>) =>
    update((d) => ({
      ...d,
      groups: d.groups.map((g) => {
        if (g.id !== id) return g;
        const next = { ...g, ...patch };
        next.sell_amount = computeSell(next.cost_amount, next.markup_type, next.markup_value);
        return next;
      }),
    }));

  const addGroup = () =>
    update((d) => ({
      ...d,
      groups: [
        ...d.groups,
        {
          id: crypto.randomUUID(),
          name: d.groups.length === 0 ? 'Land package' : `Package ${d.groups.length + 1}`,
          supplier_id: null,
          supplier_name: null,
          cost_amount: 0,
          markup_type: 'percent',
          markup_value: 15,
          sell_amount: 0,
          sort_order: d.groups.length,
        },
      ],
    }));

  const removeGroup = (id: string) =>
    update((d) => ({
      ...d,
      groups: d.groups.filter((g) => g.id !== id),
      items: d.items.map((i) => (i.price_group_id === id ? { ...i, price_group_id: null } : i)),
    }));

  const setProposal = (patch: Partial<BuilderData['proposal']>) =>
    update((d) => ({ ...d, proposal: { ...d.proposal, ...patch } }));

  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Price groups</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              One row per supplier quote. Got one DMC price for the whole land part? That&apos;s one row.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addGroup}>
            <Plus className="h-4 w-4 mr-1" /> Add group
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.groups.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No price groups yet. Add one for your DMC/package quote, or price items individually below.
            </p>
          )}
          {data.groups.map((g) => (
            <GroupRow key={g.id} group={g} data={data} cur={cur} patchGroup={patchGroup} removeGroup={removeGroup} update={update} />
          ))}
        </CardContent>
      </Card>

      <SelfPricedItems data={data} update={update} cur={cur} />

      <Card>
        <CardHeader><CardTitle>Taxes &amp; total</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={data.proposal.gst_enabled} onCheckedChange={(v) => setProposal({ gst_enabled: v })} />
              <Label>GST</Label>
              <Input
                type="number" className="w-20 h-8" min={0} max={100} step="0.1"
                value={data.proposal.gst_rate}
                onChange={(e) => setProposal({ gst_rate: parseFloat(e.target.value) || 0 })}
                disabled={!data.proposal.gst_enabled}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={data.proposal.tcs_enabled} onCheckedChange={(v) => setProposal({ tcs_enabled: v })} />
              <Label>TCS</Label>
              <Input
                type="number" className="w-20 h-8" min={0} max={100} step="0.1"
                value={data.proposal.tcs_rate}
                onChange={(e) => setProposal({ tcs_rate: parseFloat(e.target.value) || 0 })}
                disabled={!data.proposal.tcs_enabled}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="border-t pt-3 grid gap-1 text-sm max-w-sm ml-auto">
            <Row label="Subtotal" value={`${cur} ${fmt(totals.sell)}`} />
            {data.proposal.gst_enabled && <Row label={`GST ${data.proposal.gst_rate}%`} value={`${cur} ${fmt(totals.gst)}`} />}
            {data.proposal.tcs_enabled && <Row label={`TCS ${data.proposal.tcs_rate}%`} value={`${cur} ${fmt(totals.tcs)}`} />}
            <Row label="Grand total" value={`${cur} ${fmt(totals.grand)}`} bold />
            {totals.perPerson != null && <Row label="Per person" value={`${cur} ${fmt(totals.perPerson)}`} />}
            <Row
              label="Your margin"
              value={`${cur} ${fmt(totals.margin)}`}
              className={totals.margin >= 0 ? 'text-green-600' : 'text-red-600'}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-base' : ''} ${className ?? ''}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function GroupRow({
  group: g,
  data,
  cur,
  patchGroup,
  removeGroup,
  update,
}: {
  group: PriceGroupRow;
  data: BuilderData;
  cur: string;
  patchGroup: (id: string, patch: Partial<PriceGroupRow>) => void;
  removeGroup: (id: string) => void;
  update: StepProps['update'];
}) {
  const [supplier, setSupplier] = useState<AsyncOption | null>(
    g.supplier_id ? { id: g.supplier_id, label: g.supplier_name ?? 'Supplier' } : null,
  );
  const covered = data.items.filter((i) => i.price_group_id === g.id);
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-12">
        <div className="space-y-1 sm:col-span-4">
          <Label className="text-xs">Group name</Label>
          <Input value={g.name} onChange={(e) => patchGroup(g.id, { name: e.target.value })} />
        </div>
        <div className="space-y-1 sm:col-span-4">
          <Label className="text-xs">Supplier</Label>
          <AsyncCombobox
            value={supplier}
            onSelect={(opt) => {
              setSupplier(opt);
              patchGroup(g.id, {
                supplier_id: opt ? String(opt.id) : null,
                supplier_name: opt?.label ?? null,
              });
            }}
            search={async (q) => {
              const supabase = createClient();
              const { data: rows } = await supabase
                .from('suppliers')
                .select('id, name, type')
                .ilike('name', `%${q}%`)
                .limit(8);
              return (rows ?? []).map((s) => ({ id: s.id, label: s.name, description: s.type ?? undefined }));
            }}
            onCreate={async (name) => {
              const res = await fetch('/api/suppliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type: 'DMC' }),
              });
              if (!res.ok) return null;
              const s = await res.json();
              return { id: s.id ?? s.data?.id, label: name };
            }}
            placeholder="Search or add supplier…"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Cost ({cur})</Label>
          <Input
            type="number" min={0}
            value={g.cost_amount || ''}
            onChange={(e) => patchGroup(g.id, { cost_amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Markup</Label>
          <div className="flex gap-1">
            <Input
              type="number" min={0} className="flex-1"
              value={g.markup_value || ''}
              onChange={(e) => patchGroup(g.id, { markup_value: parseFloat(e.target.value) || 0 })}
            />
            <Select value={g.markup_type} onValueChange={(v) => patchGroup(g.id, { markup_type: (v ?? 'percent') as 'percent' | 'flat' })}>
              <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">%</SelectItem>
                <SelectItem value="flat">{cur}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <ItemCoverage group={g} data={data} update={update} covered={covered} />
        <div className="flex items-center gap-3">
          <span className="text-sm">
            Sells at <span className="font-semibold">{cur} {fmt(g.sell_amount)}</span>
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeGroup(g.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ItemCoverage({
  group,
  data,
  update,
  covered,
}: {
  group: PriceGroupRow;
  data: BuilderData;
  update: StepProps['update'];
  covered: BuilderData['items'];
}) {
  const uncovered = data.items.filter((i) => !i.price_group_id && i.title.trim());
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">Covers:</span>
      {covered.length === 0 && <span className="text-muted-foreground italic">nothing yet</span>}
      {covered.map((i) => (
        <button
          key={i.id}
          className="px-2 py-0.5 rounded-full bg-muted hover:bg-destructive/10"
          title="Click to remove from this group"
          onClick={() =>
            update((d) => ({
              ...d,
              items: d.items.map((x) => (x.id === i.id ? { ...x, price_group_id: null } : x)),
            }))
          }
        >
          {i.title} ✕
        </button>
      ))}
      {uncovered.length > 0 && (
        <Select
          value=""
          onValueChange={(itemId) => {
            if (!itemId) return;
            update((d) => ({
              ...d,
              items: d.items.map((x) =>
                x.id === itemId ? { ...x, price_group_id: group.id, cost_amount: null, sell_amount: null } : x,
              ),
            }));
          }}
        >
          <SelectTrigger className="h-6 w-28 text-xs border-dashed"><SelectValue placeholder="+ add item" /></SelectTrigger>
          <SelectContent>
            {uncovered.map((i) => (
              <SelectItem key={i.id} value={i.id}>{i.title} ({i.item_type})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function SelfPricedItems({ data, update, cur }: StepProps & { cur: string }) {
  const selfItems = data.items.filter((i) => !i.price_group_id && i.title.trim());
  if (selfItems.length === 0) return null;
  const fmt = (n: number | null) => (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IndianRupee className="h-4 w-4" /> Individually priced items
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Items not covered by a group. Leave cost &amp; sell empty for informational items (e.g. hotels inside a DMC package — better: add them to the group).
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {selfItems.map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">
              {i.title} <span className="text-xs text-muted-foreground">({i.item_type})</span>
            </span>
            <Input
              type="number" min={0} className="w-28 h-8" placeholder={`Cost ${cur}`}
              value={i.cost_amount ?? ''}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  items: d.items.map((x) =>
                    x.id === i.id ? { ...x, cost_amount: e.target.value === '' ? null : parseFloat(e.target.value) || 0 } : x,
                  ),
                }))
              }
            />
            <Input
              type="number" min={0} className="w-28 h-8" placeholder={`Sell ${cur}`}
              value={i.sell_amount ?? ''}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  items: d.items.map((x) =>
                    x.id === i.id ? { ...x, sell_amount: e.target.value === '' ? null : parseFloat(e.target.value) || 0 } : x,
                  ),
                }))
              }
            />
            {i.cost_amount != null && i.sell_amount != null && (
              <span className={`text-xs w-20 text-right ${i.sell_amount >= i.cost_amount ? 'text-green-600' : 'text-red-600'}`}>
                +{fmt(i.sell_amount - i.cost_amount)}
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
