'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plane, StampIcon, Package, Trash2, Plus, Wand2, Loader2 } from 'lucide-react';
import type { BuilderData, ItemRow, ItemType } from '../types';

interface StepProps {
  data: BuilderData;
  update: (patch: Partial<BuilderData> | ((d: BuilderData) => BuilderData)) => void;
}

// Tours/transfers live in the day-wise Itinerary now; this step keeps
// only things that aren't day content: flights, visas, and separately
// priced add-ons.
const SIMPLE_SECTIONS: { type: ItemType; label: string; icon: typeof StampIcon; placeholder: string }[] = [
  { type: 'visa', label: 'Visa & documents', icon: StampIcon, placeholder: 'e.g. Indonesia visa on arrival' },
  { type: 'other', label: 'Other priced add-ons', icon: Package, placeholder: 'e.g. Travel insurance, optional candle-light dinner' },
];

export interface FlightDetails {
  airline?: string;
  flight_number?: string;
  origin?: string;
  destination?: string;
  depart_at?: string;
  arrive_at?: string;
  duration?: string;
  layover?: string;
  operated_by?: string;
  fare_type?: string;
  baggage?: string;
}

function flightTitle(d: FlightDetails): string {
  return (
    [d.flight_number || d.airline, d.origin && d.destination ? `${d.origin} → ${d.destination}` : null]
      .filter(Boolean)
      .join(' ') || 'Flight'
  );
}

export function ExtrasStep({ data, update }: StepProps) {
  const newItem = (type: ItemType, title = '', details: Record<string, unknown> = {}): ItemRow => ({
    id: crypto.randomUUID(),
    destination_id: null,
    price_group_id: null,
    item_type: type,
    title,
    details,
    hotel_directory_id: null,
    check_in: null,
    check_out: null,
    nights: null,
    source: 'manual',
    provider: null,
    provider_ref: null,
    cost_amount: null,
    sell_amount: null,
    sort_order: data.items.length,
  });

  const addItem = (type: ItemType) => update((d) => ({ ...d, items: [...d.items, newItem(type)] }));
  const patchItem = (id: string, patch: Partial<ItemRow>) =>
    update((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeItem = (id: string) => update((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));

  const destinations = [...data.destinations].sort((a, b) => a.sort_order - b.sort_order);
  const flights = data.items.filter((i) => i.item_type === 'flight');

  return (
    <div className="space-y-4">
      {/* ── Flights: structured editor + AI paste-parse ── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plane className="h-4 w-4" /> Flights
          </CardTitle>
          <div className="flex gap-2">
            <FlightParseButton update={update} newItem={newItem} />
            <Button variant="outline" size="sm" onClick={() => addItem('flight')}>
              <Plus className="h-4 w-4 mr-1" /> Add manually
            </Button>
          </div>
        </CardHeader>
        {flights.length > 0 && (
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground -mt-2">
              Flight prices stay separate from the land package — they get their own line on the Pricing step and in the proposal.
            </p>
            {flights.map((f) => (
              <FlightRow key={f.id} item={f} patchItem={patchItem} removeItem={removeItem} />
            ))}
          </CardContent>
        )}
      </Card>

      {/* ── Simple sections ── */}
      {SIMPLE_SECTIONS.map(({ type, label, icon: Icon, placeholder }) => {
        const items = data.items.filter((i) => i.item_type === type);
        return (
          <Card key={type}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4" /> {label}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => addItem(type)}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </CardHeader>
            {items.length > 0 && (
              <CardContent className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-2 items-center">
                    <Input
                      className="flex-1"
                      value={item.title}
                      onChange={(e) => patchItem(item.id, { title: e.target.value })}
                      placeholder={placeholder}
                    />
                    {type !== 'visa' && (
                      <Select
                        value={item.destination_id ?? 'none'}
                        onValueChange={(v) => patchItem(item.id, { destination_id: !v || v === 'none' ? null : v })}
                      >
                        <SelectTrigger className="w-40"><SelectValue placeholder="City" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Whole trip</SelectItem>
                          {destinations.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.city_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      type="date"
                      className="w-40"
                      value={item.check_in ?? ''}
                      onChange={(e) => patchItem(item.id, { check_in: e.target.value || null })}
                    />
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Tours &amp; transfers are added per day on the Itinerary step. Prices come next — land items can be covered by a
        package quote; flights are always priced on their own.
      </p>
    </div>
  );
}

function FlightRow({
  item,
  patchItem,
  removeItem,
}: {
  item: ItemRow;
  patchItem: (id: string, patch: Partial<ItemRow>) => void;
  removeItem: (id: string) => void;
}) {
  const d = item.details as FlightDetails;
  const patch = (p: Partial<FlightDetails>) => {
    const details = { ...d, ...p };
    patchItem(item.id, { details: details as Record<string, unknown>, title: flightTitle(details) });
  };
  const F = ({ label, k, w = '', placeholder = '' }: { label: string; k: keyof FlightDetails; w?: string; placeholder?: string }) => (
    <div className={`space-y-1 ${w}`}>
      <Label className="text-xs">{label}</Label>
      <Input value={(d[k] as string) ?? ''} onChange={(e) => patch({ [k]: e.target.value })} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{item.title || 'Flight'}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <F label="Airline" k="airline" placeholder="IndiGo" />
        <F label="Flight no." k="flight_number" placeholder="6E-1473" />
        <F label="From" k="origin" placeholder="DEL" />
        <F label="To" k="destination" placeholder="DPS" />
        <div className="space-y-1">
          <Label className="text-xs">Departs</Label>
          <Input type="datetime-local" value={d.depart_at ?? ''} onChange={(e) => patch({ depart_at: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Arrives</Label>
          <Input type="datetime-local" value={d.arrive_at ?? ''} onChange={(e) => patch({ arrive_at: e.target.value })} />
        </div>
        <F label="Duration" k="duration" placeholder="5h 35m" />
        <F label="Layover" k="layover" placeholder="2h in KUL / nonstop" />
        <F label="Operated by (codeshare)" k="operated_by" placeholder="Scoot" />
        <F label="Fare type" k="fare_type" placeholder="Saver / Flexi" />
        <F label="Baggage" k="baggage" w="sm:col-span-2" placeholder="20kg check-in + 7kg cabin" />
      </div>
    </div>
  );
}

function FlightParseButton({
  update,
  newItem,
}: {
  update: StepProps['update'];
  newItem: (type: ItemType, title?: string, details?: Record<string, unknown>) => ItemRow;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('text', text);
      files.forEach((f) => form.append('files', f));
      const res = await fetch('/api/flights/parse', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Parse failed');
      const flights = (body.flights ?? []) as (FlightDetails & { price?: number | null })[];
      if (flights.length === 0) throw new Error('No flights found in the text');
      update((dd) => ({
        ...dd,
        items: [
          ...dd.items,
          ...flights.map((f) => {
            const { price, ...details } = f;
            const item = newItem('flight', flightTitle(details), details as Record<string, unknown>);
            return { ...item, cost_amount: price ?? null };
          }),
        ],
      }));
      setOpen(false);
      setText('');
      setFiles([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wand2 className="h-4 w-4 mr-1" /> AI parse
      </Button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-background rounded-xl shadow-xl max-w-2xl w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">Paste flight details</h3>
        <p className="text-sm text-muted-foreground">
          Paste text (airline email, GDS dump, WhatsApp) and/or attach booking screenshots or a PDF —
          segments, timings, layovers, fare type and baggage get extracted.
        </p>
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste here…" />
        <div className="space-y-1">
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:bg-background file:text-sm file:font-medium hover:file:bg-muted file:cursor-pointer"
          />
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {files.map((f) => f.name).join(', ')}{' '}
              <button className="underline" onClick={() => setFiles([])}>clear</button>
            </p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={() => void parse()} disabled={busy || (text.trim().length < 10 && files.length === 0)}>
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
            Parse flights
          </Button>
        </div>
      </div>
    </div>
  );
}
