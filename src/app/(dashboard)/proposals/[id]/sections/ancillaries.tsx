'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LineItem, Supplier } from '@/lib/types/database';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

type PricingUnit = 'total' | 'per_adult' | 'per_child';

interface LandServicesSectionProps {
  proposalId: string;
  lineItems: LineItem[];
  setLineItems: (items: LineItem[]) => void;
  suppliers: Supplier[];
  paxAdults: number;
  paxChildren: number;
}

export function AncillariesSection({ proposalId, lineItems, setLineItems, suppliers, paxAdults, paxChildren }: LandServicesSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [pricingUnits, setPricingUnits] = useState<Record<string, PricingUnit>>({});
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [pdfPricingFormat, setPdfPricingFormat] = useState<'total' | 'per_person'>('total');

  // ── Debounced auto-save per service on blur ────────────────
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const lineItemsRef = useRef(lineItems);
  lineItemsRef.current = lineItems;

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, []);

  function scheduleServiceSave(itemId: string) {
    if (saveTimers.current[itemId]) clearTimeout(saveTimers.current[itemId]);
    saveTimers.current[itemId] = setTimeout(async () => {
      const item = lineItemsRef.current.find(li => li.id === itemId);
      if (!item) return;
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
    }, 1500);
  }

  const services = lineItems.filter(li => li.type === 'ancillary');

  function getQty(itemId: string): number {
    if (qtyOverrides[itemId] !== undefined) return qtyOverrides[itemId];
    const unit = pricingUnits[itemId] || 'total';
    if (unit === 'per_adult') return paxAdults;
    if (unit === 'per_child') return paxChildren;
    return 1;
  }

  function handleUnitChange(itemId: string, unit: PricingUnit) {
    setPricingUnits(prev => ({ ...prev, [itemId]: unit }));
    setQtyOverrides(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  async function addService() {
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
    }
  }

  function updateService(id: string, updates: Partial<LineItem>) {
    setLineItems(lineItems.map(li => li.id === id ? { ...li, ...updates } : li));
  }

  async function deleteService(id: string) {
    await supabase.from('line_items').delete().eq('id', id);
    setLineItems(lineItems.filter(li => li.id !== id));
  }

  return (
    <div className="space-y-3">
      {/* PDF Pricing Format Toggle */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground font-medium">Client PDF Pricing Format:</label>
        <select
          className="h-8 rounded-md border px-2 text-xs"
          value={pdfPricingFormat}
          onChange={(e) => setPdfPricingFormat(e.target.value as 'total' | 'per_person')}
        >
          <option value="total">Show Total Package Price</option>
          <option value="per_person">Show Price Per Person</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
              <th className="py-2 px-2 min-w-[200px]">What&apos;s included?</th>
              <th className="py-2 px-2 min-w-[120px]">Supplier</th>
              <th className="py-2 px-2 w-[120px]">Cost</th>
              <th className="py-2 px-2 w-[110px]">Pricing Unit</th>
              <th className="py-2 px-2 w-[70px]">Qty</th>
              <th className="py-2 px-2 w-[90px]">Row Total</th>
              <th className="py-2 px-2 w-[50px]"></th>
            </tr>
          </thead>
          <tbody>
            {services.map((item) => {
              const unit = pricingUnits[item.id] || 'total';
              const qty = getQty(item.id);
              const rowTotal = qty * (Number(item.cp) || 0);
              const blurSave = () => scheduleServiceSave(item.id);

              return (
                <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-2">
                    <Input
                      value={item.description}
                      onChange={(e) => updateService(item.id, { description: e.target.value })}
                      onBlur={blurSave}
                      placeholder="e.g., DMC Package, Visa Fee, Travel Insurance"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <select
                      className="w-full h-8 rounded-md border px-2 text-xs"
                      value={item.supplier_id || ''}
                      onChange={(e) => { updateService(item.id, { supplier_id: e.target.value || null }); blurSave(); }}
                    >
                      <option value="">Select...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.cp ?? ''}
                      onChange={(e) => updateService(item.id, { cp: e.target.value ? Number(e.target.value) : 0 })}
                      onBlur={blurSave}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <select
                      className="w-full h-8 rounded-md border px-2 text-xs"
                      value={unit}
                      onChange={(e) => handleUnitChange(item.id, e.target.value as PricingUnit)}
                    >
                      <option value="total">Total</option>
                      <option value="per_adult">Per Adult</option>
                      <option value="per_child">Per Child</option>
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <Input
                      type="number"
                      min={1}
                      value={qtyOverrides[item.id] !== undefined ? qtyOverrides[item.id] : qty}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : 1;
                        setQtyOverrides(prev => ({ ...prev, [item.id]: val }));
                      }}
                      className="h-8 text-sm text-center"
                      disabled={unit === 'total'}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <div className="text-sm font-medium text-right">
                      {rowTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteService(item.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {services.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No land services added yet</p>
        )}
      </div>

      <Button size="sm" variant="outline" onClick={addService}>
        <Plus className="h-4 w-4 mr-1" /> Add Service
      </Button>
    </div>
  );
}
