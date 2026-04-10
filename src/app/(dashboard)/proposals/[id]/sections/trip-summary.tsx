'use client';

import { useState } from 'react';
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

interface TripSummarySectionProps {
  proposal: Proposal;
  updateProposal: (updates: Partial<Proposal>) => void;
}

export function TripSummarySection({ proposal, updateProposal }: TripSummarySectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const [naFields, setNaFields] = useState<Record<string, boolean>>({});
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
        .select('id, city, sort_order')
        .eq('proposal_id', proposal.id);
      const existing = (existingHotels || []) as Pick<Hotel, 'id' | 'city' | 'sort_order'>[];

      let created = 0;
      let updated = 0;
      let nextSort = existing.reduce((m, h) => Math.max(m, h.sort_order ?? 0), -1) + 1;

      for (const c of dated) {
        if (!c.city.trim()) continue;
        const match = existing.find(h => (h.city || '').trim().toLowerCase() === c.city.trim().toLowerCase());
        if (match) {
          await supabase
            .from('hotels')
            .update({ check_in: c.check_in, check_out: c.check_out })
            .eq('id', match.id);
          updated++;
        } else {
          await supabase.from('hotels').insert({
            proposal_id: proposal.id,
            name: 'New Hotel',
            city: c.city,
            check_in: c.check_in,
            check_out: c.check_out,
            sort_order: nextSort++,
          });
          created++;
        }
      }

      setApplyMsg(`Applied to hotels: ${created} created, ${updated} updated`);
      router.refresh();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Trip Summary</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Destination(s)</Label>
              <Input value={proposal.destination || ''} onChange={(e) => updateProposal({ destination: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={proposal.currency} onChange={(e) => updateProposal({ currency: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Travel Start</Label>
              <Input type="date" value={proposal.travel_start || ''} onChange={(e) => updateProposal({ travel_start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Travel End</Label>
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
              <Label>Children Ages (comma-separated)</Label>
              <Input
                value={(proposal.children_ages || []).join(', ')}
                onChange={(e) => updateProposal({
                  children_ages: e.target.value.split(',').map(a => parseInt(a.trim())).filter(a => !isNaN(a))
                })}
                placeholder="e.g., 5, 8, 12"
              />
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
                <Input
                  value={city.city}
                  onChange={(e) => updateCity(i, { city: e.target.value })}
                  placeholder="City name"
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
