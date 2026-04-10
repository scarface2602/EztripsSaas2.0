'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, ItineraryDay, ItineraryActivity, Hotel, Supplier } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Wand2, Loader2, AlertTriangle, GripVertical, CalendarPlus } from 'lucide-react';

interface ItinerarySectionProps {
  proposal: Proposal;
  itineraryDays: ItineraryDay[];
  setItineraryDays: (days: ItineraryDay[]) => void;
  activities: ItineraryActivity[];
  setActivities: (activities: ItineraryActivity[]) => void;
  hotels: Hotel[];
  suppliers: Supplier[];
  setHasUnsavedChanges: (v: boolean) => void;
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

export function ItinerarySection({
  proposal, itineraryDays, setItineraryDays, activities, setActivities,
  hotels, suppliers, setHasUnsavedChanges,
}: ItinerarySectionProps) {
  const supabase = createClient();
  const [generatingDay, setGeneratingDay] = useState<string | null>(null);
  const [generatingDays, setGeneratingDays] = useState(false);

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

  // Build the list of dates between travel_start and travel_end, inclusive of
  // both ends (matches the convention in /api/quotes/save: an N-night trip
  // yields N+1 days = arrival + nights + departure). Empty if dates missing.
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

  // Insert any missing day rows for the trip date range without touching
  // existing days (so user content is never overwritten).
  async function generateMissingDays() {
    const range = tripDateRange();
    if (range.length === 0) return;
    setGeneratingDays(true);
    try {
      const existingDates = new Set(itineraryDays.map(d => d.date));
      const missing = range.filter(d => !existingDates.has(d));
      if (missing.length === 0) {
        setGeneratingDays(false);
        return;
      }
      // day_number = position within the full range (1-based), so newly added
      // days slot in alongside any pre-existing ones in chronological order.
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
        // Persist renumbered day_number for any rows that changed
        for (const d of merged) {
          const orig = [...itineraryDays, ...(inserted as ItineraryDay[])].find(o => o.id === d.id);
          if (orig && orig.day_number !== d.day_number) {
            await supabase.from('itinerary_days').update({ day_number: d.day_number }).eq('id', d.id);
          }
        }
        setItineraryDays(merged);
        setHasUnsavedChanges(true);
      }
    } finally {
      setGeneratingDays(false);
    }
  }

  // Auto-generate days on load if travel dates set and days empty
  useEffect(() => {
    const range = tripDateRange();
    if (range.length > 0 && itineraryDays.length === 0 && !generatingDays) {
      generateMissingDays();
    }
  // Only run once on mount
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
  }

  async function saveDay(index: number) {
    const day = itineraryDays[index];
    await supabase.from('itinerary_days').update({
      heading: day.heading,
      description: day.description,
      city: day.city,
      overnight_city: day.overnight_city,
    }).eq('id', day.id);
  }

  async function generateDayContent(index: number) {
    const day = itineraryDays[index];
    setGeneratingDay(day.id);
    try {
      const dayActivities = getDayActivities(day.id);
      const res = await fetch('/api/ai/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: day.day_number,
          destination: proposal.destination,
          city: day.city || getCityForDate(day.date),
          hotel: hotels.find(h => h.check_in <= day.date && h.check_out > day.date)?.name,
          activities: dayActivities.map(a => a.details),
          raw_description: day.raw_description || day.description || null,
        }),
      });
      const data = await res.json();
      updateDay(index, { heading: data.heading, description: data.description });
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
        <h2 className="text-lg font-semibold">Day-wise Itinerary ({itineraryDays.length} days)</h2>
        {expectedDayCount > 0 && missingDayCount > 0 && (
          <Button size="sm" variant="outline" onClick={generateMissingDays} disabled={generatingDays}>
            {generatingDays ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CalendarPlus className="h-3 w-3 mr-1" />}
            Generate {missingDayCount} missing day{missingDayCount !== 1 ? 's' : ''} from trip dates
          </Button>
        )}
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

        return (
          <Card key={day.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Day {day.day_number} — {day.date} {city && `| ${city}`}
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => generateDayContent(index)} disabled={generatingDay === day.id}>
                    {generatingDay === day.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                    AI Generate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => saveDay(index)}>Save</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Heading</Label>
                  <Input value={day.heading || ''} onChange={(e) => updateDay(index, { heading: e.target.value })} placeholder="e.g., Arrival in Dubai" />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={city} onChange={(e) => updateDay(index, { city: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={day.description || ''} onChange={(e) => updateDay(index, { description: e.target.value })} rows={3} />
              </div>

              {/* Activities */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Activities ({dayActivities.length})</Label>
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

                    {/* Pricing rows */}
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
