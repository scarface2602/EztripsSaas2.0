// LiteAPI (Nuitée) hotel adapter — content + availability.
//
// Role per the org's workflow: the API is the PRIMARY source for hotel
// details, room types and availability; its price is an indicative
// prefill that agents overwrite with their own B2B rates while quoting.

import type { HotelProvider, HotelRate, HotelSearchParams } from './types';

const BASE = 'https://api.liteapi.travel/v3.0';

interface LiteRoomType {
  rates?: {
    rateId: string;
    name?: string;
    boardType?: string;
    boardName?: string;
    retailRate?: {
      total?: { amount: number; currency: string }[];
      suggestedSellingPrice?: { amount: number; currency: string }[];
    };
    cancellationPolicies?: { refundableTag?: string };
  }[];
}

export class LiteApiProvider implements HotelProvider {
  readonly id = 'liteapi';
  constructor(private apiKey: string) {}

  private async get(path: string) {
    const res = await fetch(`${BASE}${path}`, { headers: { 'X-API-Key': this.apiKey } });
    if (!res.ok) throw new Error(`LiteAPI ${path}: ${res.status}`);
    return res.json();
  }

  async searchRates(params: HotelSearchParams): Promise<HotelRate[]> {
    // 1. Resolve hotel ids in the city (LiteAPI has its own hotel ids).
    const q = new URLSearchParams({
      countryCode: params.countryCode ?? '',
      cityName: params.cityName,
      limit: '200',
    });
    const hotelsRes = await this.get(`/data/hotels?${q}`);
    let candidates: { id: string; name: string }[] = (hotelsRes.data ?? []).map(
      (h: { id: string; name: string }) => ({ id: h.id, name: h.name }),
    );
    if (params.hotelName) {
      const needle = params.hotelName.toLowerCase();
      const words = needle.split(/\s+/).filter((w) => w.length > 2);
      const scored = candidates
        .map((c) => {
          const name = c.name.toLowerCase();
          const score = name.includes(needle)
            ? 100
            : words.filter((w) => name.includes(w)).length;
          return { ...c, score };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);
      if (scored.length) candidates = scored;
    }
    const ids = candidates.slice(0, 8);
    if (ids.length === 0) return [];
    const nameById = new Map(ids.map((c) => [c.id, c.name]));

    // 2. Live rates for those hotels.
    const res = await fetch(`${BASE}/hotels/rates`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelIds: ids.map((c) => c.id),
        checkin: params.checkIn,
        checkout: params.checkOut,
        occupancies: params.rooms.map((r) => ({
          adults: r.adults,
          ...(r.children?.length ? { children: r.children } : {}),
        })),
        currency: 'INR',
        guestNationality: 'IN',
      }),
    });
    const body = await res.json();
    if (!res.ok || body.error) return []; // "no availability" comes back as an error code

    const rates: HotelRate[] = [];
    for (const hotel of body.data ?? []) {
      for (const roomType of (hotel.roomTypes ?? []) as LiteRoomType[]) {
        for (const rate of roomType.rates ?? []) {
          const total = rate.retailRate?.total?.[0];
          if (!total) continue;
          rates.push({
            provider: this.id,
            providerRef: rate.rateId,
            hotelName: nameById.get(hotel.hotelId) ?? hotel.hotelId,
            roomType: rate.name ?? 'Room',
            mealPlan: rate.boardType ?? undefined,
            currency: total.currency,
            netCost: total.amount,
            cancellationPolicy:
              rate.cancellationPolicies?.refundableTag === 'NRFN' ? 'Non-refundable' : 'Refundable',
            raw: {
              suggestedSell: rate.retailRate?.suggestedSellingPrice?.[0]?.amount ?? null,
              boardName: rate.boardName ?? null,
              hotelId: hotel.hotelId,
            },
          });
        }
      }
    }
    // Cheapest first; cap the list so the picker stays scannable.
    return rates.sort((a, b) => a.netCost - b.netCost).slice(0, 30);
  }
}
