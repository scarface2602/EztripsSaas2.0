'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { MessageCircle, Star, Check, AlertTriangle, ChevronDown, ChevronUp, Tag, Loader2 } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/utils/pricing';
import { format, parseISO } from 'date-fns';
import { CheckoutDialog } from '@/components/proposals/CheckoutDialog';

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

/** Format a date string as "DD MMM YYYY" */
function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(String(dateStr)), 'dd MMM yyyy');
  } catch {
    return String(dateStr);
  }
}

/** Format a datetime string as "DD MMM YYYY, HH:MM" */
function fmtDT(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(String(dateStr)), 'dd MMM yyyy, HH:mm');
  } catch {
    return String(dateStr);
  }
}

export function ShareLinkClient({
  proposal, hotels, flights, itineraryDays, activities, versions, client, agent,
}: ShareLinkClientProps) {
  const [tcAccepted, setTcAccepted] = useState(false);
  const [visaAcknowledged, setVisaAcknowledged] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [dualChoices, setDualChoices] = useState<Record<string, 'pvt' | 'sic'>>({});
  const [showVersions, setShowVersions] = useState(false);

  const dualActivities = activities.filter(a => a.option_mode === 'dual');
  const optionalActivities = activities.filter(a => a.is_optional);
  const allDualChosen = dualActivities.every(a => dualChoices[a.id as string]);

  const hasFlights = flights && flights.length > 0;

  // Pricing validity logic:
  // - Has flights → always dynamic pricing (flight prices change constantly)
  // - No flights + travel ≤ 7 days → dynamic pricing
  // - No flights + travel > 7 days → 48hr countdown from published/updated_at
  const travelStart = proposal.travel_start ? new Date(proposal.travel_start as string) : null;
  const now = new Date();
  const daysUntilTravel = travelStart ? Math.ceil((travelStart.getTime() - now.getTime()) / 86400000) : 999;
  const isDynamicPricing = hasFlights || daysUntilTravel <= 7;

  // 24hr validity for land-only proposals with travel > 7 days
  const publishedAt = proposal.published_at || proposal.updated_at;
  const priceValidUntil = publishedAt
    ? new Date(new Date(publishedAt as string).getTime() + 24 * 3600000)
    : null;
  const priceExpired = !isDynamicPricing && priceValidUntil && priceValidUntil < now;


  // proposal.total_sp is the authoritative grand total computed by the agent's
  // pricing tab on every save. We read it directly so PDF and share link always
  // show the same number.
  const baseTotal = Number(proposal.total_sp) || 0;
  const v2Pricing = ((proposal.published_data as Record<string, unknown> | null)?.builder_v2 ?? null) as
    | {
        land_sell: number;
        flight_sell: number;
        total_sell: number;
        flight_gst?: number;
        flights_bundled?: boolean;
      }
    | null;
  const addOnTotal = Array.from(selectedAddons).reduce((sum, id) => {
    const act = activities.find(a => a.id === id);
    return sum + (Number(act?.pvt_sp) || Number(act?.sic_sp) || 0);
  }, 0);
  const grandTotal = baseTotal + addOnTotal;

  // Discount code
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    id: string; code: string; discount_type: string; discount_value: number;
  } | null>(null);

  const discountAmount = appliedDiscount
    ? appliedDiscount.discount_type === 'percentage'
      ? Math.round(grandTotal * appliedDiscount.discount_value / 100)
      : Math.min(appliedDiscount.discount_value, grandTotal)
    : 0;

  const afterDiscount = grandTotal - discountAmount;

  // Taxes — only when explicitly enabled by the agent. GST applies on the
  // package value; TCS (LRS) applies on the GST-inclusive amount, same as
  // the PDF and the builder. Builder v2 splits GST: the land rate covers
  // the land part only, and separately-shown flights carry a precomputed
  // markup-GST amount (one merged line — the markup is never disclosed).
  const gstEnabled = proposal.gst_enabled === true;
  const gstRate = gstEnabled ? (Number(proposal.gst_rate) || 0) : 0;
  const v2FlightGst = gstEnabled ? Number(v2Pricing?.flight_gst) || 0 : 0;
  const v2SeparateFlights = v2Pricing && !v2Pricing.flights_bundled ? Number(v2Pricing.flight_sell) || 0 : 0;
  const gstBase = Math.max(afterDiscount - v2SeparateFlights, 0);
  const gstAmount = gstEnabled ? Math.round(gstBase * gstRate / 100 + v2FlightGst) : 0;
  const tcsEnabled = proposal.tcs_enabled === true;
  const tcsRate = tcsEnabled ? (Number(proposal.tcs_rate) || 0) : 0;
  const tcsAmount = tcsEnabled && tcsRate > 0 ? Math.round((afterDiscount + gstAmount) * tcsRate / 100) : 0;

  const finalTotal = afterDiscount + gstAmount + tcsAmount;

  const cur = getCurrencySymbol(proposal.currency as string);
  const draftData = (proposal.draft_data || {}) as Record<string, unknown>;
  const vehicleType = draftData.vehicle_type as string | undefined;
  const vehicleModel = draftData.vehicle_model as string | undefined;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const clientEmail = (client?.email as string) || '';
      const clientIdParam = (client?.id as string) || '';
      const res = await fetch(`/api/discount-codes?code=${encodeURIComponent(couponCode.trim())}${clientEmail ? `&client_email=${encodeURIComponent(clientEmail)}` : ''}${clientIdParam ? `&client_id=${encodeURIComponent(clientIdParam)}` : ''}`);
      if (!res.ok) {
        const err = await res.json();
        setCouponError(err.error || 'Invalid code');
        setAppliedDiscount(null);
      } else {
        const data = await res.json();
        setAppliedDiscount(data);
        setCouponError('');
      }
    } catch {
      setCouponError('Failed to validate code');
    }
    setCouponLoading(false);
  };

  const canAccept = tcAccepted
    && (!proposal.visa_section_enabled || visaAcknowledged)
    && (dualActivities.length === 0 || allDualChosen)
    && !priceExpired;

  const [checkoutOpen, setCheckoutOpen] = useState(false);

  async function handleAccept() {
    const st = (proposal.share_token as string) || '';
    fetch(`/api/proposals/${st}/log-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'tc_accepted' }),
    }).catch(() => { });
    // Open inline checkout dialog instead of navigating away
    setCheckoutOpen(true);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover — full-width, mobile-friendly */}
      <div
        className="relative flex items-center justify-center text-white text-center"
        style={{
          minHeight: '40vh',
          background: proposal.cover_image_url
            ? `url('${proposal.cover_image_url}') center/cover`
            : 'linear-gradient(135deg, #1e3a5f, #2d5f8a)',
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 px-6 py-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{proposal.title as string || 'Travel Proposal'}</h1>
          <p className="text-lg sm:text-xl opacity-90">{proposal.destination as string}</p>
          <p className="mt-2 opacity-75 text-sm">Prepared for {client?.full_name as string || 'you'}</p>
        </div>
      </div>

      {/* Single-column content, max-w constrained, responsive padding */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4 -mt-6 relative z-10">

        {/* Pricing validity banners */}
        {priceExpired && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-800">Quote validity has expired</p>
              <p className="text-sm text-red-700">Please request a refreshed quote from your agent.</p>
            </div>
          </div>
        )}
        {isDynamicPricing && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800">
              {hasFlights
                ? 'Note: Prices dynamic and subject to change.'
                : 'Prices are indicative and subject to availability at the time of booking confirmation.'}
            </span>
          </div>
        )}
        {!isDynamicPricing && priceExpired && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="text-sm text-red-800">Prices may have changed since this proposal was shared. Please contact your travel advisor to confirm current pricing.</span>
          </div>
        )}

        {/* Trip Summary */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Trip Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Destination:</span>
              <span className="font-medium">{proposal.destination as string}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Dates:</span>
              <span className="font-medium">{fmt(proposal.travel_start as string)} to {fmt(proposal.travel_end as string)}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Travellers:</span>
              <span className="font-medium">
                {proposal.pax_adults as number || 0} adult{(proposal.pax_adults as number) !== 1 ? 's' : ''}
                {(proposal.pax_children as number) > 0 && `, ${proposal.pax_children as number} child${(proposal.pax_children as number) !== 1 ? 'ren' : ''}`}
              </span>
            </div>
            {vehicleType && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Vehicle Type:</span>
                <span className="font-medium capitalize">{vehicleType.replace(/_/g, ' ')}</span>
              </div>
            )}
            {vehicleModel && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Vehicle Model:</span>
                <span className="font-medium">{vehicleModel}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hotels */}
        {hotels.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Hotels</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {hotels.map((h) => (
                <div key={h.id as string} className="pb-3 border-b last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-sm">{h.name as string}</h3>
                    {Boolean(h.star_rating) && <Star className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {h.city as string} · {fmt(h.check_in as string)} to {fmt(h.check_out as string)} ({h.nights as number} nights)
                  </p>
                  {Boolean(h.room_type) && <p className="text-xs text-muted-foreground">{h.room_type as string} · {(h.meal_plan as string) || 'RO'}</p>}
                  {Boolean(h.occupancy) && <p className="text-xs text-muted-foreground">{h.occupancy as string}</p>}
                  {Boolean(h.policy_note) && <p className="text-xs text-amber-700 mt-0.5">{h.policy_note as string}</p>}
                  {Boolean(h.description) && <p className="text-xs mt-1">{h.description as string}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Flights */}
        {flights.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Flights</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {flights.map((f) => (
                <div key={f.id as string} className="pb-3 border-b last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm">
                      {f.flight_number as string}
                      {!!f.airline && ` (${f.airline as string})`}
                      {!!f.operated_by && (
                        <span className="text-xs font-normal text-muted-foreground"> · operated by {String(f.operated_by)}</span>
                      )}
                    </p>
                    {Number(f.sp_total) > 0 ? (
                      <span className="text-sm font-semibold whitespace-nowrap text-right">
                        {cur}{Number(f.sp_total).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        {Number(f.sp_per_pax) > 0 && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {cur}{Number(f.sp_per_pax).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/person
                          </span>
                        )}
                      </span>
                    ) : f.in_package ? (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Included in package</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[f.origin_city, f.origin_iata].filter(Boolean).length > 0 &&
                      `${(f.origin_city as string) || ''}${f.origin_iata ? ` (${f.origin_iata})` : ''}`}
                    {' → '}
                    {`${(f.destination_city as string) || ''}${f.destination_iata ? ` (${f.destination_iata})` : ''}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      f.departure_at ? fmt(f.departure_at as string) : null,
                      f.duration ? `${f.duration}` : null,
                      f.layover ? `layover ${f.layover}` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[f.cabin_class, f.baggage_allowance ? `Baggage: ${f.baggage_allowance}` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Itinerary */}
        {itineraryDays.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Day-wise Itinerary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {itineraryDays.map((day) => {
                const blocks = (day.blocks as Array<Record<string, unknown>> | undefined) ?? [];
                return (
                  <div key={day.id as string} className="pb-3 border-b last:border-0">
                    <h3 className="font-semibold text-sm">
                      <Badge className="mr-2">Day {day.day_number as number}</Badge>
                      {day.heading as string || `Day ${day.day_number}`}
                      {!!day.city && <span className="text-muted-foreground font-normal"> — {String(day.city)}</span>}
                    </h3>
                    {!!day.description && <p className="mt-1 text-sm text-muted-foreground">{String(day.description)}</p>}
                    {blocks.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {blocks.map((b) => (
                          <div key={b.id as string} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wide shrink-0">
                              {String(b.type ?? 'activity').replace('_', ' ')}
                            </span>
                            <div className="min-w-0">
                              <span className="font-medium">{String(b.title ?? '')}</span>
                              {Boolean(b.transfer_mode || b.start_time) && (
                                <span className="text-xs text-muted-foreground ml-1.5">
                                  {[b.start_time as string | null, b.transfer_mode === 'PVT' ? 'Private' : b.transfer_mode === 'SIC' ? 'Shared (SIC)' : null]
                                    .filter(Boolean).join(' · ')}
                                </span>
                              )}
                              {!!b.description && (
                                <p className="text-xs text-muted-foreground">{String(b.description)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Dual choices */}
        {dualActivities.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-lg">Choose Your Preference</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {dualActivities.map((a) => (
                <div key={a.id as string} className="p-3 border rounded-lg">
                  <p className="font-medium mb-2 text-sm">{a.type as string}: {(a.details as Record<string, unknown>)?.title as string || a.location as string || ''}</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md flex-1 hover:bg-muted/50">
                      <input type="radio" name={`dual-${a.id}`} checked={dualChoices[a.id as string] === 'pvt'} onChange={() => setDualChoices({ ...dualChoices, [a.id as string]: 'pvt' })} />
                      <div>
                        <p className="font-medium text-sm">Private</p>
                        <p className="text-xs text-muted-foreground">{cur}{Number(a.pvt_sp || 0).toLocaleString('en-IN')}</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md flex-1 hover:bg-muted/50">
                      <input type="radio" name={`dual-${a.id}`} checked={dualChoices[a.id as string] === 'sic'} onChange={() => setDualChoices({ ...dualChoices, [a.id as string]: 'sic' })} />
                      <div>
                        <p className="font-medium text-sm">Shared (SIC)</p>
                        <p className="text-xs text-muted-foreground">{cur}{Number(a.sic_sp || 0).toLocaleString('en-IN')}</p>
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
            <CardHeader className="pb-3"><CardTitle className="text-lg">Enhance Your Trip</CardTitle></CardHeader>
            <CardContent className="space-y-2">
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
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{a.type as string}: {(a.details as Record<string, unknown>)?.title as string || a.location as string || ''}</p>
                  </div>
                  <span className="font-medium text-sm">{cur}{Number(a.pvt_sp || a.sic_sp || 0).toLocaleString('en-IN')}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Pricing */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {/* Builder v2: land vs flights shown separately, always. */}
            {v2Pricing && v2Pricing.flight_sell > 0 ? (
              <>
                <div className="flex justify-between">
                  <span>Land Package</span>
                  <span>{cur}{v2Pricing.land_sell.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Flights</span>
                  <span>{cur}{v2Pricing.flight_sell.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span>Package Total</span>
                  <span>{cur}{baseTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>Package Total</span>
                <span>{cur}{baseTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            {addOnTotal > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Add-ons</span>
                <span>+{cur}{addOnTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount ({appliedDiscount?.code})</span>
                <span>-{cur}{discountAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            {(gstAmount > 0 || tcsAmount > 0) && <Separator />}
            {gstAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>GST{v2FlightGst > 0 ? '' : ` @${gstRate}%`}</span>
                <span>+{cur}{gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            {tcsAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>TCS @{tcsRate}%</span>
                <span>+{cur}{tcsAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            <Separator />
            {(() => {
              // Per-person quoting: how the guest asked to see the price.
              const displayMode = (proposal.pricing_display_mode as string) || 'per_person';
              const pax = (Number(proposal.pax_adults) || 0) + (Number(proposal.pax_children) || 0);
              const perPerson = pax > 0 ? Math.round(finalTotal / pax) : 0;
              const showPP = displayMode !== 'total' && perPerson > 0;
              return (
                <>
                  <div className="flex justify-between text-lg font-bold pt-1">
                    <span>Grand Total{pax > 0 ? ` (${pax} pax)` : ''}</span>
                    <span>{cur}{finalTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  {showPP && (
                    <div className="flex justify-between text-sm font-medium text-muted-foreground">
                      <span>Per person</span>
                      <span>{cur}{perPerson.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                </>
              );
            })()}
            {isDynamicPricing && (
              <p className="text-xs text-amber-700 mt-2">* Final price valid at the time of booking confirmation</p>
            )}

            {/* Coupon Code */}
            <div className="pt-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9 text-sm uppercase"
                    placeholder="Discount code"
                    value={couponCode}
                    onChange={e => { setCouponCode(e.target.value); setCouponError(''); }}
                    disabled={!!appliedDiscount}
                  />
                </div>
                {appliedDiscount ? (
                  <Button size="sm" variant="outline" className="h-9" onClick={() => { setAppliedDiscount(null); setCouponCode(''); }}>
                    Remove
                  </Button>
                ) : (
                  <Button size="sm" className="h-9" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}>
                    {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
                  </Button>
                )}
              </div>
              {couponError && <p className="text-xs text-red-600 mt-1">{couponError}</p>}
              {appliedDiscount && (
                <p className="text-xs text-green-600 mt-1">
                  {appliedDiscount.discount_type === 'percentage'
                    ? `${appliedDiscount.discount_value}% discount applied`
                    : `${cur}${appliedDiscount.discount_value.toLocaleString('en-IN')} discount applied`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fine print — only sections the agent filled (or the quote carried) */}
        {(() => {
          const list = (v: unknown) => (Array.isArray(v) ? (v as string[]).filter((s) => s?.trim()) : []);
          const inclusionList = list(proposal.inclusions);
          const exclusionList = list(proposal.exclusions);
          const paymentTerms = (proposal.payment_terms_text as string | null)?.trim();
          const notes = (proposal.special_notes as string | null)?.trim();
          if (!inclusionList.length && !exclusionList.length && !paymentTerms && !notes) return null;
          return (
            <Card>
              <CardContent className="pt-6 space-y-4 text-sm">
                {inclusionList.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1">Inclusions</h3>
                    <ul className="list-disc ml-5 space-y-0.5 text-muted-foreground">
                      {inclusionList.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {exclusionList.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1">Exclusions</h3>
                    <ul className="list-disc ml-5 space-y-0.5 text-muted-foreground">
                      {exclusionList.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {paymentTerms && (
                  <div>
                    <h3 className="font-semibold mb-1">Payment Terms</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{paymentTerms}</p>
                  </div>
                )}
                {notes && (
                  <div>
                    <h3 className="font-semibold mb-1">Notes</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

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
            {/* Proposal-specific T&C wins; agency default is the fallback. */}
            {!!(proposal.terms_conditions || agent?.tc_content) && tcAccepted && (
              <div className="max-h-40 overflow-y-auto p-3 bg-muted/50 rounded text-xs whitespace-pre-line">
                {String(proposal.terms_conditions || agent?.tc_content)}
              </div>
            )}
            <Button className="w-full" size="lg" disabled={!canAccept} onClick={handleAccept}>
              <Check className="h-5 w-5 mr-2" /> Accept Proposal
            </Button>
          </CardContent>
        </Card>

        {/* Version History — collapsible, no sidebar */}
        {versions.length > 0 && (
          <Card>
            <button
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => setShowVersions(v => !v)}
            >
              <span className="font-semibold text-sm">Version History ({versions.length + 1})</span>
              {showVersions ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showVersions && (
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b font-medium">
                    <span>V{proposal.version as number} (current)</span>
                    <span className="text-muted-foreground">{fmtDT(proposal.updated_at as string)}</span>
                  </div>
                  {versions.map((v) => (
                    <div key={v.id as string} className="flex justify-between py-2 border-b last:border-0">
                      <span>V{v.version as number}</span>
                      <span className="text-muted-foreground">{fmtDT(v.published_at as string)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
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

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        shareToken={(proposal.share_token as string) || ''}
        totalAmount={finalTotal}
        currency={(proposal.currency as string) || 'INR'}
        paxAdults={(proposal.pax_adults as number) || 2}
        paxChildren={(proposal.pax_children as number) || 0}
      />
    </div>
  );
}
