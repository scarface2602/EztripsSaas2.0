'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, Hotel, Supplier } from '@/lib/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Wand2, Check, Loader2, Star, AlertTriangle, Info } from 'lucide-react';
import type { TripCity } from '@/lib/types/database';

interface HotelsSectionProps {
  proposal: Proposal;
  hotels: Hotel[];
  setHotels: (hotels: Hotel[]) => void;
  suppliers: Supplier[];
  setHasUnsavedChanges: (v: boolean) => void;
}

export function HotelsSection({ proposal, hotels, setHotels, suppliers, setHasUnsavedChanges }: HotelsSectionProps) {
  const supabase = createClient();
  const [generatingDesc, setGeneratingDesc] = useState<string | null>(null);

  function calculateNights(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 0;
    try {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, nights);
    } catch {
      return 0;
    }
  }

  function updateHotel(index: number, updates: Partial<Hotel>) {
    const updated = [...hotels];
    const hotel = updated[index] = { ...updated[index], ...updates };
    
    // Auto-calculate nights if check_in or check_out changed
    if (updates.check_in || updates.check_out) {
      const checkIn = updates.check_in || hotel.check_in;
      const checkOut = updates.check_out || hotel.check_out;
      hotel.nights = calculateNights(checkIn, checkOut);
    }
    
    setHotels(updated);
    setHasUnsavedChanges(true);
  }

  async function addHotel() {
    const tripCities: TripCity[] = proposal.trip_cities || [];
    // Find next unmatched city from trip_cities
    const matchedCities = new Set(hotels.map(h => h.city.trim().toLowerCase()));
    const nextCity = tripCities.find(c => !matchedCities.has(c.city.trim().toLowerCase()));

    const prefillCity = nextCity?.city || proposal.destination || '';
    const prefillCheckIn = nextCity?.check_in || proposal.travel_start || new Date().toISOString().split('T')[0];
    const prefillCheckOut = nextCity?.check_out || proposal.travel_end || new Date().toISOString().split('T')[0];

    const { data } = await supabase.from('hotels').insert({
      proposal_id: proposal.id,
      name: 'New Hotel',
      city: prefillCity,
      check_in: prefillCheckIn,
      check_out: prefillCheckOut,
      sort_order: hotels.length,
    }).select().single();

    if (data) {
      setHotels([...hotels, data as Hotel]);
      setHasUnsavedChanges(true);
    }
  }

  async function deleteHotel(index: number) {
    const hotel = hotels[index];
    await supabase.from('hotels').delete().eq('id', hotel.id);
    setHotels(hotels.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  }

  async function generateDescription(index: number) {
    const hotel = hotels[index];
    setGeneratingDesc(hotel.id);
    try {
      const res = await fetch('/api/ai/hotel-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotel_name: hotel.name, city: hotel.city }),
      });
      const data = await res.json();
      updateHotel(index, { description: data.description, description_approved: false });
    } finally {
      setGeneratingDesc(null);
    }
  }

  async function saveHotel(index: number) {
    const hotel = hotels[index];
    await supabase.from('hotels').update({
      name: hotel.name,
      city: hotel.city,
      check_in: hotel.check_in,
      check_out: hotel.check_out,
      nights: hotel.nights,
      room_type: hotel.room_type,
      meal_plan: hotel.meal_plan,
      star_rating: hotel.star_rating,
      room_view: hotel.room_view,
      supplier_id: hotel.supplier_id,
      is_non_refundable: hotel.is_non_refundable,
      hotel_cancellation_slabs: hotel.hotel_cancellation_slabs,
      cp_per_night: hotel.cp_per_night,
      sp_per_night: hotel.sp_per_night,
      cwb_cp: hotel.cwb_cp,
      cwb_sp: hotel.cwb_sp,
      cnb_cp: hotel.cnb_cp,
      cnb_sp: hotel.cnb_sp,
      description: hotel.description,
      description_approved: hotel.description_approved,
      early_checkin_requested: hotel.early_checkin_requested,
      late_checkout_requested: hotel.late_checkout_requested,
    }).eq('id', hotel.id);
  }

  const tripCities: TripCity[] = proposal.trip_cities || [];
  const allCitiesHaveHotels = tripCities.length > 0 && hotels.length >= tripCities.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Hotels ({hotels.length})</h2>
        <div className="flex items-center gap-2">
          {allCitiesHaveHotels && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3" /> All cities have hotels
            </span>
          )}
          <Button size="sm" onClick={addHotel} disabled={allCitiesHaveHotels}>
            <Plus className="h-4 w-4 mr-1" /> Add Hotel
          </Button>
        </div>
      </div>

      {hotels.map((hotel, index) => (
        <Card key={hotel.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {hotel.star_rating && (
                <span className="flex">{Array.from({ length: hotel.star_rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />)}</span>
              )}
              {hotel.name}
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => saveHotel(index)} disabled={!!(hotel.check_in && hotel.check_out && hotel.check_out <= hotel.check_in)}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => deleteHotel(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={hotel.name} onChange={(e) => updateHotel(index, { name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>City <span className="text-red-500">*</span></Label>
                <Input
                  value={hotel.city}
                  onChange={(e) => updateHotel(index, { city: e.target.value })}
                  placeholder="Required — used for itinerary sync"
                  className={!hotel.city ? 'border-red-300' : ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <select className="w-full h-10 rounded-md border px-3 text-sm" value={hotel.supplier_id || ''} onChange={(e) => updateHotel(index, { supplier_id: e.target.value || null })}>
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Check-in</Label>
                <Input type="date" value={hotel.check_in} onChange={(e) => updateHotel(index, { check_in: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Check-out</Label>
                <Input
                  type="date"
                  value={hotel.check_out}
                  min={hotel.check_in ? new Date(new Date(hotel.check_in).getTime() + 86400000).toISOString().split('T')[0] : undefined}
                  onChange={(e) => updateHotel(index, { check_out: e.target.value })}
                />
                {hotel.check_in && hotel.check_out && hotel.check_out <= hotel.check_in && (
                  <p className="text-xs text-red-600">Check-out must be after check-in</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Room Type</Label>
                <Input value={hotel.room_type || ''} onChange={(e) => updateHotel(index, { room_type: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Meal Plan</Label>
                <select className="w-full h-10 rounded-md border px-3 text-sm" value={hotel.meal_plan || ''} onChange={(e) => updateHotel(index, { meal_plan: e.target.value as Hotel['meal_plan'] })}>
                  <option value="">Select</option>
                  {['RO','BB','HB','FB','AI'].map(mp => <option key={mp} value={mp}>{mp}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Star Rating</Label>
                <Input type="number" min={1} max={5} value={hotel.star_rating ?? ''} onChange={(e) => updateHotel(index, { star_rating: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="space-y-2">
                <Label>Room View</Label>
                <Input value={hotel.room_view || ''} onChange={(e) => updateHotel(index, { room_view: e.target.value })} placeholder="N/A-able" />
              </div>
            </div>

            {/* Pricing — hidden in package mode since DMC gives a single per-person rate */}
            {proposal.quote_type !== 'package' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-3 bg-muted/50 rounded-md">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">CP / Night (internal)</Label>
                  <Input type="number" step="0.01" value={hotel.cp_per_night ?? ''} onChange={(e) => updateHotel(index, { cp_per_night: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">SP / Night (internal only)</Label>
                  <Input type="number" step="0.01" value={hotel.sp_per_night ?? ''} onChange={(e) => updateHotel(index, { sp_per_night: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div />
                {proposal.pax_children > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">CWB CP</Label>
                      <Input type="number" step="0.01" value={hotel.cwb_cp ?? ''} onChange={(e) => updateHotel(index, { cwb_cp: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">CWB SP</Label>
                      <Input type="number" step="0.01" value={hotel.cwb_sp ?? ''} onChange={(e) => updateHotel(index, { cwb_sp: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div />
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">CNB CP</Label>
                      <Input type="number" step="0.01" value={hotel.cnb_cp ?? ''} onChange={(e) => updateHotel(index, { cnb_cp: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">CNB SP</Label>
                      <Input type="number" step="0.01" value={hotel.cnb_sp ?? ''} onChange={(e) => updateHotel(index, { cnb_sp: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Non-refundable + early/late check-in/out */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hotel.is_non_refundable}
                  onChange={(e) => updateHotel(index, { is_non_refundable: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <span className="text-sm">Non-Refundable</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hotel.early_checkin_requested}
                  onChange={(e) => updateHotel(index, { early_checkin_requested: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <span className="text-sm">Early Check-in</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hotel.late_checkout_requested}
                  onChange={(e) => updateHotel(index, { late_checkout_requested: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                <span className="text-sm">Late Check-out</span>
              </label>
            </div>

            {!hotel.is_non_refundable && (
              <div className="space-y-2">
                <Label className="text-sm">Cancellation Slabs</Label>
                {(hotel.hotel_cancellation_slabs || []).map((slab, si) => (
                  <div key={si} className="flex gap-2 items-center">
                    <Input type="number" placeholder="Days before" className="w-32" value={slab.days_before}
                      onChange={(e) => {
                        const slabs = [...(hotel.hotel_cancellation_slabs || [])];
                        slabs[si] = { ...slabs[si], days_before: Number(e.target.value) };
                        updateHotel(index, { hotel_cancellation_slabs: slabs });
                      }} />
                    <span className="text-sm">days →</span>
                    <Input type="number" placeholder="Charge %" className="w-24" min={0} max={100} value={slab.charge_pct}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, Number(e.target.value)));
                        const slabs = [...(hotel.hotel_cancellation_slabs || [])];
                        slabs[si] = { ...slabs[si], charge_pct: val };
                        updateHotel(index, { hotel_cancellation_slabs: slabs });
                      }} />
                    <span className="text-sm">%</span>
                    {slab.charge_pct > 100 && <span className="text-xs text-red-600">Max 100%</span>}
                    <Button size="sm" variant="ghost" onClick={() => {
                      const slabs = (hotel.hotel_cancellation_slabs || []).filter((_, i) => i !== si);
                      updateHotel(index, { hotel_cancellation_slabs: slabs });
                    }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => {
                  const slabs = [...(hotel.hotel_cancellation_slabs || []), { days_before: 7, charge_pct: 100 }];
                  updateHotel(index, { hotel_cancellation_slabs: slabs });
                }}>Add Slab</Button>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <div className="flex gap-2">
                  {hotel.description && !hotel.description_approved && (
                    <Button size="sm" variant="outline" onClick={() => updateHotel(index, { description_approved: true })}>
                      <Check className="h-3 w-3 mr-1" /> Approve
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => generateDescription(index)} disabled={generatingDesc === hotel.id}>
                    {generatingDesc === hotel.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                    AI Generate
                  </Button>
                </div>
              </div>
              <Textarea
                value={hotel.description || ''}
                onChange={(e) => updateHotel(index, { description: e.target.value, description_approved: false })}
                rows={3}
                placeholder="Hotel description..."
              />
              {hotel.description && !hotel.description_approved && (
                <Badge className="bg-yellow-100 text-yellow-700">Needs approval before publish</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {hotels.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No hotels added yet</CardContent></Card>
      )}

      {/* Nights validation warning */}
      {hotels.length > 0 && (() => {
        const totalHotelNights = hotels.reduce((sum, h) => sum + (h.nights || 0), 0);
        // Compare against trip_cities total nights if available, else against date diff
        const expectedNights = tripCities.length > 0
          ? tripCities.reduce((s, c) => s + c.nights, 0)
          : (proposal.travel_start && proposal.travel_end
              ? Math.round((new Date(proposal.travel_end).getTime() - new Date(proposal.travel_start).getTime()) / (1000 * 60 * 60 * 24))
              : 0);
        if (expectedNights > 0 && totalHotelNights !== expectedNights) {
          return (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800">
                Hotel nights total {totalHotelNights} night{totalHotelNights !== 1 ? 's' : ''} but trip structure is {expectedNights} night{expectedNights !== 1 ? 's' : ''}. Check your hotel dates.
              </span>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}
