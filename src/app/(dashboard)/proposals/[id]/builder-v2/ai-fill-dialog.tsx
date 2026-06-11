'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wand2 } from 'lucide-react';
import type { ParsedQuote } from '@/lib/types/database';
import type { BuilderData, DestinationRow, ItemRow, ItineraryDayRow } from './types';

// Paste a supplier/DMC quote → /api/quotes/parse → pre-fill the builder.
// Replaces the old upfront "manual vs AI import" fork: the builder is the
// only flow, AI fill is just a shortcut inside it.

const MEAL_MAP: Record<string, string> = { RO: 'EP', BB: 'CP', HB: 'MAP', FB: 'AP', AI: 'AI' };

interface AiFillDialogProps {
  data: BuilderData;
  update: (patch: Partial<BuilderData> | ((d: BuilderData) => BuilderData)) => void;
}

export function AiFillDialog({ data, update }: AiFillDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parseAndFill() {
    setParsing(true);
    setError(null);
    try {
      // Uploaded file (PDF/Excel/CSV) → extract its text first.
      let sourceText = text;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_type', file.name.endsWith('.pdf') ? 'pdf' : 'excel');
        const importRes = await fetch('/api/quotes/import', { method: 'POST', body: formData });
        const importData = await importRes.json().catch(() => ({}));
        if (!importRes.ok) throw new Error(importData.error ?? 'Could not read the file');
        sourceText = importData.text ?? '';
        if (!sourceText.trim()) throw new Error('No text could be extracted from the file');
      }

      const res = await fetch('/api/quotes/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Parse failed');
      const parsed: ParsedQuote = body.parsed ?? body;

      const hasExisting = data.destinations.length > 0 || data.items.some((i) => i.title.trim());
      if (hasExisting && !confirm('This will replace the cities, stays and items already in the builder. Continue?')) {
        return;
      }

      // Cities → destinations (resolve directory ids best-effort).
      const tripCities = parsed.trip_cities?.length
        ? parsed.trip_cities
        : Array.from(new Set(parsed.hotels.map((h) => h.city).filter(Boolean))).map((city) => ({ city, nights: 1 }));
      const destinations: DestinationRow[] = await Promise.all(
        tripCities.map(async (tc, i) => {
          let cityId: number | null = null;
          let countryCode: string | null = null;
          try {
            const r = await fetch(`/api/geo/cities?q=${encodeURIComponent(tc.city)}&limit=1`);
            const d = await r.json();
            if (d.cities?.[0]?.name?.toLowerCase() === tc.city.toLowerCase()) {
              cityId = d.cities[0].id;
              countryCode = d.cities[0].country_code;
            }
          } catch { /* keep free-text city */ }
          return {
            id: crypto.randomUUID(),
            city_id: cityId,
            city_name: tc.city,
            country_code: countryCode,
            nights: tc.nights || 1,
            sort_order: i,
          };
        }),
      );

      const destByCity = new Map(destinations.map((d) => [d.city_name.toLowerCase(), d]));
      const items: ItemRow[] = [];
      let sort = 0;
      const blankItem = (): Omit<ItemRow, 'item_type' | 'title'> => ({
        id: crypto.randomUUID(),
        destination_id: null,
        price_group_id: null,
        details: {},
        hotel_directory_id: null,
        check_in: null,
        check_out: null,
        nights: null,
        source: 'manual',
        provider: null,
        provider_ref: null,
        cost_amount: null,
        sell_amount: null,
        sort_order: sort++,
      });

      for (const h of parsed.hotels) {
        const dest = destByCity.get(h.city?.toLowerCase() ?? '');
        items.push({
          ...blankItem(),
          item_type: 'hotel',
          title: h.name,
          destination_id: dest?.id ?? null,
          check_in: h.check_in,
          check_out: h.check_out,
          nights: dest?.nights ?? null,
          details: {
            room_type: h.room_type ?? '',
            meal_plan: h.meal_plan ? (MEAL_MAP[h.meal_plan] ?? h.meal_plan) : 'CP',
          },
        });
      }
      for (const f of parsed.flights ?? []) {
        if (f.flight_number) items.push({ ...blankItem(), item_type: 'flight', title: f.flight_number });
      }
      for (const a of parsed.activities ?? []) {
        const title = (a as { name?: string; description?: string }).name ?? (a as { description?: string }).description;
        if (title) items.push({ ...blankItem(), item_type: 'activity', title });
      }

      // One price group seeded from the supplier — agent enters the quote cost.
      const groups = parsed.supplier_name
        ? [{
            id: crypto.randomUUID(),
            name: 'Land package',
            supplier_id: null,
            supplier_name: parsed.supplier_name,
            cost_amount: 0,
            markup_type: 'percent' as const,
            markup_value: 15,
            sell_amount: 0,
            sort_order: 0,
          }]
        : [];

      // Day-wise itinerary from the parse; the route-skeleton sync will
      // reconcile dates/cities/count afterwards.
      const itinerary: ItineraryDayRow[] = (parsed.itinerary_days ?? [])
        .sort((a, b) => a.day_number - b.day_number)
        .map((d, i) => ({
          id: crypto.randomUUID(),
          day_number: i + 1,
          date: null,
          city: d.city ?? null,
          heading: d.heading ?? null,
          description: d.description || null,
          day_type: (['arrival', 'departure', 'tour'].includes(d.day_type ?? '') ? d.day_type : null) as ItineraryDayRow['day_type'],
          transfer_mode: null,
          blocks: (d.activities ?? []).map((a, bi) => ({
            id: crypto.randomUUID(),
            type: (['transfer', 'sightseeing', 'activity'].includes(a.type) ? a.type : 'other') as ItineraryDayRow['blocks'][number]['type'],
            title: a.description.length > 120 ? a.description.slice(0, 117) + '…' : a.description,
            description: a.description,
            transfer_mode: null,
            start_time: null,
            library_id: null,
            sort_order: bi,
          })),
        }));

      // Currency stays whatever the proposal uses (INR by default) — the
      // supplier quoting in USD doesn't change what the client is billed in.
      update((d) => ({
        ...d,
        proposal: {
          ...d.proposal,
          title: d.proposal.title || (parsed.destination ? `${parsed.destination} Trip` : d.proposal.title),
          destination: parsed.destination || d.proposal.destination,
          travel_start: parsed.travel_start ?? d.proposal.travel_start,
          pax_adults: parsed.pax_adults ?? d.proposal.pax_adults,
          pax_children: parsed.pax_children ?? d.proposal.pax_children,
        },
        destinations,
        items,
        groups: groups.length ? groups : d.groups,
        itinerary: itinerary.length ? itinerary : d.itinerary,
      }));
      setOpen(false);
      setText('');
      setFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-sm font-medium hover:bg-muted transition-colors">
        <Wand2 className="h-4 w-4" /> AI fill from quote
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fill builder from a supplier quote</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Paste the DMC/supplier quote text, or upload the quote as PDF/Excel/CSV. Cities, nights, hotels,
          itinerary and extras get filled in — you review and price them.
        </p>
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste quote text here…"
          disabled={!!file}
        />
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:bg-background file:text-sm file:font-medium hover:file:bg-muted file:cursor-pointer"
          />
          {file && (
            <button className="text-xs text-muted-foreground underline" onClick={() => setFile(null)}>
              clear
            </button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={() => void parseAndFill()} disabled={parsing || (!file && text.trim().length < 20)}>
            {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Parse &amp; fill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
