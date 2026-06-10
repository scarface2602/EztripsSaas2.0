'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Proposal, Hotel, Supplier } from '@/lib/types/database';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import type { TripCity } from '@/lib/types/database';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { useCityOptions, addCityToLookup } from '@/lib/hooks/use-city-options';

interface HotelSuggestion {
  name: string;
  city: string | null;
  star_rating: number | null;
  room_type: string | null;
  meal_plan: string | null;
  last_cp_per_night: number | null;
}

/**
 * Hotel autocomplete fed by quoting history (/api/hotels/suggest).
 * Refetches when the row's city changes; the combobox filters client-side.
 */
function useHotelSuggestions(city: string | null | undefined) {
  const [suggestions, setSuggestions] = useState<HotelSuggestion[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/hotels/suggest?city=${encodeURIComponent(city || '')}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch {
        // aborted or offline — keep previous suggestions
      }
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [city]);
  return suggestions;
}

interface HotelsSectionProps {
  proposal: Proposal;
  hotels: Hotel[];
  setHotels: (hotels: Hotel[]) => void;
  suppliers: Supplier[];
  showInternalCosts: boolean;
}

export function HotelsSection({ proposal, hotels, setHotels, suppliers, showInternalCosts }: HotelsSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ── Debounced auto-save per hotel row on blur ──────────────
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const hotelsRef = useRef(hotels);
  hotelsRef.current = hotels;

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, []);

  function scheduleHotelSave(hotelId: string) {
    if (saveTimers.current[hotelId]) clearTimeout(saveTimers.current[hotelId]);
    saveTimers.current[hotelId] = setTimeout(async () => {
      const hotel = hotelsRef.current.find(h => h.id === hotelId);
      if (!hotel) return;
      await supabase.from('hotels').update({
        name: hotel.name,
        city: hotel.city,
        check_in: hotel.check_in,
        check_out: hotel.check_out,
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
    }, 1500);
  }

  function calculateNights(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 0;
    try {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
    } catch {
      return 0;
    }
  }

  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateHotel(index: number, updates: Partial<Hotel>) {
    const updated = [...hotels];
    const hotel = updated[index] = { ...updated[index], ...updates };
    if (updates.check_in || updates.check_out) {
      hotel.nights = calculateNights(updates.check_in || hotel.check_in, updates.check_out || hotel.check_out);
    }
    setHotels(updated);
  }

  async function addHotel() {
    const tripCities: TripCity[] = proposal.trip_cities || [];
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
    }
  }

  async function deleteHotel(index: number) {
    const hotel = hotels[index];
    await supabase.from('hotels').delete().eq('id', hotel.id);
    setHotels(hotels.filter((_, i) => i !== index));
  }

  const tripCities: TripCity[] = proposal.trip_cities || [];

  const totalHotelNights = hotels.reduce((sum, h) => sum + (h.nights || 0), 0);
  const expectedNights = tripCities.length > 0
    ? tripCities.reduce((s, c) => s + c.nights, 0)
    : (proposal.travel_start && proposal.travel_end
        ? Math.round((new Date(proposal.travel_end).getTime() - new Date(proposal.travel_start).getTime()) / 86400000)
        : 0);
  const nightsMismatch = hotels.length > 0 && expectedNights > 0 && totalHotelNights !== expectedNights;

  const colSpan = showInternalCosts ? 8 : 6;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
              <th className="w-8 py-2"></th>
              <th className="py-2 px-2 min-w-[100px]">City</th>
              <th className="py-2 px-2 min-w-[160px]">Hotel</th>
              <th className="py-2 px-2 w-[70px]">Nights</th>
              <th className="py-2 px-2 min-w-[100px]">Room Type</th>
              <th className="py-2 px-2 w-[80px]">Meal Plan</th>
              {showInternalCosts && <th className="py-2 px-2 min-w-[120px]">Supplier</th>}
              {showInternalCosts && <th className="py-2 px-2 w-[110px]">Cost / Night</th>}
              <th className="py-2 px-2 w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((hotel, index) => {
              const isExpanded = expandedRows.has(hotel.id);
              const blurSave = () => scheduleHotelSave(hotel.id);
              return (
                <HotelRow
                  key={hotel.id}
                  hotel={hotel}
                  isExpanded={isExpanded}
                  onToggle={() => toggleRow(hotel.id)}
                  onUpdate={(updates) => updateHotel(index, updates)}
                  onDelete={() => deleteHotel(index)}
                  onBlurSave={blurSave}
                  suppliers={suppliers}
                  showInternalCosts={showInternalCosts}
                  colSpan={colSpan}
                />
              );
            })}
          </tbody>
        </table>

        {hotels.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No hotels added yet</p>
        )}
      </div>

      {nightsMismatch && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-800">
            Hotel nights total {totalHotelNights} but trip structure is {expectedNights} nights.
          </span>
        </div>
      )}

      <Button size="sm" variant="outline" onClick={addHotel}>
        <Plus className="h-4 w-4 mr-1" /> Add Hotel
      </Button>

      {showInternalCosts && hotels.length > 0 && (
        <div className="p-3 bg-muted/50 border rounded-md flex items-center justify-between">
          <span className="text-sm font-semibold">Hotels Subtotal</span>
          <span className="text-sm font-bold">
            {hotels.reduce((sum, h) => {
              const roomCost = (Number(h.cp_per_night) || 0) * (Number(h.nights) || 1);
              const ebCost = (Number(h.sp_per_night) || 0) * (Number(h.nights) || 1);
              const cwbCost = (Number(h.cwb_cp) || 0) * (Number(h.nights) || 1);
              const cnbCost = (Number(h.cnb_cp) || 0) * (Number(h.nights) || 1);
              return sum + roomCost + ebCost + cwbCost + cnbCost;
            }, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  );
}

function HotelRow({
  hotel,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  onBlurSave,
  suppliers,
  showInternalCosts,
  colSpan,
}: {
  hotel: Hotel;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Hotel>) => void;
  onDelete: () => void;
  onBlurSave: () => void;
  suppliers: Supplier[];
  showInternalCosts: boolean;
  colSpan: number;
}) {
  const cityOptions = useCityOptions();
  const hotelSuggestions = useHotelSuggestions(hotel.city);

  // Picking a known hotel prefills the row from the last time it was quoted.
  function handleHotelPick(name: string) {
    const match = hotelSuggestions.find(s => s.name.toLowerCase() === name.toLowerCase());
    const updates: Partial<Hotel> = { name };
    if (match) {
      if (!hotel.room_type && match.room_type) updates.room_type = match.room_type;
      if (!hotel.star_rating && match.star_rating) updates.star_rating = match.star_rating;
      if (!hotel.meal_plan && match.meal_plan) updates.meal_plan = match.meal_plan as Hotel['meal_plan'];
      if (!hotel.city && match.city) updates.city = match.city;
      if (hotel.cp_per_night == null && match.last_cp_per_night != null) updates.cp_per_night = match.last_cp_per_night;
    }
    onUpdate(updates);
    onBlurSave();
  }

  return (
    <>
      {/* Main Row */}
      <tr className="border-b hover:bg-muted/30 transition-colors">
        <td className="py-2">
          <button type="button" onClick={onToggle} className="p-1 hover:bg-muted rounded">
            {isExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
          </button>
        </td>
        <td className="py-2 px-2">
          <CreatableCombobox
            value={hotel.city}
            onChange={(v) => { onUpdate({ city: v }); onBlurSave(); }}
            options={cityOptions}
            onCreateNew={addCityToLookup}
            placeholder="City"
            className={`[&_input]:h-8 [&_input]:text-sm ${!hotel.city ? '[&_input]:border-red-300' : ''}`}
          />
        </td>
        <td className="py-2 px-2">
          <CreatableCombobox
            value={hotel.name}
            onChange={handleHotelPick}
            options={hotelSuggestions.map(s => ({
              value: s.name,
              label: s.name,
              description: [
                s.city,
                s.star_rating ? `${s.star_rating}★` : null,
                s.room_type,
                s.last_cp_per_night != null ? `last CP ₹${Number(s.last_cp_per_night).toLocaleString('en-IN')}/nt` : null,
              ].filter(Boolean).join(' · '),
            }))}
            placeholder="Hotel name..."
            className="[&_input]:h-8 [&_input]:text-sm"
          />
        </td>
        <td className="py-2 px-2">
          <div className="text-sm font-medium text-center">{hotel.nights || '—'}</div>
        </td>
        <td className="py-2 px-2">
          <Input
            value={hotel.room_type || ''}
            onChange={(e) => onUpdate({ room_type: e.target.value })}
            onBlur={onBlurSave}
            placeholder="Deluxe"
            className="h-8 text-sm"
          />
        </td>
        <td className="py-2 px-2">
          <select
            className="w-full h-8 rounded-md border px-2 text-xs"
            value={hotel.meal_plan || ''}
            onChange={(e) => { onUpdate({ meal_plan: e.target.value as Hotel['meal_plan'] }); onBlurSave(); }}
          >
            <option value="">—</option>
            {['RO', 'BB', 'HB', 'FB', 'AI', 'MAP', 'AP'].map(mp => (
              <option key={mp} value={mp}>{mp}</option>
            ))}
          </select>
        </td>
        {showInternalCosts && (
          <td className="py-2 px-2">
            <select
              className="w-full h-8 rounded-md border px-2 text-xs"
              value={hotel.supplier_id || ''}
              onChange={(e) => { onUpdate({ supplier_id: e.target.value || null }); onBlurSave(); }}
            >
              <option value="">Select...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </td>
        )}
        {showInternalCosts && (
          <td className="py-2 px-2">
            <Input
              type="number"
              step="0.01"
              value={hotel.cp_per_night ?? ''}
              onChange={(e) => onUpdate({ cp_per_night: e.target.value ? Number(e.target.value) : null })}
              onBlur={onBlurSave}
              placeholder="0"
              className="h-8 text-sm"
            />
          </td>
        )}
        <td className="py-2 px-2">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </td>
      </tr>

      {/* Expandable Drawer — permanently in DOM, toggled via hidden class */}
      <tr className={`bg-muted/20 border-b ${isExpanded ? '' : 'hidden'}`}>
        <td></td>
        <td colSpan={colSpan} className="py-3 px-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Check-in Date</label>
              <Input
                type="date"
                value={hotel.check_in || ''}
                onChange={(e) => onUpdate({ check_in: e.target.value })}
                onBlur={onBlurSave}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Check-out Date</label>
              <Input
                type="date"
                value={hotel.check_out || ''}
                onChange={(e) => onUpdate({ check_out: e.target.value })}
                onBlur={onBlurSave}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Star Rating</label>
              <select
                className="w-full h-8 rounded-md border px-2 text-xs"
                value={hotel.star_rating || ''}
                onChange={(e) => { onUpdate({ star_rating: e.target.value ? Number(e.target.value) : null }); onBlurSave(); }}
              >
                <option value="">—</option>
                {[3, 4, 5].map(s => <option key={s} value={s}>{s} Star</option>)}
              </select>
            </div>
            <div />
          </div>
          {showInternalCosts && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">EB Cost/Night</label>
                <Input
                  type="number"
                  step="0.01"
                  value={hotel.sp_per_night ?? ''}
                  onChange={(e) => onUpdate({ sp_per_night: e.target.value ? Number(e.target.value) : null })}
                  onBlur={onBlurSave}
                  placeholder="0"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">CWB Cost/Night</label>
                <Input
                  type="number"
                  step="0.01"
                  value={hotel.cwb_cp ?? ''}
                  onChange={(e) => onUpdate({ cwb_cp: e.target.value ? Number(e.target.value) : null })}
                  onBlur={onBlurSave}
                  placeholder="0"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">CNB Cost/Night</label>
                <Input
                  type="number"
                  step="0.01"
                  value={hotel.cnb_cp ?? ''}
                  onChange={(e) => onUpdate({ cnb_cp: e.target.value ? Number(e.target.value) : null })}
                  onBlur={onBlurSave}
                  placeholder="0"
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hotel.is_non_refundable}
                    onChange={(e) => { onUpdate({ is_non_refundable: e.target.checked }); onBlurSave(); }}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-primary"
                  />
                  <span className="text-xs">Non-Refundable</span>
                </label>
              </div>
            </div>
          )}
          {!showInternalCosts && (
            <div className="flex items-center mt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hotel.is_non_refundable}
                  onChange={(e) => { onUpdate({ is_non_refundable: e.target.checked }); onBlurSave(); }}
                  className="h-3.5 w-3.5 rounded border-gray-300 accent-primary"
                />
                <span className="text-xs">Non-Refundable</span>
              </label>
            </div>
          )}
        </td>
      </tr>
    </>
  );
}
