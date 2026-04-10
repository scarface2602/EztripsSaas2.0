'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Clock, Star, Check, AlertTriangle } from 'lucide-react';
import { calculateProposalTotal, getCurrencySymbol } from '@/lib/utils/pricing';
import { differenceInSeconds, format } from 'date-fns';

interface ShareLinkClientProps {
  proposal: Record<string, unknown>;
  hotels: Record<string, unknown>[];
  flights: Record<string, unknown>[];
  itineraryDays: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  lineItems: Record<string, unknown>[];
  versions: Record<string, unknown>[];
  client: Record<string, unknown> | null;
  agent: Record<string, unknown> | null;
}

export function ShareLinkClient({
  proposal, hotels, flights, itineraryDays, activities, lineItems, versions, client, agent,
}: ShareLinkClientProps) {
  const router = useRouter();
  const [tcAccepted, setTcAccepted] = useState(false);
  const [visaAcknowledged, setVisaAcknowledged] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [dualChoices, setDualChoices] = useState<Record<string, 'pvt' | 'sic'>>({});
  const [flightCountdown, setFlightCountdown] = useState<number | null>(null);

  const dualActivities = activities.filter(a => a.option_mode === 'dual');
  const optionalActivities = activities.filter(a => a.is_optional);
  const allDualChosen = dualActivities.every(a => dualChoices[a.id as string]);
  const flightExpired = !!proposal.flight_expires_at && new Date(proposal.flight_expires_at as string) < new Date();
  const landExpiring = !!proposal.land_expires_at && new Date(proposal.land_expires_at as string) < new Date();

  // Flight countdown timer
  useEffect(() => {
    if (!proposal.flight_expires_at) return;
    const interval = setInterval(() => {
      const diff = differenceInSeconds(new Date(proposal.flight_expires_at as string), new Date());
      setFlightCountdown(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [proposal.flight_expires_at]);

  function formatCountdown(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  }

  // Calculate total
  const allItems = [
    ...hotels.map(h => ({ sp: (Number(h.sp_per_night) || 0) * (Number(h.nights) || 0), cp: 0 })),
    ...flights.map(f => ({ sp: Number(f.sp_total) || 0, cp: 0 })),
    ...activities.filter(a => !a.is_optional && a.option_mode !== 'dual').map(a => ({
      sp: Number(a.pvt_sp) || Number(a.sic_sp) || 0, cp: 0,
    })),
    ...activities.filter(a => a.option_mode === 'dual').map(a => ({
      sp: dualChoices[a.id as string] === 'sic' ? Number(a.sic_sp) || 0 : Number(a.pvt_sp) || 0,
      cp: 0,
    })),
    ...Array.from(selectedAddons).map(id => {
      const act = activities.find(a => a.id === id);
      return { sp: Number(act?.pvt_sp) || Number(act?.sic_sp) || 0, cp: 0 };
    }),
    ...lineItems.filter(li => li.is_included && !li.is_optional).map(li => ({
      sp: Number(li.sp) || 0, cp: 0,
    })),
  ];

  const totals = calculateProposalTotal({
    lineItems: allItems,
    discountAmount: Number(proposal.discount_amount) || 0,
    discountOnLandOnly: true,
    gstEnabled: proposal.gst_enabled as boolean,
    gstRate: Number(proposal.gst_rate) || 5,
    tcsEnabled: proposal.tcs_enabled as boolean,
    tcsRate: Number(proposal.tcs_rate) || 5,
    roundingUnit: Number(proposal.rounding_unit) || 0,
  });

  const cur = getCurrencySymbol(proposal.currency as string);

  const canAccept = tcAccepted
    && (!proposal.visa_section_enabled || visaAcknowledged)
    && (dualActivities.length === 0 || allDualChosen)
    && !flightExpired;

  async function handleAccept() {
    const shareToken = window.location.pathname.split('/p/')[1];
    // Log TC acceptance (non-blocking — proceed even if logging fails)
    fetch(`/api/proposals/${shareToken}/log-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'tc_accepted' }),
    }).catch(() => {});
    router.push(`/p/${shareToken}/payment?total=${totals.grandTotal}&addons=${Array.from(selectedAddons).join(',')}&choices=${JSON.stringify(dualChoices)}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover */}
      <div className="relative h-[40vh] flex items-center justify-center text-white text-center"
        style={{ background: proposal.cover_image_url ? `url('${proposal.cover_image_url}') center/cover` : 'linear-gradient(135deg, #1e3a5f, #2d5f8a)' }}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-2">{proposal.title as string || 'Travel Proposal'}</h1>
          <p className="text-xl opacity-90">{proposal.destination as string}</p>
          <p className="mt-2 opacity-75">Prepared for {client?.full_name as string || 'you'}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6 -mt-8 relative z-10">
        {/* TTL Warnings */}
        {!!flightExpired && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Flight prices have expired</p>
              <p className="text-sm text-red-700">Please request a refreshed quote from your agent.</p>
            </div>
          </div>
        )}
        {flightCountdown !== null && flightCountdown > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800">Flight prices valid for: <strong>{formatCountdown(flightCountdown)}</strong></span>
          </div>
        )}
        {landExpiring && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">Prices valid as of {format(new Date(proposal.land_expires_at as string), 'dd/MM/yyyy')}. Rates may have changed.</span>
          </div>
        )}

        <Tabs defaultValue="proposal">
          <TabsList>
            <TabsTrigger value="proposal">Proposal</TabsTrigger>
            <TabsTrigger value="versions">Version History ({versions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="proposal" className="space-y-6 mt-4">
            {/* Trip Summary */}
            <Card>
              <CardHeader><CardTitle>Trip Summary</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Destination:</span> {proposal.destination as string}</div>
                <div><span className="text-muted-foreground">Dates:</span> {proposal.travel_start as string} to {proposal.travel_end as string}</div>
                <div><span className="text-muted-foreground">Travellers:</span> {proposal.pax_adults as number} Adults{(proposal.pax_children as number) > 0 ? `, ${proposal.pax_children} Children` : ''}</div>
                {!!proposal.special_notes && <div><span className="text-muted-foreground">Special Notes:</span> {String(proposal.special_notes)}</div>}
              </CardContent>
            </Card>

            {/* Hotels */}
            {hotels.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Hotels</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {hotels.map((h) => (
                    <div key={h.id as string} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {!!h.star_rating && <span className="flex">{Array.from({ length: Number(h.star_rating) }).map((_, i) => <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}</span>}
                        <h3 className="font-semibold">{h.name as string}</h3>
                        <span className="text-muted-foreground">— {h.city as string}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>Check-in: {h.check_in as string}</div>
                        <div>Check-out: {h.check_out as string}</div>
                        <div>{h.nights as number} nights</div>
                        <div>Room: {(h.room_type as string) || 'N/A'}</div>
                        <div>Meal Plan: {(h.meal_plan as string) || 'N/A'}</div>
                        <div>Rate/Night: {cur}{Number(h.sp_per_night || 0).toLocaleString('en-IN')}</div>
                      </div>
                      {!!h.description && <p className="mt-2 text-sm text-muted-foreground">{String(h.description)}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Flights */}
            {flights.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Flights</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Flight</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flights.map((f) => (
                        <TableRow key={f.id as string}>
                          <TableCell className="font-medium">{f.flight_number as string} {f.airline ? `(${f.airline})` : ''}</TableCell>
                          <TableCell>{f.origin_city as string} → {f.destination_city as string}</TableCell>
                          <TableCell className="text-sm">{f.departure_at ? new Date(f.departure_at as string).toLocaleString() : 'N/A'}</TableCell>
                          <TableCell>{cur}{Number(f.sp_total || 0).toLocaleString('en-IN')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Itinerary */}
            {itineraryDays.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Day-wise Itinerary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {itineraryDays.map((day) => {
                    return (
                      <div key={day.id as string} className="pb-4 border-b last:border-0">
                        <h3 className="font-semibold">
                          <Badge className="mr-2">Day {day.day_number as number}</Badge>
                          {day.heading as string || `Day ${day.day_number}`}
                          {!!day.city && <span className="text-muted-foreground font-normal"> — {String(day.city)}</span>}
                        </h3>
                        {!!day.description && <p className="mt-1 text-sm text-muted-foreground">{String(day.description)}</p>}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Dual choices */}
            {dualActivities.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Choose Your Preference</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {dualActivities.map((a) => (
                    <div key={a.id as string} className="p-4 border rounded-lg">
                      <p className="font-medium mb-2">{a.type as string}: {(a.details as Record<string, unknown>)?.title as string || a.location as string || ''}</p>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md flex-1 hover:bg-muted/50">
                          <input type="radio" name={`dual-${a.id}`} checked={dualChoices[a.id as string] === 'pvt'} onChange={() => setDualChoices({ ...dualChoices, [a.id as string]: 'pvt' })} />
                          <div>
                            <p className="font-medium">Private</p>
                            <p className="text-sm">{cur}{Number(a.pvt_sp || 0).toLocaleString('en-IN')}</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md flex-1 hover:bg-muted/50">
                          <input type="radio" name={`dual-${a.id}`} checked={dualChoices[a.id as string] === 'sic'} onChange={() => setDualChoices({ ...dualChoices, [a.id as string]: 'sic' })} />
                          <div>
                            <p className="font-medium">Shared (SIC)</p>
                            <p className="text-sm">{cur}{Number(a.sic_sp || 0).toLocaleString('en-IN')}</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Optional Add-ons */}
            {optionalActivities.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Enhance Your Trip</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {optionalActivities.map((a) => (
                    <label key={a.id as string} className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={selectedAddons.has(a.id as string)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedAddons);
                          if (checked) next.add(a.id as string); else next.delete(a.id as string);
                          setSelectedAddons(next);
                        }}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{a.type as string}: {(a.details as Record<string, unknown>)?.title as string || a.location as string || ''}</p>
                      </div>
                      <span className="font-medium">{cur}{Number(a.pvt_sp || a.sic_sp || 0).toLocaleString('en-IN')}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Pricing */}
            <Card>
              <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between"><span>Subtotal</span><span>{cur}{totals.subtotal.toLocaleString('en-IN')}</span></div>
                  {totals.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{cur}{totals.discount.toLocaleString('en-IN')}</span></div>}
                  {(proposal.gst_enabled as boolean) && <div className="flex justify-between"><span>GST ({String(proposal.gst_rate)}%)</span><span>{cur}{totals.gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>}
                  {(proposal.tcs_enabled as boolean) && <div className="flex justify-between"><span>TCS ({String(proposal.tcs_rate || 5)}%)</span><span>{cur}{totals.tcsAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>}
                  <Separator />
                  <div className="flex justify-between text-xl font-bold">
                    <span>Grand Total</span>
                    <span>{cur}{totals.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* T&C + Accept */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                {!!proposal.visa_section_enabled && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox checked={visaAcknowledged} onCheckedChange={(v) => setVisaAcknowledged(!!v)} />
                    <span className="text-sm">I have noted the travel/visa requirements above</span>
                  </label>
                )}
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={tcAccepted} onCheckedChange={(v) => setTcAccepted(!!v)} />
                  <span className="text-sm">I agree to the Terms and Conditions</span>
                </label>
                {!!agent?.tc_content && tcAccepted && (
                  <div className="max-h-40 overflow-y-auto p-3 bg-muted/50 rounded text-xs">
                    {String(agent.tc_content)}
                  </div>
                )}
                <Button className="w-full" size="lg" disabled={!canAccept} onClick={handleAccept}>
                  <Check className="h-5 w-5 mr-2" /> Accept Proposal
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="versions" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Published</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">V{proposal.version as number} (current)</TableCell>
                      <TableCell>{new Date(proposal.updated_at as string).toLocaleString()}</TableCell>
                    </TableRow>
                    {versions.map((v) => (
                      <TableRow key={v.id as string}>
                        <TableCell>V{v.version as number}</TableCell>
                        <TableCell>{new Date(v.published_at as string).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* WhatsApp floating button */}
      {!!agent?.whatsapp_number && (
        <a
          href={`https://wa.me/${(agent.whatsapp_number as string).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I have a question about my ${proposal.destination} proposal`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-colors z-50"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
    </div>
  );
}
