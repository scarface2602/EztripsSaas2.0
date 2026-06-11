'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AsyncCombobox, type AsyncOption } from '@/components/ui/async-combobox';
import { Minus, Plus, Trash2, ArrowUp, ArrowDown, ImageIcon, Upload, Loader2 } from 'lucide-react';
import { CURRENCY_OPTIONS } from '@/lib/utils/pricing';
import type { BuilderData, DestinationRow } from '../types';

interface StepProps {
  data: BuilderData;
  update: (patch: Partial<BuilderData> | ((d: BuilderData) => BuilderData)) => void;
  proposalId?: string;
}

export function TripStep({ data, update, proposalId }: StepProps) {
  const { proposal, destinations } = data;
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  // Scopes city search + inline create.
  const [country, setCountry] = useState<AsyncOption | null>(null);
  const countryCode = country ? String(country.id) : '';
  const [client, setClient] = useState<AsyncOption | null>(null);

  useEffect(() => {
    fetch('/api/geo/countries')
      .then((r) => r.json())
      .then((d) => setCountries(d.countries ?? []))
      .catch(() => {});
  }, []);

  // Hydrate the client combobox label on first load.
  useEffect(() => {
    if (!proposal.client_id || client) return;
    fetch(`/api/clients/${proposal.client_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setClient({ id: c.id, label: c.full_name, description: c.phone ?? undefined }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.client_id]);

  const setProposal = (patch: Partial<BuilderData['proposal']>) =>
    update((d) => ({ ...d, proposal: { ...d.proposal, ...patch } }));

  const setDest = (id: string, patch: Partial<DestinationRow>) =>
    update((d) => ({
      ...d,
      destinations: d.destinations.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));

  const move = (id: string, dir: -1 | 1) =>
    update((d) => {
      const sorted = [...d.destinations].sort((a, b) => a.sort_order - b.sort_order);
      const i = sorted.findIndex((x) => x.id === id);
      const j = i + dir;
      if (j < 0 || j >= sorted.length) return d;
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      return { ...d, destinations: sorted.map((x, k) => ({ ...x, sort_order: k })) };
    });

  const totalNights = destinations.reduce((s, x) => s + x.nights, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Trip Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Proposal title</Label>
            <Input
              value={proposal.title ?? ''}
              onChange={(e) => setProposal({ title: e.target.value || null })}
              placeholder="e.g. Bali Honeymoon — 6N"
            />
          </div>
          <div className="space-y-2">
            <Label>Customer</Label>
            <AsyncCombobox
              value={client}
              onSelect={(opt) => {
                setClient(opt);
                setProposal({ client_id: opt ? String(opt.id) : null });
              }}
              search={async (q) => {
                const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}`);
                const list = res.ok ? await res.json() : [];
                return (list as { id: string; full_name: string; phone: string | null }[])
                  .slice(0, 8)
                  .map((c) => ({ id: c.id, label: c.full_name, description: c.phone ?? undefined }));
              }}
              onCreate={async (name) => {
                const res = await fetch('/api/clients', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ full_name: name }),
                });
                if (!res.ok) return null;
                const c = await res.json();
                return { id: c.id, label: c.full_name };
              }}
              placeholder="Search or add customer…"
            />
          </div>
          <div className="space-y-2">
            <Label>Travel start</Label>
            <Input
              type="date"
              value={proposal.travel_start ?? ''}
              onChange={(e) => setProposal({ travel_start: e.target.value || null })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <div className="space-y-2">
              <Label>Adults</Label>
              <Input
                type="number" min={0}
                value={proposal.pax_adults}
                onChange={(e) => setProposal({ pax_adults: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Children</Label>
              <Input
                type="number" min={0}
                value={proposal.pax_children}
                onChange={(e) => setProposal({ pax_children: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={proposal.currency} onValueChange={(v) => setProposal({ currency: v ?? 'INR' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Route — cities &amp; nights</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Country</Label>
            <AsyncCombobox
              className="w-52"
              value={country}
              onSelect={setCountry}
              minChars={0}
              search={async (q) => {
                const ql = q.trim().toLowerCase();
                return countries
                  .filter((c) => !ql || c.name.toLowerCase().includes(ql) || c.code.toLowerCase() === ql)
                  .slice(0, 12)
                  .map((c) => ({ id: c.code, label: c.name }));
              }}
              placeholder="Search country…"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...destinations].sort((a, b) => a.sort_order - b.sort_order).map((dest, i, arr) => (
            <div key={dest.id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
              <div className="flex-1 font-medium text-sm">
                {dest.city_name}
                {dest.country_code && (
                  <span className="text-xs text-muted-foreground ml-1">({dest.country_code})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setDest(dest.id, { nights: Math.max(0, dest.nights - 1) })}
                ><Minus className="h-3 w-3" /></Button>
                <span className="w-12 text-center text-sm">{dest.nights}N</span>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setDest(dest.id, { nights: dest.nights + 1 })}
                ><Plus className="h-3 w-3" /></Button>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(dest.id, -1)}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === arr.length - 1} onClick={() => move(dest.id, 1)}>
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                onClick={() => update((d) => ({ ...d, destinations: d.destinations.filter((x) => x.id !== dest.id) }))}
              ><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}

          <AsyncCombobox
            value={null}
            onSelect={(opt) => {
              if (!opt) return;
              const meta = opt as AsyncOption & { country_code?: string; city_id?: number };
              update((d) => ({
                ...d,
                destinations: [
                  ...d.destinations,
                  {
                    id: crypto.randomUUID(),
                    city_id: meta.city_id ?? null,
                    city_name: opt.label,
                    country_code: meta.country_code ?? (countryCode || null),
                    nights: 1,
                    sort_order: d.destinations.length,
                  },
                ],
              }));
            }}
            search={async (q) => {
              const params = new URLSearchParams({ q });
              if (countryCode) params.set('country', countryCode);
              const res = await fetch(`/api/geo/cities?${params}`);
              const d = res.ok ? await res.json() : { cities: [] };
              return (d.cities as { id: number; name: string; country_name: string | null; country_code: string; state_region: string | null }[]).map((c) => ({
                id: c.id,
                label: c.name,
                description: [c.state_region, c.country_name].filter(Boolean).join(', '),
                city_id: c.id,
                country_code: c.country_code,
              }));
            }}
            onCreate={
              countryCode
                ? async (name) => {
                    const res = await fetch('/api/geo/cities', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name, country_code: countryCode }),
                    });
                    if (!res.ok) return null;
                    const { city } = await res.json();
                    return { id: city.id, label: city.name, city_id: city.id, country_code: city.country_code } as AsyncOption;
                  }
                : undefined
            }
            placeholder={countryCode ? 'Add a city…' : 'Search any city (pick a country to add new ones)…'}
          />

          {totalNights > 0 && (
            <p className="text-sm text-muted-foreground">
              {totalNights} nights total — {destinations.filter((d) => d.nights > 0).map((d) => `${d.nights}N ${d.city_name}`).join(' + ')}
              {proposal.travel_start && proposal.travel_end && ` · ${proposal.travel_start} → ${proposal.travel_end}`}
            </p>
          )}
        </CardContent>
      </Card>

      {proposalId && (
        <CoverImageCard
          proposalId={proposalId}
          url={proposal.cover_image_url}
          onChange={(cover_image_url) => setProposal({ cover_image_url })}
        />
      )}

      {proposalId && <PastItineraryPanel proposalId={proposalId} cities={destinations.map((d) => d.city_name)} />}
    </div>
  );
}

// Cover photo for the share page + PDF cover. Upload a fresh one or
// reuse any cover from past proposals (the library).
function CoverImageCard({
  proposalId,
  url,
  onChange,
}: {
  proposalId: string;
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [library, setLibrary] = useState<{ url: string; label: string }[] | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/proposals/${proposalId}/upload-cover`, { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Upload failed');
      onChange(body.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function openLibrary() {
    setShowLibrary((s) => !s);
    if (library) return;
    try {
      const res = await fetch('/api/proposals/cover-library');
      const d = res.ok ? await res.json() : { images: [] };
      setLibrary(d.images ?? []);
    } catch {
      setLibrary([]);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4" /> Cover image
          <span className="text-xs font-normal text-muted-foreground">(share page &amp; PDF cover)</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-sm font-medium hover:bg-muted cursor-pointer">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
          </label>
          <Button variant="outline" size="sm" onClick={() => void openLibrary()}>
            {showLibrary ? 'Hide library' : 'Choose from library'}
          </Button>
          {url && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Cover" className="w-full max-h-56 object-cover rounded-lg border" />
        ) : (
          <p className="text-sm text-muted-foreground">No cover yet — the PDF falls back to a plain banner.</p>
        )}
        {showLibrary && (
          library === null ? (
            <p className="text-sm text-muted-foreground">Loading library…</p>
          ) : library.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past covers yet — upload one and it joins the library.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {library.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  title={img.label}
                  className={`relative rounded-md overflow-hidden border hover:ring-2 hover:ring-primary ${img.url === url ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => onChange(img.url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.label || 'Cover option'} className="h-20 w-full object-cover" />
                </button>
              ))}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

// Reusable itineraries: clone a past proposal's route, stays, days and
// blocks into this draft. Smart matches come from the suggestion engine
// once cities are picked; the search box covers everything else.
function PastItineraryPanel({ proposalId, cities }: { proposalId: string; cities: string[] }) {
  type Match = { id: string; title: string | null; destination: string | null; route_signature?: string | null };
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Match[]>([]);
  const [copying, setCopying] = useState<string | null>(null);
  const citiesKey = cities.join(',');

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        if (query.trim().length >= 2) {
          const supabase = (await import('@/lib/supabase/client')).createClient();
          const { data } = await supabase
            .from('proposals')
            .select('id, title, destination, route_signature')
            .or(`title.ilike.%${query.trim()}%,destination.ilike.%${query.trim()}%`)
            .neq('id', proposalId)
            .order('created_at', { ascending: false })
            .limit(6);
          setResults((data as Match[]) ?? []);
        } else if (citiesKey) {
          const params = new URLSearchParams({ cities: citiesKey, destination: cities[0] ?? '' });
          const res = await fetch(`/api/proposals/suggestions?${params}`);
          const d = res.ok ? await res.json() : { suggestions: [] };
          setResults(((d.suggestions ?? []) as Match[]).filter((m) => m.id !== proposalId).slice(0, 6));
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, citiesKey, proposalId]);

  async function copyFrom(sourceId: string) {
    if (!confirm('Copy this itinerary into the current proposal? Existing cities, stays and days here will be replaced.')) return;
    setCopying(sourceId);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/v2/copy-from`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId }),
      });
      if (res.ok) window.location.reload();
      else setCopying(null);
    } catch {
      setCopying(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Start from a past itinerary</CardTitle>
        <Input
          className="w-64 h-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search past proposals…"
        />
      </CardHeader>
      {results.length > 0 && (
        <CardContent className="space-y-2">
          {results.map((m) => (
            <div key={m.id} className="flex items-center gap-3 text-sm border rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <span className="font-medium">{m.title || m.destination || 'Untitled'}</span>
                {m.route_signature && (
                  <span className="block text-xs text-muted-foreground truncate">{m.route_signature}</span>
                )}
              </div>
              <Button variant="outline" size="sm" disabled={!!copying} onClick={() => void copyFrom(m.id)}>
                {copying === m.id ? 'Copying…' : 'Use this'}
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Copies the route, stays, day-wise itinerary and price-group structure. Prices reset — you quote fresh.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
