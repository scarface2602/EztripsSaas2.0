'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, ItineraryDay, Hotel, Flight, DayType } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Wand2, Loader2, CalendarPlus } from 'lucide-react';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';

interface ItinerarySectionProps {
  proposal: Proposal;
  itineraryDays: ItineraryDay[];
  setItineraryDays: (days: ItineraryDay[]) => void;
  hotels: Hotel[];
  flights: Flight[];
}

const TRANSPORT_OPTIONS = [
  { value: 'SIC', label: 'SIC' },
  { value: 'PVT', label: 'PVT' },
  { value: 'N/A', label: 'N/A' },
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
      return null;
  }
}

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
  proposal, itineraryDays, setItineraryDays,
  hotels, flights,
}: ItinerarySectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [generatingDay, setGeneratingDay] = useState<string | null>(null);
  const [curatingDay, setCuratingDay] = useState<string | null>(null);
  const [generatingDays, setGeneratingDays] = useState(false);

  // ── Debounced auto-save per day on blur ────────────────────
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const daysRef = useRef(itineraryDays);
  daysRef.current = itineraryDays;

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, []);

  function scheduleDaySave(dayId: string) {
    if (saveTimers.current[dayId]) clearTimeout(saveTimers.current[dayId]);
    saveTimers.current[dayId] = setTimeout(async () => {
      const day = daysRef.current.find(d => d.id === dayId);
      if (!day) return;
      await supabase.from('itinerary_days').update({
        heading: day.heading,
        description: day.description,
        city: day.city,
        overnight_city: day.overnight_city,
        day_type: day.day_type,
      }).eq('id', day.id);
    }, 1500);
  }

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

  useEffect(() => {
    const needsAssignment = itineraryDays.some(d => !d.day_type);
    if (!needsAssignment || itineraryDays.length === 0) return;
    const updated = itineraryDays.map(day => ({
      ...day,
      day_type: day.day_type || computeDayType(day, itineraryDays, flights),
    }));
    setItineraryDays(updated);
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

        const withTypes = merged.map(day => ({
          ...day,
          day_type: day.day_type || computeDayType(day, merged, flights),
        }));

        for (const d of withTypes) {
          const orig = [...itineraryDays, ...(inserted as ItineraryDay[])].find(o => o.id === d.id);
          if (orig && orig.day_number !== d.day_number) {
            await supabase.from('itinerary_days').update({ day_number: d.day_number, day_type: d.day_type }).eq('id', d.id);
          }
        }
        setItineraryDays(withTypes);
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

  function getCityForDate(date: string): string {
    const hotel = hotels.find(h => h.check_in <= date && h.check_out > date);
    return hotel?.city || '';
  }

  function updateDay(index: number, updates: Partial<ItineraryDay>) {
    const updated = [...itineraryDays];
    updated[index] = { ...updated[index], ...updates };
    setItineraryDays(updated);
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
    scheduleDaySave(day.id);
  }

  async function generateDayContent(index: number) {
    const day = itineraryDays[index];
    setGeneratingDay(day.id);
    try {
      const body: Record<string, unknown> = {
        day_number: day.day_number,
        destination: proposal.destination,
        city: day.city || getCityForDate(day.date),
        hotel: hotels.find(h => h.check_in <= day.date && h.check_out > day.date)?.name,
        raw_description: day.raw_description || undefined,
        day_type: day.day_type || undefined,
      };
      if (day.heading && !day.raw_description) {
        body.existing_heading = day.heading;
      }
      const res = await fetch('/api/ai/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`AI Generate failed: ${err.error || res.statusText}`);
        return;
      }
      const data = await res.json();
      if (data.error) {
        alert(`AI Generate failed: ${data.error}`);
        return;
      }
      const isTourWithHeading = day.day_type === 'tour' && day.heading && !day.raw_description;
      if (isTourWithHeading) {
        updateDay(index, { heading: data.heading || day.heading, description: data.description });
      } else if (day.heading && !day.raw_description) {
        updateDay(index, { description: data.description });
      } else {
        updateDay(index, { heading: data.heading, description: data.description });
      }
      scheduleDaySave(day.id);
    } catch (e) {
      alert(`AI Generate error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setGeneratingDay(null);
    }
  }

  async function curateDayContent(index: number) {
    const day = itineraryDays[index];
    if (!day.description) return;
    setCuratingDay(day.id);
    try {
      const res = await fetch('/api/ai/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: day.day_number,
          destination: proposal.destination,
          city: day.city || getCityForDate(day.date),
          raw_description: day.description,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Curate failed: ${err.error || res.statusText}`);
        return;
      }
      const data = await res.json();
      if (data.error) {
        alert(`Curate failed: ${data.error}`);
        return;
      }
      updateDay(index, { heading: data.heading || day.heading, description: data.description });
      scheduleDaySave(day.id);
    } catch (e) {
      alert(`Curate error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setCuratingDay(null);
    }
  }

  const expectedDayCount = tripDateRange().length;
  const missingDayCount = expectedDayCount - itineraryDays.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Day-wise Itinerary ({itineraryDays.length} days)
        </h2>
        <div className="flex items-center gap-2">
          {expectedDayCount > 0 && missingDayCount > 0 && (
            <Button size="sm" variant="outline" onClick={generateMissingDays} disabled={generatingDays}>
              {generatingDays ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CalendarPlus className="h-3 w-3 mr-1" />}
              Generate {missingDayCount} missing day{missingDayCount !== 1 ? 's' : ''}
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
        const dayType = day.day_type;
        const transport = day.overnight_city || 'N/A';
        const blurSave = () => scheduleDaySave(day.id);

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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Day Title</Label>
                  <CreatableCombobox
                    value={day.heading || ''}
                    onChange={(v) => { updateDay(index, { heading: v }); blurSave(); }}
                    options={[]}
                    placeholder="e.g., Arrival in Dubai"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <CreatableCombobox
                    value={city}
                    onChange={(v) => { updateDay(index, { city: v }); blurSave(); }}
                    options={[
                      { value: 'delhi', label: 'Delhi' },
                      { value: 'mumbai', label: 'Mumbai' },
                      { value: 'jaipur', label: 'Jaipur' },
                      { value: 'udaipur', label: 'Udaipur' },
                      { value: 'goa', label: 'Goa' },
                      { value: 'kerala', label: 'Kerala' },
                      { value: 'shimla', label: 'Shimla' },
                      { value: 'manali', label: 'Manali' },
                      { value: 'kochi', label: 'Kochi' },
                      { value: 'coorg', label: 'Coorg' },
                      { value: 'agra', label: 'Agra' },
                      { value: 'varanasi', label: 'Varanasi' },
                      { value: 'rishikesh', label: 'Rishikesh' },
                      { value: 'darjeeling', label: 'Darjeeling' },
                      { value: 'andaman', label: 'Andaman' },
                      { value: 'leh-ladakh', label: 'Leh-Ladakh' },
                      { value: 'srinagar', label: 'Srinagar' },
                      { value: 'dubai', label: 'Dubai' },
                      { value: 'singapore', label: 'Singapore' },
                      { value: 'thailand', label: 'Thailand' },
                      { value: 'bali', label: 'Bali' },
                      { value: 'maldives', label: 'Maldives' },
                      { value: 'sri-lanka', label: 'Sri Lanka' },
                      { value: 'vietnam', label: 'Vietnam' },
                      { value: 'europe', label: 'Europe' },
                    ]}
                    placeholder="Select city..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Transport</Label>
                  <select
                    className="w-full h-10 rounded-md border px-3 text-sm"
                    value={transport}
                    onChange={(e) => { updateDay(index, { overnight_city: e.target.value } as Partial<ItineraryDay>); blurSave(); }}
                  >
                    {TRANSPORT_OPTIONS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Description</Label>
                  {day.description && (
                    <Button size="sm" variant="outline" onClick={() => curateDayContent(index)} disabled={curatingDay === day.id}>
                      {curatingDay === day.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
                      Curate
                    </Button>
                  )}
                </div>
                <Textarea
                  value={day.description || ''}
                  onChange={(e) => updateDay(index, { description: e.target.value })}
                  onBlur={blurSave}
                  rows={4}
                  placeholder={day.heading ? 'Click AI Generate to fill from heading, or write manually.' : 'Enter itinerary description or use AI Generate.'}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
