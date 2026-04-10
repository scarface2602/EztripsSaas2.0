'use client';

import type { Proposal, Hotel, LineItem, User } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency, applyRounding } from '@/lib/utils/pricing';

interface PricingSummarySectionProps {
  proposal: Proposal;
  updateProposal: (updates: Partial<Proposal>) => void;
  hotels: Hotel[];
  lineItems: LineItem[];
  currentUser: User;
}

export function PricingSummarySection({
  proposal, updateProposal, hotels, lineItems, currentUser,
}: PricingSummarySectionProps) {
  const cur = proposal.currency;

  // ── INTERNAL: Hotel rows — only show hotels that have a rate entered ──────
  const hotelRows = hotels
    .filter(h => (h.cp_per_night && h.cp_per_night > 0) || (h.sp_per_night && h.sp_per_night > 0))
    .map(h => ({
      id: h.id,
      name: h.name,
      city: h.city,
      nights: h.nights || 0,
      cpTotal: (h.cp_per_night || 0) * (h.nights || 0),
      spTotal: (h.sp_per_night || 0) * (h.nights || 0),
    }));
  const totalHotelCP = hotelRows.reduce((s, h) => s + h.cpTotal, 0);
  const totalHotelSP = hotelRows.reduce((s, h) => s + h.spTotal, 0);

  // ── INTERNAL: Ancillaries from line_items ────────────────────────────────
  const ancillaryItems = lineItems.filter(li => li.type === 'ancillary' && li.include_in_total);
  const totalAncillariesCP = ancillaryItems.reduce((s, li) => s + li.cp, 0);
  const totalAncillariesSP = ancillaryItems.reduce((s, li) => s + li.sp, 0);

  // ── INTERNAL: Land Part (manual inputs) ──────────────────────────────────
  const landCP = proposal.land_cp || 0;
  const landSP = proposal.land_sp || 0;

  // ── INTERNAL: Totals ─────────────────────────────────────────────────────
  const totalCP = totalHotelCP + landCP + totalAncillariesCP;
  const totalSPBeforeTaxes = totalHotelSP + landSP + totalAncillariesSP;
  const grossMargin = totalSPBeforeTaxes - totalCP;
  const marginPct = totalSPBeforeTaxes > 0 ? (grossMargin / totalSPBeforeTaxes) * 100 : 0;
  const marginBelowThreshold = marginPct < (currentUser.margin_threshold_pct || 12);

  // ── CLIENT-FACING: pricing_display_mode ──────────────────────────────────
  const displayMode = proposal.pricing_display_mode || 'per_person';
  const adultSP = proposal.package_sp_per_person || 0;
  const cwbSP = proposal.package_cwb_sp || 0;

  const clientBaseSP = (() => {
    if (displayMode === 'per_person') {
      return (proposal.pax_adults * adultSP) + (proposal.pax_children * cwbSP);
    }
    return proposal.total_sp || 0;
  })();

  // Discount
  const discount = proposal.discount_amount || 0;
  const afterDiscount = clientBaseSP - discount;

  // GST on land_sp only
  const gstBase = Math.min(landSP, afterDiscount);
  const gstAmount = proposal.gst_enabled ? gstBase * ((proposal.gst_rate || 5) / 100) : 0;

  // TCS on full total after discount + GST
  const tcsBase = afterDiscount + gstAmount;
  const tcsAmount = proposal.tcs_enabled ? tcsBase * ((proposal.tcs_rate || 5) / 100) : 0;

  const grandTotalRaw = afterDiscount + gstAmount + tcsAmount;
  const grandTotal = applyRounding(grandTotalRaw, proposal.rounding_unit || currentUser.rounding_unit || 0);

  return (
    <Card>
      <CardHeader><CardTitle>Pricing Summary</CardTitle></CardHeader>
      <CardContent className="space-y-6">

        {/* ── INTERNAL SECTION ─────────────────────────────────────── */}
        <div className="p-4 bg-muted/30 rounded-md space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Internal — Agent Only (never shown to client or in PDF)
          </p>

          {/* Hotel CP rows */}
          {hotelRows.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Hotel CPs</p>
              {hotelRows.map(h => (
                <div key={h.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{h.name} ({h.nights}N)</span>
                  <span>{formatCurrency(h.cpTotal, cur)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium border-t pt-1">
                <span>Hotel CPs subtotal</span>
                <span>{formatCurrency(totalHotelCP, cur)}</span>
              </div>
            </div>
          )}

          {/* Land Part CP */}
          <div className="flex items-center gap-4">
            <Label className="text-sm w-48 shrink-0">Land Part CP (transfers, tours, guide)</Label>
            <Input
              type="number"
              step="0.01"
              className="w-40"
              value={proposal.land_cp ?? ''}
              onChange={(e) => updateProposal({ land_cp: e.target.value ? Number(e.target.value) : null })}
            />
          </div>

          {/* Ancillaries CP */}
          {ancillaryItems.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ancillaries CP (auto)</span>
              <span>{formatCurrency(totalAncillariesCP, cur)}</span>
            </div>
          )}

          {/* Total CP */}
          <div className="flex justify-between text-sm font-semibold bg-muted/50 px-2 py-1 rounded">
            <span>Total CP</span>
            <span>{formatCurrency(totalCP, cur)}</span>
          </div>

          <Separator />

          {/* Hotel SP rows */}
          {hotelRows.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Hotel SPs</p>
              {hotelRows.map(h => (
                <div key={h.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{h.name} ({h.nights}N)</span>
                  <span>{formatCurrency(h.spTotal, cur)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium border-t pt-1">
                <span>Hotel SPs subtotal</span>
                <span>{formatCurrency(totalHotelSP, cur)}</span>
              </div>
            </div>
          )}

          {/* Land Part SP */}
          <div className="flex items-center gap-4">
            <Label className="text-sm w-48 shrink-0">Land Part SP (transfers, tours, guide)</Label>
            <Input
              type="number"
              step="0.01"
              className="w-40"
              value={proposal.land_sp ?? ''}
              onChange={(e) => updateProposal({ land_sp: e.target.value ? Number(e.target.value) : null })}
            />
          </div>

          {/* Ancillaries SP */}
          {ancillaryItems.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ancillaries SP (auto)</span>
              <span>{formatCurrency(totalAncillariesSP, cur)}</span>
            </div>
          )}

          {/* Total SP before taxes */}
          <div className="flex justify-between text-sm font-semibold bg-muted/50 px-2 py-1 rounded">
            <span>Total SP before taxes</span>
            <span>{formatCurrency(totalSPBeforeTaxes, cur)}</span>
          </div>

          {/* Gross Margin */}
          <div className="flex justify-between text-sm">
            <span>Gross Margin</span>
            <span className={marginBelowThreshold ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>
              {formatCurrency(grossMargin, cur)} ({marginPct.toFixed(1)}%)
            </span>
          </div>

          {marginBelowThreshold && (
            <div className="flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Margin below threshold ({currentUser.margin_threshold_pct || 12}%)
            </div>
          )}
        </div>

        {/* ── CLIENT-FACING SECTION ────────────────────────────────── */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Client-Facing Pricing
          </p>

          {/* Display mode toggle */}
          <div className="flex items-center gap-4">
            <Label className="text-sm">Show client price as</Label>
            <div className="flex gap-3">
              {(['per_person', 'total', 'both'] as const).map(mode => (
                <label key={mode} className="flex items-center gap-1 cursor-pointer text-sm">
                  <input
                    type="radio"
                    checked={displayMode === mode}
                    onChange={() => updateProposal({ pricing_display_mode: mode })}
                  />
                  {mode === 'per_person' ? 'Per Person' : mode === 'total' ? 'Total Group' : 'Both'}
                </label>
              ))}
            </div>
          </div>

          {/* Per Person inputs */}
          {(displayMode === 'per_person' || displayMode === 'both') && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-md">
              <div className="space-y-1">
                <Label className="text-sm">Per Adult SP</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={proposal.package_sp_per_person ?? ''}
                  onChange={(e) => updateProposal({ package_sp_per_person: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              {proposal.pax_children > 0 && (
                <>
                  <div className="space-y-1">
                    <Label className="text-sm">Per Child CWB SP</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={proposal.package_cwb_sp ?? ''}
                      onChange={(e) => updateProposal({ package_cwb_sp: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Per Child CNB SP</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={proposal.package_cnb_sp ?? ''}
                      onChange={(e) => updateProposal({ package_cnb_sp: e.target.value ? Number(e.target.value) : null })}
                    />

                  </div>
                </>
              )}
              <div className="col-span-2 text-sm text-muted-foreground">
                Auto-total: {formatCurrency(
                  (proposal.pax_adults * adultSP) + (proposal.pax_children * cwbSP),
                  cur
                )}
              </div>
            </div>
          )}

          {/* Total Group input */}
          {(displayMode === 'total' || displayMode === 'both') && (
            <div className="space-y-1">
              <Label className="text-sm">Total Group SP</Label>
              <Input
                type="number"
                step="0.01"
                className="w-48"
                value={proposal.total_sp ?? ''}
                onChange={(e) => updateProposal({ total_sp: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          )}

          {/* Discount */}
          <div className="flex items-end gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Discount</Label>
              <Input
                type="number"
                step="0.01"
                className="w-40"
                value={proposal.discount_amount}
                onChange={(e) => updateProposal({ discount_amount: Number(e.target.value) })}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-sm">Discount Note</Label>
              <Input
                value={proposal.discount_note || ''}
                onChange={(e) => updateProposal({ discount_note: e.target.value })}
                placeholder="e.g., Early bird discount"
              />
            </div>
          </div>

          {/* GST */}
          <div className="p-3 border rounded-md space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={proposal.gst_enabled}
                onChange={(e) => updateProposal({ gst_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-primary"
              />
              <span className="text-sm font-medium">GST</span>
              {proposal.gst_enabled && (
                <span className="text-xs text-muted-foreground">(on land SP only)</span>
              )}
            </label>
            {proposal.gst_enabled && (
              <div className="flex items-center gap-3 pl-7">
                <Label className="text-sm">Rate:</Label>
                <Input
                  type="number"
                  className="w-20 h-8"
                  min={0} max={100} step="0.1"
                  value={proposal.gst_rate}
                  onChange={(e) => updateProposal({ gst_rate: Number(e.target.value) })}
                />
                <span className="text-sm">%</span>
                <span className="ml-auto text-sm font-medium">{formatCurrency(gstAmount, cur)}</span>
              </div>
            )}
          </div>

          {/* TCS */}
          <div className="p-3 border rounded-md space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={proposal.tcs_enabled}
                onChange={(e) => updateProposal({ tcs_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-primary"
              />
              <span className="text-sm font-medium">TCS</span>
              {proposal.tcs_enabled && (
                <span className="text-xs text-muted-foreground">(on combined total)</span>
              )}
            </label>
            {proposal.tcs_enabled && (
              <div className="flex items-center gap-3 pl-7">
                <Label className="text-sm">Rate:</Label>
                <Input
                  type="number"
                  className="w-20 h-8"
                  min={0} max={100} step="0.1"
                  value={proposal.tcs_rate ?? 5}
                  onChange={(e) => updateProposal({ tcs_rate: Number(e.target.value) })}
                />
                <span className="text-sm">%</span>
                <span className="ml-auto text-sm font-medium">{formatCurrency(tcsAmount, cur)}</span>
              </div>
            )}
          </div>

          {/* Rounding */}
          <div className="flex items-center gap-4">
            <Label className="text-sm">Rounding</Label>
            <select
              className="h-8 rounded border px-2 text-sm"
              value={proposal.rounding_unit || 0}
              onChange={(e) => updateProposal({ rounding_unit: Number(e.target.value) })}
            >
              <option value={0}>None</option>
              <option value={1}>₹1</option>
              <option value={10}>₹10</option>
              <option value={100}>₹100</option>
              <option value={500}>₹500</option>
              <option value={1000}>₹1000</option>
            </select>
          </div>

          <Separator />

          {/* Grand Total */}
          <div className="flex justify-between text-xl font-bold">
            <span>GRAND TOTAL</span>
            <span>{formatCurrency(grandTotal, cur)}</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
