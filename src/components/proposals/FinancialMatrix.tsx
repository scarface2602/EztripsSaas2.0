'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Sparkles, ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';
import { type ProposalItem } from '@/lib/schemas/proposals';
import { calculateLineItemSP, formatCurrency } from '@/lib/utils/pricing';

const ITEM_TYPES = ['hotel', 'flight', 'activity', 'transfer', 'visa', 'insurance', 'other'] as const;

type MatrixItem = ProposalItem & { _key: string };

function newItem(): MatrixItem {
  return {
    _key: crypto.randomUUID(),
    type: 'hotel',
    service_name: '',
    cost_price: 0,
    markup_amount: 0,
    tax_amount: 0,
    selling_price: 0,
    ops_status: 'pending',
    currency: 'INR',
  };
}

export function FinancialMatrix({
  initialItems = [],
  currency = 'INR',
  onChange,
}: {
  initialItems?: ProposalItem[];
  currency?: string;
  onChange?: (items: ProposalItem[]) => void;
}) {
  const [items, setItems] = useState<MatrixItem[]>(() =>
    initialItems.length > 0
      ? initialItems.map(it => ({ ...it, _key: it.id || crypto.randomUUID() }))
      : [newItem()]
  );
  const [isDmcMode, setIsDmcMode] = useState(false);
  const [dmcCost, setDmcCost] = useState(0);
  const [dmcMarkup, setDmcMarkup] = useState(0);
  const [dropText, setDropText] = useState('');
  const [parsing, setParsing] = useState(false);

  const emitChange = useCallback((updated: MatrixItem[]) => {
    if (onChange) {
      // Strip internal _key before emitting
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onChange(updated.map(({ _key: _, ...rest }) => rest));
    }
  }, [onChange]);

  const updateItem = useCallback((key: string, patch: Partial<MatrixItem>) => {
    setItems(prev => {
      const updated = prev.map(it => {
        if (it._key !== key) return it;
        const merged = { ...it, ...patch };
        // Auto-calculate selling price when cost or markup changes
        if ('cost_price' in patch || 'markup_amount' in patch) {
          merged.selling_price = calculateLineItemSP(merged.cost_price, merged.markup_amount) + merged.tax_amount;
        }
        if ('tax_amount' in patch) {
          merged.selling_price = calculateLineItemSP(merged.cost_price, merged.markup_amount) + merged.tax_amount;
        }
        return merged;
      });
      emitChange(updated);
      return updated;
    });
  }, [emitChange]);

  const addRow = () => {
    setItems(prev => {
      const updated = [...prev, newItem()];
      emitChange(updated);
      return updated;
    });
  };

  const removeRow = (key: string) => {
    setItems(prev => {
      const updated = prev.filter(it => it._key !== key);
      emitChange(updated);
      return updated;
    });
  };

  // Aggregates
  const totals = useMemo(() => {
    if (isDmcMode) {
      const sp = calculateLineItemSP(dmcCost, dmcMarkup);
      return { grossCost: dmcCost, profit: dmcMarkup, clientTotal: sp };
    }
    const grossCost = items.reduce((s, it) => s + it.cost_price, 0);
    const profit = items.reduce((s, it) => s + it.markup_amount, 0);
    const tax = items.reduce((s, it) => s + it.tax_amount, 0);
    const clientTotal = items.reduce((s, it) => s + it.selling_price, 0);
    return { grossCost, profit, tax, clientTotal };
  }, [items, isDmcMode, dmcCost, dmcMarkup]);

  // AI parse handler
  const handleParse = async () => {
    if (!dropText.trim()) return;
    setParsing(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: dropText }),
      });
      if (!res.ok) throw new Error('Parse failed');
      const { items: parsed } = await res.json();
      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast.error('No items parsed from text');
        return;
      }
      const newItems: MatrixItem[] = parsed.map((p: Record<string, unknown>) => ({
        _key: crypto.randomUUID(),
        type: (ITEM_TYPES.includes(p.type as typeof ITEM_TYPES[number]) ? p.type : 'other') as ProposalItem['type'],
        service_name: String(p.service_name || p.description || ''),
        cost_price: Number(p.cost_price || p.cp || 0),
        markup_amount: Number(p.markup_amount || p.markup || 0),
        tax_amount: Number(p.tax_amount || p.tax || 0),
        selling_price: calculateLineItemSP(
          Number(p.cost_price || p.cp || 0),
          Number(p.markup_amount || p.markup || 0)
        ) + Number(p.tax_amount || p.tax || 0),
        ops_status: 'pending' as const,
        currency,
      }));
      setItems(newItems);
      emitChange(newItems);
      setDropText('');
      toast.success(`${newItems.length} items parsed`);
    } catch {
      toast.error('Failed to parse text');
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Drop Zone */}
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Sparkles className="h-3 w-3" /> Paste quote text to auto-populate rows
              </Label>
              <textarea
                className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                placeholder="Paste supplier quote, DMC costing, or itinerary text here..."
                value={dropText}
                onChange={e => setDropText(e.target.value)}
                onPaste={e => {
                  const text = e.clipboardData.getData('text');
                  if (text) setDropText(text);
                }}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-5 gap-1"
              onClick={handleParse}
              disabled={parsing || !dropText.trim()}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              {parsing ? 'Parsing...' : 'Parse'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mode toggle + aggregate bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">DMC Quote (Lump Sum)</Label>
          <Switch checked={isDmcMode} onCheckedChange={setIsDmcMode} />
          <Label className="text-sm text-muted-foreground">
            {isDmcMode ? 'Lump Sum' : 'Itemized FIT'}
          </Label>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Gross Cost</span>
            <span className="ml-1 font-semibold">{formatCurrency(totals.grossCost, currency)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="text-muted-foreground">Profit</span>
            <span className="ml-1 font-semibold text-green-600">{formatCurrency(totals.profit, currency)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="text-muted-foreground">Client Total</span>
            <span className="ml-1 font-bold">{formatCurrency(totals.clientTotal, currency)}</span>
          </div>
        </div>
      </div>

      {/* DMC lump sum box */}
      {isDmcMode && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">Package Cost (Lump Sum)</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Net Cost (CP)</Label>
                <Input
                  type="number"
                  min={0}
                  value={dmcCost || ''}
                  onChange={e => setDmcCost(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Markup</Label>
                <Input
                  type="number"
                  min={0}
                  value={dmcMarkup || ''}
                  onChange={e => setDmcMarkup(Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Selling Price</Label>
                <Input
                  type="number"
                  readOnly
                  value={calculateLineItemSP(dmcCost, dmcMarkup)}
                  className="bg-muted"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Itemized grid */}
      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Category</TableHead>
                <TableHead className="min-w-[200px]">Service Description</TableHead>
                <TableHead className="w-[110px]">Net Cost (CP)</TableHead>
                <TableHead className="w-[100px]">Markup</TableHead>
                <TableHead className="w-[100px]">Tax</TableHead>
                <TableHead className="w-[120px]">Sales Price</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item._key}>
                  <TableCell>
                    <Select
                      value={item.type}
                      onValueChange={v => updateItem(item._key, { type: v as ProposalItem['type'] })}
                      disabled={isDmcMode}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map(t => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.service_name}
                      onChange={e => updateItem(item._key, { service_name: e.target.value })}
                      placeholder="e.g. Taj Exotica — 3N Deluxe"
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={item.cost_price || ''}
                      onChange={e => updateItem(item._key, { cost_price: Number(e.target.value) || 0 })}
                      placeholder="0"
                      className="h-8 text-sm"
                      readOnly={isDmcMode}
                      tabIndex={isDmcMode ? -1 : undefined}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={item.markup_amount || ''}
                      onChange={e => updateItem(item._key, { markup_amount: Number(e.target.value) || 0 })}
                      placeholder="0"
                      className="h-8 text-sm"
                      readOnly={isDmcMode}
                      tabIndex={isDmcMode ? -1 : undefined}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={item.tax_amount || ''}
                      onChange={e => updateItem(item._key, { tax_amount: Number(e.target.value) || 0 })}
                      placeholder="0"
                      className="h-8 text-sm"
                      readOnly={isDmcMode}
                      tabIndex={isDmcMode ? -1 : undefined}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      readOnly
                      value={item.selling_price}
                      className="h-8 text-sm bg-muted font-medium"
                      tabIndex={-1}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(item._key)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" /> Add Item
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
