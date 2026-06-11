'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import type { BuilderData, DestinationRow, ItemRow } from './types';
import { rollupTotals, destinationDates, syncItinerarySkeleton } from './types';
import { buildWarnings } from './validation';
import { AiFillDialog } from './ai-fill-dialog';
import { TripStep } from './steps/trip-step';
import { StaysStep } from './steps/stays-step';
import { ItineraryStep } from './steps/itinerary-step';
import { ExtrasStep } from './steps/extras-step';
import { PricingStep } from './steps/pricing-step';
import { ReviewStep } from './steps/review-step';

const STEPS = [
  { key: 'trip', label: 'Trip' },
  { key: 'stays', label: 'Stays' },
  { key: 'itinerary', label: 'Itinerary' },
  { key: 'extras', label: 'Travel & Extras' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'review', label: 'Review' },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

interface BuilderV2Props {
  proposalId: string;
  initialData: BuilderData;
  proposalStatus: string;
}

export function BuilderV2({ proposalId, initialData, proposalStatus }: BuilderV2Props) {
  const [data, setData] = useState<BuilderData>(initialData);
  const [step, setStep] = useState<StepKey>('trip');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(data);
  latest.current = data;

  const readOnly = proposalStatus === 'confirmed' || proposalStatus === 'cancelled';

  const update = useCallback((patch: Partial<BuilderData> | ((d: BuilderData) => BuilderData)) => {
    setData((d) => (typeof patch === 'function' ? patch(d) : { ...d, ...patch }));
    setSaveState('dirty');
  }, []);

  const save = useCallback(async () => {
    setSaveState('saving');
    const d = latest.current;
    const res = await fetch(`/api/proposals/${proposalId}/v2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposal: d.proposal,
        destinations: d.destinations,
        groups: d.groups,
        items: d.items.map(({ ...i }) => i),
        itinerary: d.itinerary,
      }),
    });
    setSaveState(res.ok ? 'saved' : 'error');
  }, [proposalId]);

  // Debounced autosave.
  useEffect(() => {
    if (saveState !== 'dirty' || readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, saveState, save, readOnly]);

  // Cities-first invariant: every destination with nights > 0 has stay
  // items whose nights always sum to the destination's nights (split
  // stays allowed — the LAST stay absorbs the remainder) and whose dates
  // chain inside the destination's range. Mismatch is impossible.
  useEffect(() => {
    setData((d) => {
      const dates = destinationDates(d.destinations, d.proposal.travel_start);
      let changed = false;
      const items: ItemRow[] = [...d.items];

      for (const dest of d.destinations) {
        if (dest.nights <= 0) continue;
        const range = dates.get(dest.id)!;
        const existing = items
          .filter((i) => i.item_type === 'hotel' && i.destination_id === dest.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        if (existing.length === 0) {
          changed = true;
          items.push({
            id: crypto.randomUUID(),
            destination_id: dest.id,
            price_group_id: null,
            item_type: 'hotel',
            title: `Hotel in ${dest.city_name}`,
            details: {},
            hotel_directory_id: null,
            check_in: range.checkIn,
            check_out: range.checkOut,
            nights: dest.nights,
            source: 'manual',
            provider: null,
            provider_ref: null,
            cost_amount: null,
            sell_amount: null,
            sort_order: dest.sort_order * 100,
          });
        } else {
          let remaining = dest.nights;
          let cursor = range.checkIn ? new Date(range.checkIn + 'T00:00:00Z') : null;
          existing.forEach((stay, idx) => {
            const isLast = idx === existing.length - 1;
            const nights = isLast ? remaining : Math.min(Math.max(stay.nights ?? 1, 0), remaining);
            remaining -= nights;
            const checkIn = cursor ? cursor.toISOString().slice(0, 10) : null;
            if (cursor) cursor = new Date(cursor.getTime() + nights * 86400000);
            const checkOut = cursor ? cursor.toISOString().slice(0, 10) : null;
            if (stay.nights !== nights || stay.check_in !== checkIn || stay.check_out !== checkOut) {
              changed = true;
              const i = items.indexOf(stay);
              items[i] = { ...stay, nights, check_in: checkIn, check_out: checkOut };
            }
          });
        }
      }
      // Drop auto stays whose destination was removed.
      const destIds = new Set(d.destinations.map((x) => x.id));
      const pruned = items.filter(
        (i) => !(i.item_type === 'hotel' && i.destination_id && !destIds.has(i.destination_id)),
      );
      if (pruned.length !== items.length) changed = true;
      if (!changed) return d;
      setSaveState('dirty');
      return { ...d, items: pruned };
    });
  }, [data.destinations, data.proposal.travel_start]);

  // Day-wise itinerary skeleton follows the route (count, dates, cities).
  useEffect(() => {
    setData((d) => {
      const next = syncItinerarySkeleton(d);
      if (!next) return d;
      setSaveState('dirty');
      return { ...d, itinerary: next };
    });
  }, [data.destinations, data.proposal.travel_start]);

  // Keep proposals.destination + travel_end in sync with the route.
  useEffect(() => {
    setData((d) => {
      const route = d.destinations
        .filter((x) => x.nights > 0)
        .map((x) => `${x.nights}N ${x.city_name}`)
        .join(' + ');
      const totalNights = d.destinations.reduce((s, x) => s + x.nights, 0);
      const travel_end =
        d.proposal.travel_start && totalNights > 0
          ? new Date(new Date(d.proposal.travel_start + 'T00:00:00Z').getTime() + totalNights * 86400000)
              .toISOString()
              .slice(0, 10)
          : d.proposal.travel_end;
      if (route === (d.proposal.destination ?? '') && travel_end === d.proposal.travel_end) return d;
      return { ...d, proposal: { ...d.proposal, destination: route || null, travel_end } };
    });
  }, [data.destinations, data.proposal.travel_start]);

  const totals = useMemo(() => rollupTotals(data), [data]);
  const warnings = useMemo(() => buildWarnings(data), [data]);
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* Stepper header */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(s.key)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              s.key === step
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 pr-1">
          {!readOnly && <AiFillDialog data={data} update={update} />}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saveState === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
          {saveState === 'saved' && <><Check className="h-3 w-3 text-green-600" /> Saved</>}
          {saveState === 'dirty' && <span>Unsaved changes</span>}
          {saveState === 'error' && (
            <button onClick={() => void save()} className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-3 w-3" /> Save failed — retry
            </button>
          )}
          </div>
        </div>
      </div>

      {readOnly && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
          This proposal is {proposalStatus} and read-only.
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 space-y-1">
          {warnings.map((w) => (
            <button
              key={w.id}
              className="flex items-start gap-2 w-full text-left hover:underline"
              onClick={() => setStep(w.step === 'review' ? 'review' : w.step)}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {w.message}
                <span className="text-xs opacity-60 ml-1">({STEPS.find((s) => s.key === w.step)?.label})</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 'trip' && <TripStep data={data} update={update} proposalId={proposalId} />}
      {step === 'stays' && <StaysStep data={data} update={update} />}
      {step === 'itinerary' && <ItineraryStep data={data} update={update} />}
      {step === 'extras' && <ExtrasStep data={data} update={update} />}
      {step === 'pricing' && <PricingStep data={data} update={update} />}
      {step === 'review' && (
        <ReviewStep data={data} totals={totals} proposalId={proposalId} save={save} />
      )}

      {/* Sticky footer: running total + step nav */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Total </span>
            <span className="font-semibold">
              {data.proposal.currency} {totals.grand.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            {totals.perPerson != null && (
              <span className="text-muted-foreground ml-2">
                ({data.proposal.currency} {totals.perPerson.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/pax)
              </span>
            )}
            <span className={`ml-3 text-xs ${totals.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              margin {data.proposal.currency} {totals.margin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={stepIdx === 0}
              onClick={() => setStep(STEPS[stepIdx - 1].key)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button size="sm" disabled={stepIdx === STEPS.length - 1} onClick={() => setStep(STEPS[stepIdx + 1].key)}>
              Next: {STEPS[stepIdx + 1]?.label ?? ''} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { BuilderData, DestinationRow };
