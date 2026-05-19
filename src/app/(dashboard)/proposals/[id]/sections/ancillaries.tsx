'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LineItem, Supplier } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Save, Loader2, Check } from 'lucide-react';

interface AncillariesSectionProps {
  proposalId: string;
  lineItems: LineItem[];
  setLineItems: (items: LineItem[]) => void;
  suppliers: Supplier[];
  setHasUnsavedChanges: (v: boolean) => void;
}

export function AncillariesSection({ proposalId, lineItems, setLineItems, suppliers, setHasUnsavedChanges }: AncillariesSectionProps) {
  const supabase = createClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const ancillaries = lineItems.filter(li => li.type === 'ancillary');

  async function addAncillary() {
    const { data } = await supabase.from('line_items').insert({
      proposal_id: proposalId,
      type: 'ancillary',
      description: '',
      cp: 0,
      sp: 0,
      per_person: false,
      include_in_total: true,
      show_in_pdf: true,
      is_addon: false,
      is_included: true,
      sort_order: lineItems.length,
    }).select().single();
    if (data) {
      setLineItems([...lineItems, data as LineItem]);
      setHasUnsavedChanges(true);
    }
  }

  function updateAncillary(id: string, updates: Partial<LineItem>) {
    setLineItems(lineItems.map(li => li.id === id ? { ...li, ...updates } : li));
    setHasUnsavedChanges(true);
  }

  async function deleteAncillary(id: string) {
    await supabase.from('line_items').delete().eq('id', id);
    setLineItems(lineItems.filter(li => li.id !== id));
    setHasUnsavedChanges(true);
  }

  async function saveAncillary(item: LineItem) {
    setSavingId(item.id);
    setSavedId(null);
    await supabase.from('line_items').update({
      description: item.description,
      supplier_id: item.supplier_id,
      cp: item.cp,
      sp: item.sp,
      per_person: item.per_person,
      include_in_total: item.include_in_total,
      show_in_pdf: item.show_in_pdf,
      is_addon: item.is_addon,
    }).eq('id', item.id);
    setSavingId(null);
    setSavedId(item.id);
    setTimeout(() => setSavedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ancillaries ({ancillaries.length})</h2>
        <Button size="sm" onClick={addAncillary}><Plus className="h-4 w-4 mr-1" /> Add Ancillary</Button>
      </div>

      {ancillaries.map((item) => (
        <Card key={item.id}>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Input
                  value={item.description}
                  onChange={(e) => updateAncillary(item.id, { description: e.target.value })}
                  placeholder="e.g., Travel Insurance, Visa Fee, Airport Lounge"
                />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={item.supplier_id || ''}
                  onChange={(e) => updateAncillary(item.id, { supplier_id: e.target.value || null })}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-muted/50 rounded-md">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">CP (internal)</Label>
                <Input type="number" step="0.01" value={item.cp ?? ''} onChange={(e) => updateAncillary(item.id, { cp: e.target.value ? Number(e.target.value) : 0 })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">SP (client)</Label>
                <Input type="number" step="0.01" value={item.sp ?? ''} onChange={(e) => updateAncillary(item.id, { sp: e.target.value ? Number(e.target.value) : 0 })} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={item.per_person} onCheckedChange={(v) => updateAncillary(item.id, { per_person: v })} />
                <Label>Per Person</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={item.include_in_total} onCheckedChange={(v) => updateAncillary(item.id, { include_in_total: v })} />
                <Label>Include in Total</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={item.show_in_pdf} onCheckedChange={(v) => updateAncillary(item.id, { show_in_pdf: v })} />
                <Label>Show in PDF</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={item.is_addon} onCheckedChange={(v) => updateAncillary(item.id, { is_addon: v })} />
                <Label>Add-on</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => saveAncillary(item)} disabled={savingId === item.id}>
                {savingId === item.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : savedId === item.id ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Save className="h-4 w-4 mr-1" />}
                {savedId === item.id ? 'Saved' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteAncillary(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {ancillaries.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No ancillaries added yet. Add items like travel insurance, visa fees, airport lounge access, etc.</CardContent></Card>
      )}
    </div>
  );
}
