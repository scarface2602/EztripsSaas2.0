'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ArrowRight, Loader2, MapPin, Hotel, Calendar, Copy, Sparkles } from 'lucide-react';

interface ItineraryPreview {
  day_number: number;
  heading: string;
  city: string;
  day_type: string;
}

interface HotelPreview {
  name: string;
  city: string;
  nights: number;
  star_rating: number;
  meal_plan: string;
}

interface Suggestion {
  id: string;
  title: string;
  destination: string;
  route_signature: string;
  trip_cities: Array<{ city: string; nights: number }>;
  cities_visited: string[];
  match_type: 'exact' | 'route';
  created_at: string;
  preview: {
    itinerary: ItineraryPreview[];
    hotels: HotelPreview[];
    pax_adults?: number;
    pax_children?: number;
    quote_type?: string;
    currency?: string;
  };
}

interface RouteSuggestionsProps {
  destination: string;
  cities: string[];
  duration: number | '';
  enquiryId: string;
  clientId: string;
  travelStart: string;
  travelEnd: string;
  paxAdults: number;
  paxChildren: number;
  childrenAges: number[];
  title: string;
  currency: string;
  tripCities: Array<{ city: string; nights: number; check_in: string; check_out: string }>;
  onBack: () => void;
}

export function RouteSuggestions({
  destination,
  cities,
  duration,
  enquiryId,
  clientId,
  travelStart,
  travelEnd,
  paxAdults,
  paxChildren,
  childrenAges,
  title,
  currency,
  tripCities,
  onBack,
}: RouteSuggestionsProps) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchSuggestions() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ destination });
        if (duration) params.set('duration', String(duration));
        if (cities.length) params.set('cities', cities.join(','));

        const res = await fetch(`/api/proposals/suggestions?${params}`);
        if (!res.ok) throw new Error('Failed to fetch suggestions');
        const data = await res.json();
        setSuggestions(data);
      } catch {
        setError('Could not load suggestions. Try creating manually instead.');
      } finally {
        setLoading(false);
      }
    }
    fetchSuggestions();
  }, [destination, duration, cities]);

  async function handleClone(sourceId: string) {
    setCloning(sourceId);
    try {
      const res = await fetch('/api/proposals/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_proposal_id: sourceId,
          enquiry_id: enquiryId || null,
          client_id: clientId || null,
          title,
          destination,
          travel_start: travelStart || null,
          travel_end: travelEnd || null,
          pax_adults: paxAdults,
          pax_children: paxChildren,
          children_ages: childrenAges.length ? childrenAges : null,
          trip_cities: tripCities.length ? tripCities : null,
          currency,
        }),
      });
      if (!res.ok) throw new Error('Clone failed');
      const { id } = await res.json();
      router.push(`/proposals/${id}`);
    } catch {
      setError('Failed to clone proposal. Please try again.');
      setCloning(null);
    }
  }

  const starDisplay = (rating: number) => '★'.repeat(Math.min(rating || 0, 5));

  const mealPlanLabel: Record<string, string> = {
    RO: 'Room Only',
    BB: 'Bed & Breakfast',
    HB: 'Half Board',
    FB: 'Full Board',
    AI: 'All Inclusive',
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Searching past routes for {destination}...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Past Routes for {destination}</h2>
          <p className="text-sm text-muted-foreground">
            {suggestions.length
              ? `${suggestions.length} route configuration${suggestions.length > 1 ? 's' : ''} found`
              : 'No matching routes found'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">{error}</div>
      )}

      {suggestions.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">No past routes found for this destination and city combination.</p>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Go back and create manually
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5">
        {suggestions.map((s) => (
          <Card key={s.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base leading-snug">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(s.trip_cities || []).map((tc, i) => (
                      <span key={tc.city} className="flex items-center gap-1">
                        {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <Badge variant="secondary" className="text-sm font-medium">
                          {tc.city} [{tc.nights}N]
                        </Badge>
                      </span>
                    ))}
                  </div>
                </CardTitle>
                <Badge
                  variant={s.match_type === 'exact' ? 'default' : 'outline'}
                  className="text-xs shrink-0"
                >
                  {s.match_type === 'exact' ? (
                    <><Sparkles className="h-3 w-3 mr-1" /> Matches Client&apos;s Requested Cities</>
                  ) : (
                    <><Copy className="h-3 w-3 mr-1" /> Suggested Macro-Route</>
                  )}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col pt-0">
              <Tabs defaultValue="itinerary" className="flex-1">
                <TabsList className="flex flex-row space-x-4 border-b border-slate-200 pb-2 mb-4 bg-transparent h-auto p-0">
                  <TabsTrigger value="itinerary" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-1.5">Itinerary</TabsTrigger>
                  <TabsTrigger value="hotels" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-1.5">Hotels</TabsTrigger>
                  <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-1.5">Details</TabsTrigger>
                </TabsList>

                <TabsContent value="itinerary" className="mt-0">
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {s.preview.itinerary.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No itinerary data</p>
                    ) : (
                      s.preview.itinerary.map((day) => (
                        <div
                          key={day.day_number}
                          className="flex items-start gap-3 text-sm py-2 px-2 border-b border-border/50 last:border-0 hover:bg-muted/30 rounded"
                        >
                          <span className="font-medium text-muted-foreground whitespace-nowrap min-w-[3.5rem]">
                            Day {day.day_number}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{day.heading || day.city || '—'}</span>
                            {day.city && day.heading && (
                              <span className="text-muted-foreground ml-2">· {day.city}</span>
                            )}
                          </div>
                          {day.day_type && day.day_type !== 'tour' && (
                            <Badge variant="outline" className="text-xs capitalize shrink-0">
                              {day.day_type}
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="hotels" className="mt-0">
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {s.preview.hotels.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No hotel data</p>
                    ) : (
                      s.preview.hotels.map((h, i) => (
                        <div key={i} className="border rounded-md p-2.5">
                          <div className="flex items-center gap-2">
                            <Hotel className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm">{h.name}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{h.city}</span>
                            {h.nights > 0 && <span>{h.nights}N</span>}
                            {h.star_rating > 0 && (
                              <span className="text-amber-500">{starDisplay(h.star_rating)}</span>
                            )}
                            {h.meal_plan && (
                              <span>{mealPlanLabel[h.meal_plan] || h.meal_plan}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="details" className="mt-0">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Route</span>
                      <span className="font-medium">{s.route_signature?.replace(/,/g, ' → ') || '—'}</span>
                    </div>
                    {s.preview.pax_adults && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pax</span>
                        <span>
                          {s.preview.pax_adults} Adult{s.preview.pax_adults > 1 ? 's' : ''}
                          {s.preview.pax_children ? `, ${s.preview.pax_children} Child${s.preview.pax_children > 1 ? 'ren' : ''}` : ''}
                        </span>
                      </div>
                    )}
                    {s.preview.quote_type && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quote Type</span>
                        <span className="capitalize">{s.preview.quote_type}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>{new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                className="w-full mt-4"
                onClick={() => handleClone(s.id)}
                disabled={cloning !== null}
              >
                {cloning === s.id ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cloning...</>
                ) : (
                  <><Calendar className="h-4 w-4 mr-2" /> Use this Route Configuration</>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
