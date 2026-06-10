'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, TripCity, Hotel } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { CURRENCY_OPTIONS } from '@/lib/utils/pricing';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { useLookup } from '@/lib/hooks/use-lookup';
import { useCityOptions, addCityToLookup } from '@/lib/hooks/use-city-options';

interface TripSummarySectionProps {
  proposal: Proposal;
  updateProposal: (updates: Partial<Proposal>) => void;
  setHotels?: (hotels: Hotel[]) => void;
}

export function TripSummarySection({ proposal, updateProposal, setHotels }: TripSummarySectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const [naFields, setNaFields] = useState<Record<string, boolean>>({});
  const { items: vehicleTypes } = useLookup('vehicle_type');
  const cityOptions = useCityOptions();

  const vehicleOptions = vehicleTypes.length > 0
    ? vehicleTypes.map(v => ({ value: v.value, label: v.label }))
    : [
        { value: 'hatchback', label: 'Hatchback' },
        { value: 'sedan', label: 'Sedan' },
        { value: 'muv', label: 'MUV' },
        { value: 'suv', label: 'SUV' },
        { value: 'luxury', label: 'Luxury' },
        { value: 'tempo_traveller', label: 'Tempo Traveller' },
        { value: 'tempo_traveller_urbania', label: 'Tempo Traveller Urbania' },
      ];
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  function toggleNA(field: string) {
    setNaFields(prev => ({ ...prev, [field]: !prev[field] }));
  }

  // Trip cities
  const cities: TripCity[] = proposal.trip_cities || [];

  function setCities(updated: TripCity[]) {
    updateProposal({ trip_cities: updated });
  }

  function addCity() {
    setCities([...cities, { city: '', nights: 1, check_in: '', check_out: '' }]);
  }

  function updateCity(index: number, updates: Partial<TripCity>) {
    const updated = [...cities];
    updated[index] = { ...updated[index], ...updates };
    setCities(updated);
  }

  function removeCity(index: number) {
    setCities(cities.filter((_, i) => i !== index));
  }

  // Calculate dates from city nights allocation
  function recalcCityDates(): TripCity[] {
    if (!proposal.travel_start) return cities;
    let current = new Date(proposal.travel_start);
    return cities.map(c => {
      const checkIn = current.toISOString().split('T')[0];
      current = new Date(current.getTime() + c.nights * 86400000);
      const checkOut = current.toISOString().split('T')[0];
      return { ...c, check_in: checkIn, check_out: checkOut };
    });
  }

  // Trip nights math
  const tripNights = proposal.travel_start && proposal.travel_end
    ? Math.round((new Date(proposal.travel_end).getTime() - new Date(proposal.travel_start).getTime()) / 86400000)
    : 0;
  const cityNightsTotal = cities.reduce((s, c) => s + (c.nights || 0), 0);
  const nightsMismatch = cities.length > 0 && tripNights > 0 && cityNightsTotal !== tripNights;

  // Apply city dates to hotels: persist trip_cities, then upsert a hotel row
  // for each city (match existing by city name; create placeholder otherwise).
  async function applyToHotels() {
    if (!proposal.travel_start) return;
    setApplying(true);
    setApplyMsg(null);
    try {
      const dated = recalcCityDates();
      setCities(dated);

      // Persist trip_cities on the proposal
      await fetch(`/api/proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_cities: dated }),
      });

      // Fetch existing hotels for this proposal
      const { data: existingHotels } = await supabase
        .from('hotels')
        .select('id, name, city, sort_order')
        .eq('proposal_id', proposal.id);
      const existing = (existingHotels || []) as Pick<Hotel, 'id' | 'name' | 'city' | 'sort_order'>[];

      let created = 0;
      let updated = 0;
      let nextSort = existing.reduce((m, h) => Math.max(m, h.sort_order ?? 0), -1) + 1;
      const matched = new Set<string>(); // track matched hotel IDs to avoid double-matching

      for (const c of dated) {
        if (!c.city.trim()) continue;
        const match = existing.find(h =>
          !matched.has(h.id) &&
          (h.city || '').trim().toLowerCase() === c.city.trim().toLowerCase()
        );
        if (match) {
          matched.add(match.id);
          await supabase
            .from('hotels')
            .update({ check_in: c.check_in, check_out: c.check_out })
            .eq('id', match.id);
          updated++;
        } else {
          await supabase.from('hotels').insert({
            proposal_id: proposal.id,
            name: `Hotel in ${c.city}`,
            city: c.city,
            check_in: c.check_in,
            check_out: c.check_out,
            sort_order: nextSort++,
          });
          created++;
        }
      }

      // Clean up unmatched placeholder hotels (duplicates from previous runs)
      const unmatched = existing.filter(h => !matched.has(h.id));
      let deleted = 0;
      for (const h of unmatched) {
        const isPlaceholder = h.name === 'New Hotel' || (h.name || '').startsWith('Hotel in ');
        const cityInStructure = dated.some(c => c.city.trim().toLowerCase() === (h.city || '').trim().toLowerCase());
        if (isPlaceholder || !cityInStructure) {
          await supabase.from('hotels').delete().eq('id', h.id);
          deleted++;
        }
      }

      setApplyMsg(`Applied to hotels: ${created} created, ${updated} updated${deleted > 0 ? `, ${deleted} duplicates removed` : ''}`);

      // Re-fetch hotels and update client state directly
      const { data: freshHotels } = await supabase
        .from('hotels')
        .select('*')
        .eq('proposal_id', proposal.id)
        .order('sort_order');
      if (freshHotels && setHotels) {
        setHotels(freshHotels as Hotel[]);
      }
      router.refresh();
    } finally {
      setApplying(false);
    }
  }

  // Client + trip meta stored in draft_data
  const draftData = (proposal.draft_data || {}) as Record<string, unknown>;
  const clientName = (draftData.client_name as string) || '';
  const clientEmail = (draftData.client_email as string) || '';
  const clientPhone = (draftData.client_phone as string) || '';
  const supplierName = (draftData.supplier_name as string) || '';
  const numRooms = (draftData.num_rooms as number | undefined) ?? '';
  const vehicleType = (draftData.vehicle_type as string) || '';
  const vehicleModel = (draftData.vehicle_model as string) || '';

  // Auto-fill client details from clients table when draft_data is empty
  const [clientFetched, setClientFetched] = useState(false);
  useEffect(() => {
    if (clientFetched || clientName || !proposal.client_id) return;
    (async () => {
      const { data: client } = await supabase
        .from('clients')
        .select('full_name, email, phone')
        .eq('id', proposal.client_id!)
        .single();
      if (client) {
        const updates: Record<string, unknown> = { ...(proposal.draft_data || {}) };
        if (!updates.client_name && client.full_name) updates.client_name = client.full_name;
        if (!updates.client_email && client.email) updates.client_email = client.email;
        if (!updates.client_phone && client.phone) updates.client_phone = client.phone;
        updateProposal({ draft_data: updates as Record<string, unknown> });
      }
      setClientFetched(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateDraftField(field: string, value: string) {
    updateProposal({
      draft_data: { ...(proposal.draft_data || {}), [field]: value } as Record<string, unknown>,
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Trip Summary</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input value={clientName} onChange={(e) => updateDraftField('client_name', e.target.value)} placeholder="Client full name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={clientEmail} onChange={(e) => updateDraftField('client_email', e.target.value)} placeholder="client@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input type="tel" value={clientPhone} onChange={(e) => updateDraftField('client_phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
          </div>

          {/* Proposal meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proposal Title</Label>
              <Input value={proposal.title || ''} onChange={(e) => updateProposal({ title: e.target.value || null })} placeholder="Trip to..." />
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input value={supplierName} onChange={(e) => updateDraftField('supplier_name', e.target.value)} placeholder="DMC / Supplier name" />
            </div>
            <div className="space-y-2">
              <Label>No. of Rooms</Label>
              <Input
                type="number"
                min={0}
                value={numRooms}
                onChange={(e) => updateProposal({ draft_data: { ...draftData, num_rooms: e.target.value ? Number(e.target.value) : undefined } } as Parameters<typeof updateProposal>[0])}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <CreatableCombobox
                value={vehicleType}
                onChange={(v) => updateDraftField('vehicle_type', v)}
                options={vehicleOptions}
                placeholder="Select or type vehicle type..."
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Model</Label>
              <Input
                value={vehicleModel}
                onChange={(e) => updateDraftField('vehicle_model', e.target.value)}
                placeholder="e.g. Dzire, Innova Crysta"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Destination(s) <span className="text-red-500">*</span></Label>
              <CreatableCombobox
                value={proposal.destination || ''}
                onChange={(v) => updateProposal({ destination: v })}
                options={cityOptions}
                onCreateNew={addCityToLookup}
                placeholder="Search or type destination..."
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={proposal.currency || 'INR'}
                onChange={(e) => updateProposal({ currency: e.target.value })}
              >
                {CURRENCY_OPTIONS.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Travel Start <span className="text-red-500">*</span></Label>
              <Input type="date" value={proposal.travel_start || ''} onChange={(e) => updateProposal({ travel_start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Travel End <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={proposal.travel_end || ''}
                min={proposal.travel_start ? new Date(new Date(proposal.travel_start).getTime() + 86400000).toISOString().split('T')[0] : undefined}
                onChange={(e) => updateProposal({ travel_end: e.target.value })}
              />
              {proposal.travel_start && proposal.travel_end && proposal.travel_end <= proposal.travel_start && (
                <p className="text-xs text-red-600">Travel end must be after travel start</p>
              )}
            </div>
          </div>

          {/* Nights display */}
          {proposal.travel_start && proposal.travel_end && proposal.travel_end > proposal.travel_start && (
            <div className="px-3 py-2 bg-muted/50 rounded-md text-sm font-medium">
              {Math.round((new Date(proposal.travel_end).getTime() - new Date(proposal.travel_start).getTime()) / 86400000)} Nights
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Adults</Label>
              <Input type="number" min={1} value={proposal.pax_adults} onChange={(e) => updateProposal({ pax_adults: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Children</Label>
              <Input type="number" min={0} value={proposal.pax_children} onChange={(e) => updateProposal({ pax_children: Number(e.target.value) })} />
            </div>
          </div>

          {proposal.pax_children > 0 && (
            <div className="space-y-2">
              <Label>Children Ages</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Array.from({ length: proposal.pax_children }, (_, i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Child {i + 1}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={17}
                      placeholder="Age"
                      value={(proposal.children_ages || [])[i] ?? ''}
                      onChange={(e) => {
                        const ages = [...(proposal.children_ages || Array(proposal.pax_children).fill(0))];
                        ages[i] = e.target.value ? parseInt(e.target.value) : 0;
                        updateProposal({ children_ages: ages });
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Per child CWB/CNB designation is set in the Hotels section</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Special Occasions</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">N/A</span>
                <Switch checked={naFields['special_notes'] || false} onCheckedChange={() => toggleNA('special_notes')} />
              </div>
            </div>
            {!naFields['special_notes'] && (
              <Textarea
                value={proposal.special_notes || ''}
                onChange={(e) => updateProposal({ special_notes: e.target.value })}
                placeholder="Honeymoon, anniversary, birthday..."
                rows={2}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dietary / Accessibility Notes</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">N/A</span>
                <Switch checked={naFields['dietary_notes'] || false} onCheckedChange={() => toggleNA('dietary_notes')} />
              </div>
            </div>
            {!naFields['dietary_notes'] && (
              <Textarea
                value={proposal.dietary_notes || ''}
                onChange={(e) => updateProposal({ dietary_notes: e.target.value })}
                placeholder="Vegetarian, wheelchair accessible..."
                rows={2}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trip Structure — city-based builder */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Trip Structure</CardTitle>
          <Button size="sm" variant="outline" onClick={addCity}>
            <Plus className="h-4 w-4 mr-1" /> Add City
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {tripNights > 0 && (
            <p className="text-sm text-muted-foreground">
              Total trip: {tripNights} night{tripNights !== 1 ? 's' : ''}
              {cities.length > 0 && ` | City allocation: ${cityNightsTotal} night${cityNightsTotal !== 1 ? 's' : ''}`}
            </p>
          )}

          {nightsMismatch && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800">
                City nights ({cityNightsTotal}) don&apos;t match trip nights ({tripNights}).
              </span>
            </div>
          )}

          {cities.map((city, i) => (
            <div key={i} className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">City {i + 1}</Label>
                <CreatableCombobox
                  value={city.city}
                  onChange={(v) => updateCity(i, { city: v })}
                  options={cityOptions}
                  onCreateNew={addCityToLookup}
                  placeholder="Select city..."
                />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">Nights</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={city.nights}
                  onChange={(e) => updateCity(i, { nights: Number(e.target.value) })}
                />
              </div>
              {city.check_in && (
                <div className="text-xs text-muted-foreground self-center">
                  {city.check_in} → {city.check_out}
                </div>
              )}
              <Button size="sm" variant="ghost" onClick={() => removeCity(i)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}

          {cities.length === 0 && (
            <p className="text-sm text-muted-foreground">No cities added. Add cities to define your trip structure.</p>
          )}

          {cities.length > 0 && proposal.travel_start && (
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={applyToHotels} disabled={applying}>
                {applying && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Calculate Dates &amp; Apply to Hotels
              </Button>
              {applyMsg && <span className="text-xs text-muted-foreground">{applyMsg}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
