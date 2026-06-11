'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AsyncCombobox, type AsyncOption } from '@/components/ui/async-combobox';
import { Button } from '@/components/ui/button';
import { BedDouble, Star, Plus, Minus, Trash2, Zap, Loader2 } from 'lucide-react';
import type { BuilderData, ItemRow } from '../types';

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
                  pax={{ adults: data.proposal.pax_adults, children: data.proposal.pax_children }}
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
  pax,
}: {
  stay: ItemRow;
  dest: BuilderData['destinations'][number];
  update: StepProps['update'];
  isLast: boolean;
  canSplit: boolean;
  pax: { adults: number; children: number };
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
      <LiveRates stay={stay} dest={dest} pax={pax} update={update} />
    </div>
  );
}

const BOARD_TO_MEAL: Record<string, string> = { RO: 'EP', BB: 'CP', HB: 'MAP', FB: 'AP', AI: 'AI' };

interface LiveRate {
  providerRef: string;
  hotelName: string;
  roomType: string;
  mealPlan?: string;
  currency: string;
  netCost: number;
  cancellationPolicy?: string;
  raw?: { suggestedSell?: number | null; boardName?: string | null };
}

// Availability + indicative rates. The API is the source of truth for
// rooms/availability; the price is a prefill the agent overwrites with
// their B2B rate on the Pricing step.
function LiveRates({
  stay,
  dest,
  pax,
  update,
}: {
  stay: ItemRow;
  dest: BuilderData['destinations'][number];
  pax: { adults: number; children: number };
  update: StepProps['update'];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<LiveRate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSearch = !!stay.check_in && !!stay.check_out;

  async function fetchRates() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hotels/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_name: dest.city_name,
          country_code: dest.country_code ?? undefined,
          hotel_name: stay.title.startsWith('Hotel in ') ? undefined : stay.title,
          check_in: stay.check_in,
          check_out: stay.check_out,
          adults: pax.adults || 2,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Rate search failed');
      setRates(body.rates ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function applyRate(r: LiveRate) {
    update((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.id === stay.id
          ? {
              ...i,
              title: r.hotelName,
              details: {
                ...i.details,
                room_type: r.roomType,
                meal_plan: r.mealPlan ? (BOARD_TO_MEAL[r.mealPlan] ?? r.mealPlan) : (i.details as { meal_plan?: string }).meal_plan,
                cancellation: r.cancellationPolicy,
              },
              source: 'api' as const,
              provider: 'liteapi',
              provider_ref: r.providerRef,
              // Indicative prefill — overwrite with your B2B rate in Pricing.
              cost_amount: i.price_group_id ? i.cost_amount : r.netCost,
            }
          : i,
      ),
    }));
    setOpen(false);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!canSearch || loading} onClick={() => void fetchRates()}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
          Check availability & rates
        </Button>
        {stay.source === 'api' && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Star className="h-3 w-3" /> Live rate attached — cost is indicative, overwrite with your B2B rate in Pricing.
          </span>
        )}
        {!canSearch && <span className="text-xs text-muted-foreground">Set travel dates to check availability.</span>}
      </div>
      {open && (
        <div className="mt-2 border rounded-lg max-h-64 overflow-y-auto divide-y">
          {loading && <p className="p-3 text-sm text-muted-foreground">Checking availability…</p>}
          {error && <p className="p-3 text-sm text-destructive">{error}</p>}
          {!loading && rates?.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              No live availability found for these dates — keep the manual entry.
            </p>
          )}
          {(rates ?? []).map((r) => (
            <div key={r.providerRef} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.hotelName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[r.roomType, r.raw?.boardName, r.cancellationPolicy].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">
                  {r.currency} {Math.round(r.netCost).toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-muted-foreground">net · indicative</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => applyRate(r)}>Use</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
