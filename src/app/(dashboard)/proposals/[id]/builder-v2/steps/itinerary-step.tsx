'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AsyncCombobox, type AsyncOption } from '@/components/ui/async-combobox';
import { CalendarDays, Loader2, Sparkles, Wand2, Plus, Trash2, BookmarkPlus, Check } from 'lucide-react';
import type { BuilderData, ItineraryDayRow, DayBlockRow, DayTypeDb, BlockType } from '../types';

interface StepProps {
  data: BuilderData;
  update: (patch: Partial<BuilderData> | ((d: BuilderData) => BuilderData)) => void;
}

const DAY_TYPES: { value: DayTypeDb; label: string }[] = [
  { value: 'arrival', label: 'Arrival' },
  { value: 'tour', label: 'Tour / Sightseeing' },
  { value: 'transfer', label: 'City transfer' },
  { value: 'flight', label: 'Internal flight' },
  { value: 'departure', label: 'Departure' },
];

const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: 'sightseeing', label: 'Tour' },
  { value: 'activity', label: 'Activity' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'flight', label: 'Flight' },
  { value: 'meal', label: 'Meal' },
  { value: 'free_time', label: 'Free time' },
  { value: 'other', label: 'Other' },
];

// Day-wise itinerary: the skeleton (count, dates, cities) derives from
// the route. A day holds multiple blocks — internal flight + evening
// tour, two tours, etc. Blocks come from / feed the activity library.
export function ItineraryStep({ data, update }: StepProps) {
  const [busyDay, setBusyDay] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const days = data.itinerary;

  const patchDay = (id: string, patch: Partial<ItineraryDayRow>) =>
    update((d) => ({
      ...d,
      itinerary: d.itinerary.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));

  const hotelForDay = (day: ItineraryDayRow) => {
    if (!day.date) return undefined;
    const stay = data.items.find(
      (i) => i.item_type === 'hotel' && i.check_in && i.check_out && i.check_in <= day.date! && i.check_out > day.date!,
    );
    return stay && !stay.title.startsWith('Hotel in ') ? stay.title : undefined;
  };

  async function generateDay(day: ItineraryDayRow, mode: 'generate' | 'curate'): Promise<boolean> {
    const body: Record<string, unknown> = {
      day_number: day.day_number,
      destination: data.proposal.destination ?? undefined,
      city: day.city ?? undefined,
      hotel: hotelForDay(day),
      activities: day.blocks.map((b) => b.title).filter(Boolean),
    };
    if (mode === 'curate') {
      if (!day.description) return false;
      body.raw_description = day.description;
    } else {
      body.day_type = day.day_type ?? undefined;
      if (day.heading && day.day_type === 'tour') body.existing_heading = day.heading;
    }
    const res = await fetch('/api/ai/itinerary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const out = await res.json();
    if (out.error) return false;
    patchDay(day.id, {
      heading: out.heading || day.heading,
      description: out.description || day.description,
    });
    return true;
  }

  async function aiDay(day: ItineraryDayRow, mode: 'generate' | 'curate') {
    setBusyDay(day.id);
    try {
      await generateDay(day, mode);
    } finally {
      setBusyDay(null);
    }
  }

  async function aiAllEmpty() {
    setBusyAll(true);
    try {
      for (const day of days.filter((d) => !d.description)) {
        setBusyDay(day.id);
        await generateDay(day, 'generate');
      }
    } finally {
      setBusyDay(null);
      setBusyAll(false);
    }
  }

  if (days.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Add cities with nights on the Trip step — the day-wise itinerary builds itself from the route.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {days.length} days from your route. Add multiple blocks per day — a flight and an evening tour can share a day.
        </p>
        <Button variant="outline" size="sm" onClick={() => void aiAllEmpty()} disabled={busyAll}>
          {busyAll ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
          AI write all empty days
        </Button>
      </div>

      {days.map((day) => (
        <Card key={day.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Day {day.day_number}
              <span className="text-sm font-normal text-muted-foreground">
                {day.date ?? 'date TBD'}{day.city ? ` · ${day.city}` : ''}
              </span>
            </CardTitle>
            <Select
              value={day.day_type ?? 'tour'}
              onValueChange={(v) => patchDay(day.id, { day_type: (v ?? 'tour') as DayTypeDb })}
            >
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={day.heading ?? ''}
              onChange={(e) => patchDay(day.id, { heading: e.target.value || null })}
              placeholder='Day heading, e.g. "Nusa Penida West Tour & Sunset at Uluwatu"'
            />

            {/* ── Blocks ── */}
            <div className="space-y-2">
              {day.blocks
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((block) => (
                  <BlockRow key={block.id} day={day} block={block} patchDay={patchDay} />
                ))}
              <Button
                variant="outline" size="sm" className="border-dashed"
                onClick={() =>
                  patchDay(day.id, {
                    blocks: [
                      ...day.blocks,
                      {
                        id: crypto.randomUUID(),
                        type: 'sightseeing',
                        title: '',
                        description: null,
                        transfer_mode: null,
                        start_time: null,
                        library_id: null,
                        sort_order: day.blocks.length,
                      },
                    ],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add to this day
              </Button>
            </div>

            <Textarea
              rows={3}
              value={day.description ?? ''}
              onChange={(e) => patchDay(day.id, { description: e.target.value || null })}
              placeholder="Day summary the client reads — write rough notes and hit Curate, or AI write composes it from the blocks above"
            />
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                disabled={busyDay === day.id}
                onClick={() => void aiDay(day, 'generate')}
              >
                {busyDay === day.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                AI write
              </Button>
              <Button
                variant="ghost" size="sm"
                disabled={busyDay === day.id || !day.description}
                onClick={() => void aiDay(day, 'curate')}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Curate my text
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BlockRow({
  day,
  block,
  patchDay,
}: {
  day: ItineraryDayRow;
  block: DayBlockRow;
  patchDay: (id: string, patch: Partial<ItineraryDayRow>) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(!block.title);

  const patchBlock = (patch: Partial<DayBlockRow>) =>
    patchDay(day.id, {
      blocks: day.blocks.map((b) => (b.id === block.id ? { ...b, ...patch } : b)),
    });
  const removeBlock = () =>
    patchDay(day.id, { blocks: day.blocks.filter((b) => b.id !== block.id) });

  async function saveToLibrary() {
    const res = await fetch('/api/activities/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: block.library_id ?? undefined,
        name: block.title,
        type: block.type,
        city_name: day.city,
        description: block.description,
        default_transfer_mode: block.transfer_mode,
      }),
    });
    if (res.ok) {
      const { activity } = await res.json();
      patchBlock({ library_id: activity.id });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <Select value={block.type} onValueChange={(v) => patchBlock({ type: (v ?? 'sightseeing') as BlockType })}>
          <SelectTrigger className="w-28 h-8 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {BLOCK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <AsyncCombobox
          className="flex-1"
          value={block.title ? { id: block.id, label: block.title } : null}
          onSelect={(opt) => {
            if (!opt) {
              patchBlock({ title: '', library_id: null });
              return;
            }
            const meta = opt as AsyncOption & {
              library_id?: number;
              lib_description?: string | null;
              lib_type?: BlockType;
              lib_mode?: 'SIC' | 'PVT' | null;
            };
            patchBlock({
              title: opt.label,
              library_id: meta.library_id ?? null,
              // Library entries bring their full description and defaults.
              ...(meta.lib_description ? { description: meta.lib_description } : {}),
              ...(meta.lib_type ? { type: meta.lib_type } : {}),
              ...(meta.lib_mode ? { transfer_mode: meta.lib_mode } : {}),
            });
            setExpanded(true);
          }}
          search={async (q) => {
            const params = new URLSearchParams({ q });
            const res = await fetch(`/api/activities/library?${params}`);
            const d = res.ok ? await res.json() : { activities: [] };
            return (d.activities as { id: number; name: string; type: BlockType; city_name: string | null; description: string | null; default_transfer_mode: 'SIC' | 'PVT' | null }[]).map((a) => ({
              id: a.id,
              label: a.name,
              description: [a.type, a.city_name].filter(Boolean).join(' · '),
              library_id: a.id,
              lib_description: a.description,
              lib_type: a.type,
              lib_mode: a.default_transfer_mode,
            }));
          }}
          onCreate={async (name) => ({ id: crypto.randomUUID(), label: name })}
          placeholder="Search library or type a new tour/transfer…"
        />
        <Select
          value={block.transfer_mode ?? 'none'}
          onValueChange={(v) => patchBlock({ transfer_mode: !v || v === 'none' ? null : (v as 'SIC' | 'PVT') })}
        >
          <SelectTrigger className="w-24 h-8 shrink-0"><SelectValue placeholder="SIC/PVT" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            <SelectItem value="PVT">PVT</SelectItem>
            <SelectItem value="SIC">SIC</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="time"
          className="w-28 h-8 shrink-0"
          value={block.start_time ?? ''}
          onChange={(e) => patchBlock({ start_time: e.target.value || null })}
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={removeBlock}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {(expanded || block.description) && (
        <div className="flex gap-2 items-start">
          <Textarea
            rows={2}
            className="flex-1"
            value={block.description ?? ''}
            onChange={(e) => patchBlock({ description: e.target.value || null })}
            placeholder="Detailed description — saved to the library so you never type it twice"
          />
          <Button
            variant="outline" size="sm" className="shrink-0"
            disabled={!block.title.trim()}
            onClick={() => void saveToLibrary()}
            title={block.library_id ? 'Update this library entry' : 'Save to library for reuse'}
          >
            {saved ? <Check className="h-3.5 w-3.5 text-green-600" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
}
