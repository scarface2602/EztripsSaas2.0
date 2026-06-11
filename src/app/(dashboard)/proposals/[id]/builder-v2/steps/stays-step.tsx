'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AsyncCombobox, type AsyncOption } from '@/components/ui/async-combobox';
import { Button } from '@/components/ui/button';
import { BedDouble, Plus, Minus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import type { BuilderData, ItemRow, StayOccupancy } from '../types';

interface StepProps {
  data: BuilderData;
  update: (patch: Partial<BuilderData> | ((d: BuilderData) => BuilderData)) => void;
}

const MEAL_PLANS = ['EP', 'CP', 'MAP', 'AP', 'AI'] as const; // room only → all inclusive

// One card per destination; the stay rows themselves were auto-created by
// the builder's cities-first invariant, so dates/nights are never edited
// here — change the route on the Trip step and they follow.
export function StaysStep({ data, update }: StepProps) {
  const destinations = [...data.destinations]
    .filter((d) => d.nights > 0)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (destinations.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Add cities with nights on the Trip step first — each city gets its stay card here automatically.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {destinations.map((dest) => {
        const stays = data.items
          .filter((i) => i.item_type === 'hotel' && i.destination_id === dest.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const maxSort = stays.length ? Math.max(...stays.map((s) => s.sort_order)) : dest.sort_order * 100;
        return (
          <Card key={dest.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <BedDouble className="h-4 w-4" />
                {dest.city_name} — {dest.nights}N
                {stays[0]?.check_in && stays.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {stays[0].check_in} → {stays[stays.length - 1].check_out}
                  </span>
                )}
              </CardTitle>
              {dest.nights > 1 && (
                <Button
                  variant="outline" size="sm"
                  onClick={() =>
                    update((d) => {
                      // New stay takes 1 night; the rebalancer re-chains dates.
                      const list = d.items
                        .filter((i) => i.item_type === 'hotel' && i.destination_id === dest.id)
                        .sort((a, b) => a.sort_order - b.sort_order);
                      const last = list[list.length - 1];
                      return {
                        ...d,
                        items: [
                          ...d.items.map((i) =>
                            last && i.id === last.id ? { ...i, nights: Math.max((i.nights ?? 1) - 1, 1) } : i,
                          ),
                          {
                            id: crypto.randomUUID(),
                            destination_id: dest.id,
                            price_group_id: null,
                            item_type: 'hotel' as const,
                            title: `Hotel in ${dest.city_name}`,
                            details: {},
                            hotel_directory_id: null,
                            check_in: null,
                            check_out: null,
                            nights: 1,
                            source: 'manual' as const,
                            provider: null,
                            provider_ref: null,
                            cost_amount: null,
                            sell_amount: null,
                            sort_order: maxSort + 1,
                          },
                        ],
                      };
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Split stay
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {stays.map((stay, idx) => (
                <StayRow
                  key={stay.id}
                  stay={stay}
                  dest={dest}
                  update={update}
                  isLast={idx === stays.length - 1}
                  canSplit={stays.length > 1}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StayRow({
  stay,
  dest,
  update,
  isLast,
  canSplit,
}: {
  stay: ItemRow;
  dest: BuilderData['destinations'][number];
  update: StepProps['update'];
  isLast: boolean;
  canSplit: boolean;
}) {
  const [hotel, setHotel] = useState<AsyncOption | null>(
    stay.hotel_directory_id || stay.source !== 'manual' || !stay.title.startsWith('Hotel in ')
      ? { id: stay.hotel_directory_id ?? stay.id, label: stay.title }
      : null,
  );

  const patchStay = (patch: Partial<ItemRow>) =>
    update((d) => ({ ...d, items: d.items.map((i) => (i.id === stay.id ? { ...i, ...patch } : i)) }));

  const details = stay.details as { room_type?: string; meal_plan?: string; notes?: string };
  const patchDetails = (p: Record<string, unknown>) => patchStay({ details: { ...stay.details, ...p } });

  return (
    <div className="space-y-2">
      {canSplit && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {stay.check_in ?? '—'} → {stay.check_out ?? '—'}
          </span>
          {isLast ? (
            <span className="px-2 py-0.5 rounded bg-muted text-xs">{stay.nights}N (balance)</span>
          ) : (
            <span className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" className="h-6 w-6"
                onClick={() => patchStay({ nights: Math.max((stay.nights ?? 1) - 1, 0) })}
              ><Minus className="h-3 w-3" /></Button>
              <span className="w-8 text-center text-xs">{stay.nights}N</span>
              <Button
                variant="outline" size="icon" className="h-6 w-6"
                onClick={() => patchStay({ nights: (stay.nights ?? 0) + 1 })}
              ><Plus className="h-3 w-3" /></Button>
            </span>
          )}
          <Button
            variant="ghost" size="icon" className="h-6 w-6 text-destructive ml-auto"
            onClick={() =>
              update((d) => ({ ...d, items: d.items.filter((i) => i.id !== stay.id) }))
            }
          ><Trash2 className="h-3 w-3" /></Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-12 items-end">
      <div className="space-y-2 sm:col-span-5">
        <Label>Hotel</Label>
        <AsyncCombobox
          value={hotel}
          onSelect={(opt) => {
            setHotel(opt);
            if (opt) {
              const meta = opt as AsyncOption & { directory_id?: number };
              patchStay({
                title: opt.label,
                hotel_directory_id: meta.directory_id ?? null,
                source: meta.directory_id ? 'directory' : 'manual',
              });
            } else {
              patchStay({ title: `Hotel in ${dest.city_name}`, hotel_directory_id: null, source: 'manual' });
            }
          }}
          search={async (q) => {
            const params = new URLSearchParams({ q });
            if (dest.city_id) params.set('city_id', String(dest.city_id));
            if (dest.country_code) params.set('country', dest.country_code);
            const res = await fetch(`/api/hotels/search?${params}`);
            const d = res.ok ? await res.json() : { hotels: [] };
            return (d.hotels as { id: number; name: string; star_rating: number | null; city_name: string | null }[]).map((h) => ({
              id: h.id,
              label: h.name,
              description: [h.star_rating ? `${h.star_rating}★` : null, h.city_name].filter(Boolean).join(' · '),
              directory_id: h.id,
            }));
          }}
          onCreate={async (name) => {
            const res = await fetch('/api/hotels/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name,
                city_id: dest.city_id ?? undefined,
                city_name: dest.city_name,
                country_code: dest.country_code ?? undefined,
              }),
            });
            if (!res.ok) return null;
            const { hotel: h } = await res.json();
            return { id: h.id, label: h.name, directory_id: h.id } as AsyncOption;
          }}
          placeholder={`Search hotels in ${dest.city_name}…`}
        />
      </div>
      <div className="space-y-2 sm:col-span-3">
        <Label>Room type</Label>
        <Input
          value={details.room_type ?? ''}
          onChange={(e) => patchDetails({ room_type: e.target.value })}
          placeholder="Deluxe, Pool Villa…"
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Meal plan</Label>
        <Select value={details.meal_plan ?? 'CP'} onValueChange={(v) => patchDetails({ meal_plan: v ?? 'CP' })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MEAL_PLANS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Notes</Label>
        <Input
          value={details.notes ?? ''}
          onChange={(e) => patchDetails({ notes: e.target.value })}
          placeholder="Optional"
        />
      </div>
      </div>
      <OccupancyPolicy occ={stay.details as StayOccupancy} patchDetails={patchDetails} />
    </div>
  );
}

// Collapsed by default — the 2-adults-double-CP happy path never opens it.
// EB/CWB/CNB/child-free counts cover what DMC quotes price separately;
// rates are per night and informational when the price sits in a group.
function OccupancyPolicy({
  occ,
  patchDetails,
}: {
  occ: StayOccupancy;
  patchDetails: (p: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);

  const summary = [
    occ.rooms ? `${occ.rooms} room${occ.rooms > 1 ? 's' : ''}` : null,
    occ.extra_beds ? `${occ.extra_beds} EB` : null,
    occ.cwb ? `${occ.cwb} CWB` : null,
    occ.cnb ? `${occ.cnb} CNB` : null,
    occ.children_free ? `${occ.children_free} child free` : null,
    occ.refundable === false ? 'Non-refundable' : null,
    occ.refundable === true && occ.free_cancellation_until ? `Free cancel till ${occ.free_cancellation_until}` : null,
  ].filter(Boolean);

  const count = (label: string, key: keyof StayOccupancy, hint?: string) => (
    <div className="space-y-1">
      <Label className="text-xs" title={hint}>{label}</Label>
      <Input
        type="number" min={0} className="h-8"
        value={(occ[key] as number | undefined) ?? ''}
        onChange={(e) =>
          patchDetails({ [key]: e.target.value === '' ? undefined : Math.max(parseInt(e.target.value, 10) || 0, 0) })
        }
      />
    </div>
  );
  const rate = (label: string, key: keyof StayOccupancy) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number" min={0} className="h-8" placeholder="/night"
        value={(occ[key] as number | undefined) ?? ''}
        onChange={(e) => patchDetails({ [key]: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
      />
    </div>
  );

  return (
    <div className="rounded-md border border-dashed px-3 py-2">
      <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground w-full" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Occupancy &amp; policy
        {!open && summary.length > 0 && <span className="text-foreground">· {summary.join(' · ')}</span>}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            {count('Rooms', 'rooms')}
            {count('Extra beds (EB)', 'extra_beds', '3rd adult in a double room')}
            {count('Child with bed (CWB)', 'cwb')}
            {count('Child no bed (CNB)', 'cnb')}
            {count('Children free', 'children_free', 'Complimentary child stay, usually under an age limit')}
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
            {rate('EB rate', 'eb_rate')}
            {rate('CWB rate', 'cwb_rate')}
            {rate('CNB rate', 'cnb_rate')}
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Child policy</Label>
              <Input
                className="h-8"
                value={occ.child_policy ?? ''}
                onChange={(e) => patchDetails({ child_policy: e.target.value || undefined })}
                placeholder="e.g. 1 child below 6 stays free without bed"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Refundability</Label>
              <Select
                value={occ.refundable === true ? 'yes' : occ.refundable === false ? 'no' : 'unknown'}
                onValueChange={(v) =>
                  patchDetails({
                    refundable: v === 'yes' ? true : v === 'no' ? false : undefined,
                    ...(v !== 'yes' ? { free_cancellation_until: undefined } : {}),
                  })
                }
              >
                <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Not specified</SelectItem>
                  <SelectItem value="yes">Refundable</SelectItem>
                  <SelectItem value="no">Non-refundable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {occ.refundable === true && (
              <div className="space-y-1">
                <Label className="text-xs">Free cancellation until</Label>
                <Input
                  type="date" className="h-8 w-40"
                  value={occ.free_cancellation_until ?? ''}
                  onChange={(e) => patchDetails({ free_cancellation_until: e.target.value || undefined })}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
