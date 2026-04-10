'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, ItineraryDay, ItineraryActivity, Hotel, Supplier, Flight, DayType } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Wand2, Loader2, AlertTriangle, GripVertical, CalendarPlus, Save, CheckCircle2, XCircle } from 'lucide-react';

interface ItinerarySectionProps {
  proposal: Proposal;
  itineraryDays: ItineraryDay[];
  setItineraryDays: (days: ItineraryDay[]) => void;
  activities: ItineraryActivity[];
  setActivities: (activities: ItineraryActivity[]) => void;
  hotels: Hotel[];
  flights: Flight[];
  suppliers: Supplier[];
  setHasUnsavedChanges: (v: boolean) => void;
  onDirtyChange: (v: boolean) => void;
}

const ACTIVITY_TYPES = [
  { value: 'transfer', label: 'Transfer' },
  { value: 'sightseeing', label: 'Sightseeing' },
  { value: 'meal', label: 'Meal' },
  { value: 'activity', label: 'Activity' },
  { value: 'free_time', label: 'Free Time' },
  { value: 'other', label: 'Other' },
];

const OPTION_MODES = [
  { value: 'pvt_only', label: 'Private' },
  { value: 'sic_only', label: 'SIC' },
  { value: 'tbd', label: 'TBD' },
  { value: 'dual', label: 'Dual (Pvt + SIC)' },
];

const DAY_TYPE_OPTIONS: { value: DayType; label: string }[] = [
  { value: 'arrival', label: 'Arrival' },
  { value: 'tour', label: 'Tour' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'flight', label: 'Flight' },
  { value: 'departure', label: 'Departure' },
];

const DAY_TYPE_BADGE: Record<DayType, string> = {
  arrival: 'bg-teal-100 text-teal-700 border-teal-200',
  tour: 'bg-purple-100 text-purple-700 border-purple-200',
  transfer: 'bg-amber-100 text-amber-700 border-amber-200',
  flight: 'bg-blue-100 text-blue-700 border-blue-200',
  departure: 'bg-rose-100 text-rose-700 border-rose-200',
};

function getNextCity(days: ItineraryDay[], dayNumber: number): string | undefined {
  const next = days.find(d => d.day_number === dayNumber + 1);
  return next?.city || undefined;
}

function getDayTypeTemplate(type: DayType, city: string, nextCity?: string): { heading: string; description: string } | null {
  switch (type) {
    case 'arrival':
      return {
        heading: `Arrival in ${city}`,
        description: `Upon arrival at ${city} airport, you will be warmly greeted by your guide and transferred to your hotel. After check-in, take some time to freshen up and settle in. Spend the rest of the day exploring the local neighbourhood at your own pace.`,
      };
    case 'departure':
      return {
        heading: `Departure from ${city}`,
        description: `After a leisurely breakfast at the hotel, complete your checkout formalities. Transfer to the airport for your departure flight, carrying with you a treasure trove of memories from this wonderful journey.`,
      };
    case 'transfer':
      return {
        heading: nextCity ? `Transfer to ${nextCity}` : 'Transfer Day',
        description: `Morning at leisure in ${city} with optional sightseeing before checkout.${nextCity ? ` Transfer to ${nextCity} by road/rail. Upon arrival in ${nextCity}, check into your hotel and take the evening to explore your new surroundings.` : ' Proceed to your next destination and check in to your hotel upon arrival.'}`,
      };
    case 'flight':
      return {
        heading: nextCity ? `Flying to ${nextCity}` : 'Flight Day',
        description: `After breakfast and hotel checkout in ${city}, transfer to the airport for your onward flight${nextCity ? ` to ${nextCity}` : ''}. Arrive and transfer to your hotel for check-in. Spend the evening settling in and exploring the area.`,
      };
    case 'tour':
      return null; // No template for tour — leave existing content unchanged
  }
}

// Auto-assign day_type for a set of days based on city transitions and flights
function computeDayType(
  day: ItineraryDay,
  days: ItineraryDay[],
  flights: Flight[],
): DayType {
  const totalDays = days.length;
  if (day.day_number === 1) return 'arrival';
  if (day.day_number === totalDays) return 'departure';

  const prevDay = days.find(d => d.day_number === day.day_number - 1);
  const prevCity = prevDay?.city;
  const thisCity = day.city;

  if (prevCity && thisCity && prevCity.toLowerCase() !== thisCity.toLowerCase()) {
    const isFlightRoute = flights.some(f => {
      const origin = (f.origin_city || '').toLowerCase();
      const dest = (f.destination_city || '').toLowerCase();
      const prev = prevCity.toLowerCase();
      const curr = thisCity.toLowerCase();
      return (origin.includes(prev) || prev.includes(origin)) &&
             (dest.includes(curr) || curr.includes(dest)) &&
             origin.length > 0 && dest.length > 0;
    });
    return isFlightRoute ? 'flight' : 'transfer';
  }
  return 'tour';
}

export function ItinerarySection({
  proposal, itineraryDays, setItineraryDays, activities, setActivities,
  hotels, flights, suppliers, setHasUnsavedChanges, onDirtyChange,
}: ItinerarySectionProps) {
  const supabase = createClient();
  const [generatingDay, setGeneratingDay] = useState<string | null>(null);
  const [generatingDays, setGeneratingDays] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [dirty, setDirty] = useState(false);

  // Keep parent in sync with dirty state
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  // City assignment from trip_cities
  const tripCities = proposal.trip_cities || [];
  function getCityFromTripCities(dayNumber: number): string {
    if (!tripCities.length) return '';
    let acc = 0;
    for (const c of tripCities) {
      acc += c.nights;
      if (dayNumber <= acc) return c.city;
    }
    return tripCities[tripCities.length - 1].city;
  }

  function tripDateRange(): string[] {
    if (!proposal.travel_start || !proposal.travel_end) return [];
    const start = new Date(proposal.travel_start);
    const end = new Date(proposal.travel_end);
    if (end < start) return [];
    const dates: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  // Run auto-assign on days that have null day_type (e.g. days imported before this feature)
  useEffect(() => {
    const needsAssignment = itineraryDays.some(d => !d.day_type);
    if (!needsAssignment || itineraryDays.length === 0) return;
    const updated = itineraryDays.map(day => ({
      ...day,
      day_type: day.day_type || computeDayType(day, itineraryDays, flights),
    }));
    setItineraryDays(updated);
    // Don't mark as dirty — this is a silent correction on load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateMissingDays() {
    const range = tripDateRange();
    if (range.length === 0) return;
    setGeneratingDays(true);
    try {
      const existingDates = new Set(itineraryDays.map(d => d.date));
      const missing = range.filter(d => !existingDates.has(d));
      if (missing.length === 0) { setGeneratingDays(false); return; }

      const rows = missing.map(date => {
        const dayNum = range.indexOf(date) + 1;
        const city = getCityFromTripCities(dayNum) || undefined;
        return { proposal_id: proposal.id, day_number: dayNum, date, city };
      });
      const { data: inserted } = await supabase
        .from('itinerary_days')
        .insert(rows)
        .select();
      if (inserted) {
        const merged = [...itineraryDays, ...(inserted as ItineraryDay[])]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((d, i) => ({ ...d, day_number: i + 1 }));

        // Auto-assign day_type for all days
        const withTypes = merged.map(day => ({
          ...day,
          day_type: day.day_type || computeDayType(day, merged, flights),
        }));

        // Persist renumbered day_number
        for (const d of withTypes) {
          const orig = [...itineraryDays, ...(inserted as ItineraryDay[])].find(o => o.id === d.id);
          if (orig && orig.day_number !== d.day_number) {
            await supabase.from('itinerary_days').update({ day_number: d.day_number, day_type: d.day_type }).eq('id', d.id);
          }
        }
        setItineraryDays(withTypes);
        setHasUnsavedChanges(true);
        setDirty(true);
      }
    } finally {
      setGeneratingDays(false);
    }
  }

  useEffect(() => {
    const range = tripDateRange();
    if (range.length > 0 && itineraryDays.length === 0 && !generatingDays) {
      generateMissingDays();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getDayActivities(dayId: string) {
    return activities.filter(a => a.itinerary_day_id === dayId).sort((a, b) => a.sort_order - b.sort_order);
  }

  function getCityForDate(date: string): string {
    const hotel = hotels.find(h => h.check_in <= date && h.check_out > date);
    return hotel?.city || '';
  }

  function updateDay(index: number, updates: Partial<ItineraryDay>) {
    const updated = [...itineraryDays];
    updated[index] = { ...updated[index], ...updates };
    setItineraryDays(updated);
    setHasUnsavedChanges(true);
    setDirty(true);
  }

  function changeDayType(index: number, newType: DayType) {
    const day = itineraryDays[index];
    const city = day.city || getCityFromTripCities(day.day_number) || getCityForDate(day.date) || '';
    const nextCity = getNextCity(itineraryDays, day.day_number);

    if (day.heading || day.description) {
      if (!confirm('Changing day type will reset this day\'s content. Continue?')) return;
    }

    const template = getDayTypeTemplate(newType, city, nextCity);
    updateDay(index, {
      day_type: newType,
      ...(template ? { heading: template.heading, description: template.description } : {}),
    });
  }

  async function saveAllDays() {
    if (itineraryDays.length === 0) return;
    setSavingItinerary(true);
    setSaveResult(null);
    try {
      const updates = itineraryDays.map(day =>
        supabase.from('itinerary_days').update({
          heading: day.heading,
          description: day.description,
          city: day.city,
          overnight_city: day.overnight_city,
          day_type: day.day_type,
        }).eq('id', day.id)
      );
      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error);
      if (hasError) {
        setSaveResult('error');
      } else {
        setDirty(false);
        setSaveResult('success');
        setTimeout(() => setSaveResult(null), 3000);
      }
    } catch {
      setSaveResult('error');
    } finally {
      setSavingItinerary(false);
    }
  }

  async function generateDayContent(index: number) {
    const day = itineraryDays[index];
    setGeneratingDay(day.id);
    try {
      const dayActivities = getDayActivities(day.id);
      const body: Record<string, unknown> = {
        day_number: day.day_number,
        destination: proposal.destination,
        city: day.city || getCityForDate(day.date),
        hotel: hotels.find(h => h.check_in <= day.date && h.check_out > day.date)?.name,
        activities: dayActivities.map(a => a.details),
        raw_description: day.raw_description || null,
      };
      // Feature 3: if heading already exists, use it as seed; don't overwrite
      if (day.heading && !day.raw_description) {
        body.existing_heading = day.heading;
      }
      const res = await fetch('/api/ai/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (day.heading && !day.raw_description) {
        // Only update description — preserve the existing heading
        updateDay(index, { description: data.description });
      } else {
        updateDay(index, { heading: data.heading, description: data.description });
      }
    } finally {
      setGeneratingDay(null);
    }
  }

  async function addActivity(dayId: string) {
    const dayActivities = getDayActivities(dayId);
    const { data } = await supabase.from('itinerary_activities').insert({
      itinerary_day_id: dayId,
      proposal_id: proposal.id,
      type: 'activity',
      option_mode: 'pvt_only',
      sort_order: dayActivities.length,
      details: {},
    }).select().single();
    if (data) {
      setActivities([...activities, data as ItineraryActivity]);
      setHasUnsavedChanges(true);
    }
  }

  function updateActivity(activityId: string, updates: Partial<ItineraryActivity>) {
    setActivities(activities.map(a => a.id === activityId ? { ...a, ...updates } : a));
    setHasUnsavedChanges(true);
  }

  async function deleteActivity(activityId: string) {
    await supabase.from('itinerary_activities').delete().eq('id', activityId);
    setActivities(activities.filter(a => a.id !== activityId));
    setHasUnsavedChanges(true);
  }

  async function saveActivity(act: ItineraryActivity) {
    await supabase.from('itinerary_activities').update({
      type: act.type,
      option_mode: act.option_mode,
      pvt_cp: act.pvt_cp,
      pvt_sp: act.pvt_sp,
      pvt_basis: act.pvt_basis,
      pvt_vehicle_type: act.pvt_vehicle_type,
      sic_cp: act.sic_cp,
      sic_sp: act.sic_sp,
      sic_basis: act.sic_basis,
      start_time: act.start_time,
      end_time: act.end_time,
      location: act.location,
      details: act.details,
      is_optional: act.is_optional,
      supplier_id: act.supplier_id,
      conflict_acknowledged: act.conflict_acknowledged,
    }).eq('id', act.id);
  }

  const expectedDayCount = tripDateRange().length;
  const missingDayCount = expectedDayCount - itineraryDays.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Day-wise Itinerary ({itineraryDays.length} days)
          {dirty && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />}
        </h2>
        <div className="flex items-center gap-2">
          {expectedDayCount > 0 && missingDayCount > 0 && (
            <Button size="sm" variant="outline" onClick={generateMissingDays} disabled={generatingDays}>
              {generatingDays ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CalendarPlus className="h-3 w-3 mr-1" />}
              Generate {missingDayCount} missing day{missingDayCount !== 1 ? 's' : ''}
            </Button>
          )}
          {itineraryDays.length > 0 && (
            <Button size="sm" onClick={saveAllDays} disabled={savingItinerary}>
              {savingItinerary
                ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                : saveResult === 'success'
                  ? <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                  : saveResult === 'error'
                    ? <XCircle className="h-3 w-3 mr-1 text-red-500" />
                    : <Save className="h-3 w-3 mr-1" />
              }
              {saveResult === 'success' ? 'Saved!' : saveResult === 'error' ? 'Error' : 'Save Itinerary'}
            </Button>
          )}
        </div>
      </div>

      {itineraryDays.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {expectedDayCount > 0
                ? `No itinerary days yet. Trip is ${expectedDayCount} day${expectedDayCount !== 1 ? 's' : ''} long.`
                : 'Set travel start and end dates in Trip Summary to generate itinerary days.'}
            </p>
            {expectedDayCount > 0 && (
              <Button size="sm" onClick={generateMissingDays} disabled={generatingDays}>
                {generatingDays ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CalendarPlus className="h-3 w-3 mr-1" />}
                Generate {expectedDayCount} day{expectedDayCount !== 1 ? 's' : ''}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {itineraryDays.map((day, index) => {
        const city = day.city || getCityFromTripCities(day.day_number) || getCityForDate(day.date);
        const dayActivities = getDayActivities(day.id);
        const dayType = day.day_type;

        return (
          <Card key={day.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    Day {day.day_number} — {day.date} {city && `| ${city}`}
                  </CardTitle>
                  {dayType && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${DAY_TYPE_BADGE[dayType]}`}>
                      {dayType.charAt(0).toUpperCase() + dayType.slice(1)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Day type override */}
                  <select
                    className="h-7 rounded border px-2 text-xs bg-background"
                    value={dayType || ''}
                    onChange={(e) => {
                      if (e.target.value) changeDayType(index, e.target.value as DayType);
                    }}
                    title="Override day type"
                  >
                    <option value="">— type —</option>
                    {DAY_TYPE_OPTIONS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={() => generateDayContent(index)} disabled={generatingDay === day.id}>
                    {generatingDay === day.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                    AI Generate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Heading</Label>
                  <Input
                    value={day.heading || ''}
                    onChange={(e) => updateDay(index, { heading: e.target.value })}
                    placeholder="e.g., Arrival in Dubai"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={city} onChange={(e) => updateDay(index, { city: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={day.description || ''}
                  onChange={(e) => updateDay(index, { description: e.target.value })}
                  rows={3}
                  placeholder={day.heading ? 'Click AI Generate to fill from heading, or write manually.' : 'Enter itinerary description or use AI Generate.'}
                />
              </div>

              {/* Activities */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Activities ({dayActivities.length})
                    {(dayType === 'transfer' || dayType === 'flight') && (
                      <span className="ml-1 text-xs text-muted-foreground">(before / after transfer)</span>
                    )}
                  </Label>
                  <Button size="sm" variant="outline" onClick={() => addActivity(day.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Activity
                  </Button>
                </div>
                {dayActivities.map((act) => (
                  <div key={act.id} className="p-3 border rounded-md space-y-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <select className="h-8 rounded border px-2 text-sm" value={act.type} onChange={(e) => updateActivity(act.id, { type: e.target.value as ItineraryActivity['type'] })}>
                        {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <select className="h-8 rounded border px-2 text-sm" value={act.option_mode || ''} onChange={(e) => updateActivity(act.id, { option_mode: e.target.value as ItineraryActivity['option_mode'] })}>
                        {OPTION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      {act.option_mode === 'tbd' && <Badge className="bg-orange-100 text-orange-700">TBD</Badge>}
                      {act.conflict_flagged && !act.conflict_acknowledged && (
                        <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" /> Conflict</Badge>
                      )}
                      <div className="flex-1" />
                      <div className="flex items-center gap-1">
                        <Switch checked={act.is_optional} onCheckedChange={(v) => updateActivity(act.id, { is_optional: v })} />
                        <span className="text-xs">Optional</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => saveActivity(act)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteActivity(act.id)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Start Time</Label>
                        <Input type="time" value={act.start_time || ''} onChange={(e) => updateActivity(act.id, { start_time: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">End Time</Label>
                        <Input type="time" value={act.end_time || ''} onChange={(e) => updateActivity(act.id, { end_time: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Location</Label>
                        <Input value={act.location || ''} onChange={(e) => updateActivity(act.id, { location: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Supplier</Label>
                        <select className="w-full h-8 rounded border px-2 text-sm" value={act.supplier_id || ''} onChange={(e) => updateActivity(act.id, { supplier_id: e.target.value || null })}>
                          <option value="">None</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {(act.option_mode === 'pvt_only' || act.option_mode === 'dual') && (
                      <div className="grid grid-cols-4 gap-2 pl-4">
                        <span className="text-xs font-medium self-center">Private:</span>
                        <Input type="number" step="0.01" placeholder="CP" value={act.pvt_cp ?? ''} onChange={(e) => updateActivity(act.id, { pvt_cp: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" />
                        <Input type="number" step="0.01" placeholder="SP" value={act.pvt_sp ?? ''} onChange={(e) => updateActivity(act.id, { pvt_sp: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" />
                        <Input placeholder="Vehicle type" value={act.pvt_vehicle_type || ''} onChange={(e) => updateActivity(act.id, { pvt_vehicle_type: e.target.value })} className="h-8 text-sm" />
                      </div>
                    )}
                    {(act.option_mode === 'sic_only' || act.option_mode === 'dual') && (
                      <div className="grid grid-cols-4 gap-2 pl-4">
                        <span className="text-xs font-medium self-center">SIC:</span>
                        <Input type="number" step="0.01" placeholder="CP" value={act.sic_cp ?? ''} onChange={(e) => updateActivity(act.id, { sic_cp: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" />
                        <Input type="number" step="0.01" placeholder="SP" value={act.sic_sp ?? ''} onChange={(e) => updateActivity(act.id, { sic_sp: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" />
                        <div />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
