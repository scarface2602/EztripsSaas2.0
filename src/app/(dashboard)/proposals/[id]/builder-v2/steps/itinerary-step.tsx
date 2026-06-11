'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Loader2, Sparkles, Wand2 } from 'lucide-react';
import type { BuilderData, ItineraryDayRow, DayTypeDb, TransferMode } from '../types';

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

const TRANSFER_MODES: { value: TransferMode; label: string }[] = [
  { value: 'PVT', label: 'PVT (private)' },
  { value: 'SIC', label: 'SIC (shared)' },
  { value: 'NONE', label: 'No transfer' },
];

// Day-wise itinerary. The day skeleton (count, dates, cities) is derived
// from the route automatically — agents only write/AI the content.
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

  // AI writing. Mirrors the old editor: tour days use the heading as the
  // source of truth; existing prose can be polished via raw_description.
  async function generateDay(day: ItineraryDayRow, mode: 'generate' | 'curate'): Promise<boolean> {
    const body: Record<string, unknown> = {
      day_number: day.day_number,
      destination: data.proposal.destination ?? undefined,
      city: day.city ?? undefined,
      hotel: hotelForDay(day),
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
          {days.length} days, generated from your route. Days update automatically when the route changes.
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
            <div className="flex items-center gap-2">
              <Select
                value={day.day_type ?? 'tour'}
                onValueChange={(v) => patchDay(day.id, { day_type: (v ?? 'tour') as DayTypeDb })}
              >
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={day.transfer_mode ?? 'NONE'}
                onValueChange={(v) => patchDay(day.id, { transfer_mode: (v ?? 'NONE') as TransferMode })}
              >
                <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSFER_MODES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              value={day.heading ?? ''}
              onChange={(e) => patchDay(day.id, { heading: e.target.value || null })}
              placeholder={
                day.day_type === 'tour'
                  ? 'Heading — places for the day, e.g. "Tanah Lot, Taman Ayun & Ulun Danu"'
                  : 'Heading (optional — AI writes one)'
              }
            />
            <Textarea
              rows={3}
              value={day.description ?? ''}
              onChange={(e) => patchDay(day.id, { description: e.target.value || null })}
              placeholder="Day description — write rough notes and hit Curate, or leave empty and hit AI write"
            />
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                disabled={busyDay === day.id}
                onClick={() => void aiDay(day, 'generate')}
                title={day.day_type === 'tour' ? 'Writes from the heading — list the places first' : 'Writes from the day type'}
              >
                {busyDay === day.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                AI write
              </Button>
              <Button
                variant="ghost" size="sm"
                disabled={busyDay === day.id || !day.description}
                onClick={() => void aiDay(day, 'curate')}
                title="Polish your rough notes into client-ready prose"
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
