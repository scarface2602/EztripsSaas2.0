'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AsyncCombobox, type AsyncOption } from '@/components/ui/async-combobox';
import { BedDouble, Star } from 'lucide-react';
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
        const stays = data.items.filter((i) => i.item_type === 'hotel' && i.destination_id === dest.id);
        return (
          <Card key={dest.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BedDouble className="h-4 w-4" />
                {dest.city_name} — {dest.nights}N
                {stays[0]?.check_in && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {stays[0].check_in} → {stays[0].check_out}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stays.map((stay) => (
                <StayRow key={stay.id} stay={stay} dest={dest} update={update} />
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
}: {
  stay: ItemRow;
  dest: BuilderData['destinations'][number];
  update: StepProps['update'];
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
      {stay.hotel_directory_id && (
        <p className="sm:col-span-12 -mt-1 text-xs text-muted-foreground flex items-center gap-1">
          <Star className="h-3 w-3" /> From directory — live rates will appear here once a hotel API is connected.
        </p>
      )}
    </div>
  );
}
