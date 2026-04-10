'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, Flight, FlightLayover, Supplier } from '@/lib/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Search, Loader2, Check, Save, Wand2 } from 'lucide-react';

interface FlightsSectionProps {
  proposal: Proposal;
  flights: Flight[];
  setFlights: (flights: Flight[]) => void;
  suppliers: Supplier[];
  setHasUnsavedChanges: (v: boolean) => void;
}

export function FlightsSection({ proposal, flights, setFlights, suppliers, setHasUnsavedChanges }: FlightsSectionProps) {
  const supabase = createClient();
  const [lookingUp, setLookingUp] = useState<string | null>(null);
  const [sectionNA, setSectionNA] = useState(false);
  const [parsingPolicy, setParsingPolicy] = useState<string | null>(null);

  function updateFlight(index: number, updates: Partial<Flight>) {
    const updated = [...flights];
    updated[index] = { ...updated[index], ...updates };
    setFlights(updated);
    setHasUnsavedChanges(true);
  }

  function updateLayover(flightIndex: number, layoverIndex: number, updates: Partial<FlightLayover>) {
    const flight = flights[flightIndex];
    const layovers = [...(flight.layovers || [])];
    layovers[layoverIndex] = { ...layovers[layoverIndex], ...updates };
    updateFlight(flightIndex, { layovers });
  }

  function addLayover(flightIndex: number) {
    const flight = flights[flightIndex];
    const layovers: FlightLayover[] = [...(flight.layovers || []), { city: '', airport_code: '', duration_hours: 0, duration_minutes: 0 }];
    updateFlight(flightIndex, { layovers });
  }

  function removeLayover(flightIndex: number, layoverIndex: number) {
    const flight = flights[flightIndex];
    const layovers = (flight.layovers || []).filter((_, i) => i !== layoverIndex);
    updateFlight(flightIndex, { layovers });
  }

  async function addFlight() {
    const { data } = await supabase.from('flights').insert({
      proposal_id: proposal.id,
      flight_number: '',
      sort_order: flights.length,
    }).select().single();
    if (data) {
      setFlights([...flights, data as Flight]);
      setHasUnsavedChanges(true);
    }
  }

  async function deleteFlight(index: number) {
    await supabase.from('flights').delete().eq('id', flights[index].id);
    setFlights(flights.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  }

  async function lookupFlight(index: number) {
    const flight = flights[index];
    if (!flight.flight_number) return;
    setLookingUp(flight.id);
    try {
      const res = await fetch('/api/flights/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flight_number: flight.flight_number }),
      });
      const data = await res.json();
      if (data.airline) {
        updateFlight(index, {
          airline: data.airline,
          origin_iata: data.origin_iata,
          origin_city: data.origin_city,
          destination_iata: data.destination_iata,
          destination_city: data.destination_city,
          departure_at: data.departure_at,
          arrival_at: data.arrival_at,
          aircraft_type: data.aircraft_type,
        });
      }
    } finally {
      setLookingUp(null);
    }
  }

  const [savingFlight, setSavingFlight] = useState<string | null>(null);
  const [savedFlight, setSavedFlight] = useState<string | null>(null);

  async function saveFlight(index: number) {
    const f = flights[index];
    setSavingFlight(f.id);
    setSavedFlight(null);
    const toNull = (v: string | null | undefined) => (v === '' || v == null) ? null : v;
    const { error } = await supabase.from('flights').update({
      flight_number: f.flight_number,
      airline: toNull(f.airline),
      origin_iata: toNull(f.origin_iata),
      origin_city: toNull(f.origin_city),
      destination_iata: toNull(f.destination_iata),
      destination_city: toNull(f.destination_city),
      departure_at: toNull(f.departure_at),
      arrival_at: toNull(f.arrival_at),
      aircraft_type: toNull(f.aircraft_type),
      cabin_class: toNull(f.cabin_class),
      baggage_allowance: toNull(f.baggage_allowance),
      is_non_refundable: f.is_non_refundable,
      refundable_status: f.refundable_status || 'non_refundable',
      cancellation_policy_text: toNull(f.cancellation_policy_text),
      layovers: f.layovers || [],
      cp_total: f.cp_total,
      sp_total: f.sp_total,
      fare_expires_at: toNull(f.fare_expires_at),
      supplier_id: toNull(f.supplier_id),
    }).eq('id', f.id);
    setSavingFlight(null);
    if (!error) {
      setSavedFlight(f.id);
      setTimeout(() => setSavedFlight(null), 2000);
    }
  }

  if (sectionNA) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-2">Flights section marked as N/A</p>
          <Button variant="outline" size="sm" onClick={() => setSectionNA(false)}>Enable Flights</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Flights ({flights.length})</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSectionNA(true)}>N/A</Button>
          <Button size="sm" onClick={addFlight}><Plus className="h-4 w-4 mr-1" /> Add Flight</Button>
        </div>
      </div>

      {flights.map((flight, index) => {
        const layovers = flight.layovers || [];
        const hasLayovers = layovers.length > 0;

        return (
          <Card key={flight.id}>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Flight Number</Label>
                  <div className="flex gap-1">
                    <Input value={flight.flight_number} onChange={(e) => updateFlight(index, { flight_number: e.target.value })} placeholder="EK512" className="font-mono text-base" />
                    <Button size="sm" variant="outline" onClick={() => lookupFlight(index)} disabled={lookingUp === flight.id}>
                      {lookingUp === flight.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Airline</Label>
                  <Input value={flight.airline || ''} onChange={(e) => updateFlight(index, { airline: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input value={flight.origin_city || ''} onChange={(e) => updateFlight(index, { origin_city: e.target.value })} placeholder="City (IATA)" />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input value={flight.destination_city || ''} onChange={(e) => updateFlight(index, { destination_city: e.target.value })} placeholder="City (IATA)" />
                </div>
                <div className="space-y-2">
                  <Label>Departure</Label>
                  <Input type="datetime-local" value={flight.departure_at?.slice(0, 16) || ''} onChange={(e) => updateFlight(index, { departure_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Arrival</Label>
                  <Input type="datetime-local" value={flight.arrival_at?.slice(0, 16) || ''} onChange={(e) => updateFlight(index, { arrival_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cabin Class</Label>
                  <Input value={flight.cabin_class || ''} onChange={(e) => updateFlight(index, { cabin_class: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Baggage Allowance</Label>
                  <Input value={flight.baggage_allowance || ''} onChange={(e) => updateFlight(index, { baggage_allowance: e.target.value })} placeholder="e.g. 30kg checked + 7kg cabin" />
                </div>
                <div className="space-y-2">
                  <Label>Supplier (Airline)</Label>
                  <select className="w-full h-10 rounded-md border px-3 text-sm" value={flight.supplier_id || ''} onChange={(e) => updateFlight(index, { supplier_id: e.target.value || null })}>
                    <option value="">Select airline</option>
                    {suppliers.filter(s => s.type === 'airline').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">CP Total (internal)</Label>
                  <Input type="number" step="0.01" value={flight.cp_total ?? ''} onChange={(e) => updateFlight(index, { cp_total: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-2">
                  <Label>SP Total (client)</Label>
                  <Input type="number" step="0.01" value={flight.sp_total ?? ''} onChange={(e) => updateFlight(index, { sp_total: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-2">
                  <Label>Fare Expires</Label>
                  <Input type="datetime-local" value={flight.fare_expires_at?.slice(0, 16) || ''} onChange={(e) => updateFlight(index, { fare_expires_at: e.target.value })} />
                </div>
              </div>

              {/* Layover section */}
              <div className="space-y-3 p-3 border rounded-md bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={hasLayovers}
                      onCheckedChange={(v) => {
                        if (v) {
                          addLayover(index);
                        } else {
                          updateFlight(index, { layovers: [] });
                        }
                      }}
                    />
                    <Label className="text-sm font-medium">Has Layover?</Label>
                  </div>
                  {hasLayovers && (
                    <Button size="sm" variant="outline" onClick={() => addLayover(index)}>
                      <Plus className="h-3 w-3 mr-1" /> Add Layover
                    </Button>
                  )}
                </div>
                {hasLayovers && layovers.map((layover, li) => (
                  <div key={li} className="grid grid-cols-5 gap-2 items-end p-2 bg-white border rounded">
                    <div className="space-y-1">
                      <Label className="text-xs">Layover City</Label>
                      <Input
                        value={layover.city}
                        onChange={(e) => updateLayover(index, li, { city: e.target.value })}
                        placeholder="Dubai"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Airport Code</Label>
                      <Input
                        value={layover.airport_code}
                        onChange={(e) => updateLayover(index, li, { airport_code: e.target.value.toUpperCase() })}
                        placeholder="DXB"
                        className="h-8 text-sm font-mono"
                        maxLength={4}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hours</Label>
                      <Input
                        type="number"
                        min={0}
                        max={48}
                        value={layover.duration_hours}
                        onChange={(e) => updateLayover(index, li, { duration_hours: Number(e.target.value) })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Minutes</Label>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={layover.duration_minutes}
                        onChange={(e) => updateLayover(index, li, { duration_minutes: Number(e.target.value) })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeLayover(index, li)}>
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                ))}
                {hasLayovers && layovers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {layovers.map(l => `${l.city}${l.airport_code ? ` (${l.airport_code})` : ''} — ${l.duration_hours}h${l.duration_minutes > 0 ? ` ${l.duration_minutes}m` : ''}`).join(' → ')}
                  </p>
                )}
              </div>

              {/* Refundable status */}
              <div className="space-y-3 p-3 border rounded-md">
                <div className="space-y-2">
                  <Label>Refundability</Label>
                  <select
                    className="w-full h-10 rounded-md border px-3 text-sm"
                    value={flight.refundable_status || 'non_refundable'}
                    onChange={(e) => {
                      const val = e.target.value as Flight['refundable_status'];
                      updateFlight(index, {
                        refundable_status: val,
                        is_non_refundable: val === 'non_refundable',
                      });
                    }}
                  >
                    <option value="refundable">Refundable</option>
                    <option value="non_refundable">Non-Refundable</option>
                    <option value="partially_refundable">Partially Refundable</option>
                  </select>
                </div>
                {flight.refundable_status !== 'non_refundable' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Cancellation Policy Details</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={parsingPolicy === flight.id}
                        onClick={async () => {
                          const text = flight.cancellation_policy_text;
                          if (!text) return;
                          setParsingPolicy(flight.id);
                          try {
                            const res = await fetch('/api/ai/parse-policy', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ text }),
                            });
                            const data = await res.json();
                            if (data.cleaned) {
                              updateFlight(index, { cancellation_policy_text: data.cleaned });
                            }
                          } finally {
                            setParsingPolicy(null);
                          }
                        }}
                      >
                        {parsingPolicy === flight.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                        AI Parse
                      </Button>
                    </div>
                    <Textarea
                      value={flight.cancellation_policy_text || ''}
                      onChange={(e) => updateFlight(index, { cancellation_policy_text: e.target.value })}
                      placeholder="Paste cancellation policy text here..."
                      rows={3}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => saveFlight(index)} disabled={savingFlight === flight.id}>
                    {savingFlight === flight.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : savedFlight === flight.id ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Save className="h-4 w-4 mr-1" />}
                    {savedFlight === flight.id ? 'Saved' : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteFlight(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {flights.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No flights added yet</CardContent></Card>
      )}
    </div>
  );
}
