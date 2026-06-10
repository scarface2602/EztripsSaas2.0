'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LineItem } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Wand2, Loader2 } from 'lucide-react';

interface InclusionsExclusionsSectionProps {
  proposalId: string;
  lineItems: LineItem[];
  setLineItems: (items: LineItem[]) => void;
}

export function InclusionsExclusionsSection({ proposalId, lineItems, setLineItems }: InclusionsExclusionsSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [loadingAI, setLoadingAI] = useState(false);

  // ── Debounced auto-save per item on blur ───────────────────
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const lineItemsRef = useRef(lineItems);
  lineItemsRef.current = lineItems;

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, []);

  function scheduleItemSave(itemId: string) {
    if (saveTimers.current[itemId]) clearTimeout(saveTimers.current[itemId]);
    saveTimers.current[itemId] = setTimeout(async () => {
      const item = lineItemsRef.current.find(li => li.id === itemId);
      if (!item) return;
      await supabase.from('line_items').update({
        description: item.description,
        is_included: item.is_included,
        cp: item.cp,
        sp: item.sp,
      }).eq('id', item.id);
    }, 1500);
  }

  const inclusions = lineItems.filter(li => li.is_included);
  const exclusions = lineItems.filter(li => !li.is_included);

  async function addItem(isIncluded: boolean, description = '') {
    const { data } = await supabase.from('line_items').insert({
      proposal_id: proposalId,
      type: 'other',
      description,
      is_included: isIncluded,
      sort_order: lineItems.length,
    }).select().single();
    if (data) {
      setLineItems([...lineItems, data as LineItem]);
      return data as LineItem;
    }
    return null;
  }

  function parsePastedBullets(text: string): string[] {
    const lines = text.split(/\r?\n/);
    const items: string[] = [];
    for (const line of lines) {
      const cleaned = line.replace(/^\s*(?:[•\-*–]|\d+[.):])\s*/, '').trim();
      if (cleaned) items.push(cleaned);
    }
    return items;
  }

  async function handlePaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    currentItem: LineItem,
    isIncluded: boolean,
  ) {
    const text = e.clipboardData.getData('text');
    const lines = text.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) return;

    e.preventDefault();
    const items = parsePastedBullets(text);
    if (items.length === 0) return;

    const updatedCurrent = { ...currentItem, description: items[0] };
    const updatedLineItems = lineItems.map(li => li.id === currentItem.id ? updatedCurrent : li);

    const toInsert = items.slice(1).map((desc, i) => ({
      proposal_id: proposalId,
      type: 'other' as const,
      description: desc,
      is_included: isIncluded,
      sort_order: lineItems.length + i,
    }));

    const { data: inserted } = await supabase
      .from('line_items')
      .insert(toInsert)
      .select();

    setLineItems([...updatedLineItems, ...((inserted as LineItem[]) || [])]);
  }

  function updateItem(id: string, updates: Partial<LineItem>) {
    setLineItems(lineItems.map(li => li.id === id ? { ...li, ...updates } : li));
  }

  async function deleteItem(id: string) {
    await supabase.from('line_items').delete().eq('id', id);
    setLineItems(lineItems.filter(li => li.id !== id));
  }

  async function aiSuggest() {
    setLoadingAI(true);
    try {
      const res = await fetch('/api/ai/content-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'inclusions_exclusions', proposal_id: proposalId }),
      });
      const data = await res.json();
      const newItems: LineItem[] = [];
      let sortBase = lineItems.length;

      if (data.inclusions) {
        for (const desc of data.inclusions) {
          const { data: item } = await supabase.from('line_items').insert({
            proposal_id: proposalId,
            type: 'other',
            description: desc,
            is_included: true,
            sort_order: sortBase++,
          }).select().single();
          if (item) newItems.push(item as LineItem);
        }
      }
      if (data.exclusions) {
        for (const desc of data.exclusions) {
          const { data: item } = await supabase.from('line_items').insert({
            proposal_id: proposalId,
            type: 'other',
            description: desc,
            is_included: false,
            sort_order: sortBase++,
          }).select().single();
          if (item) newItems.push(item as LineItem);
        }
      }
      if (newItems.length > 0) {
        setLineItems([...lineItems, ...newItems]);
      }
    } finally {
      setLoadingAI(false);
    }
  }

  function renderList(items: LineItem[], label: string, isIncluded: boolean) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{label}</h3>
          <Button size="sm" variant="outline" onClick={() => addItem(isIncluded)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
              onBlur={() => scheduleItemSave(item.id)}
              onPaste={(e) => handlePaste(e, item, isIncluded)}
              placeholder="Item description… (paste multiple lines to create multiple bullets)"
            />
            <Button size="sm" variant="ghost" onClick={() => deleteItem(item.id)}>
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No items</p>}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Inclusions & Exclusions</CardTitle>
        <Button size="sm" variant="outline" onClick={aiSuggest} disabled={loadingAI}>
          {loadingAI ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
          AI Suggest
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {renderList(inclusions, 'Included', true)}
          {renderList(exclusions, 'Excluded', false)}
        </div>
      </CardContent>
    </Card>
  );
}
