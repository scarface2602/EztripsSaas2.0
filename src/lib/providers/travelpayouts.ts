// TravelPayouts (Aviasales data API) flight adapter — INDICATIVE fares.
//
// Data comes from Aviasales' cached search results: flight numbers,
// airlines and departure times are real itineraries, but the FARE is a
// cached snapshot (can be up to ~48h old) — agents verify the fare with
// their consolidator and overwrite it. Arrival time is estimated from
// duration when not supplied.

import type { FlightProvider, FlightOffer, FlightSearchParams } from './types';

const BASE = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';

interface TpRow {
  origin: string;
  destination: string;
  price: number;
  airline: string;
  flight_number: string;
  departure_at: string;
  transfers: number;
  duration: number; // minutes
  link?: string;
}

export class TravelPayoutsProvider implements FlightProvider {
  readonly id = 'travelpayouts';
  constructor(private token: string) {}

  async searchOffers(params: FlightSearchParams): Promise<FlightOffer[]> {
    const q = new URLSearchParams({
      origin: params.origin.toUpperCase(),
      destination: params.destination.toUpperCase(),
      departure_at: params.departDate, // YYYY-MM-DD (or YYYY-MM for a month)
      currency: 'inr',
      sorting: 'price',
      limit: '20',
      one_way: params.returnDate ? 'false' : 'true',
      token: this.token,
    });
    if (params.returnDate) q.set('return_at', params.returnDate);

    const res = await fetch(`${BASE}?${q}`);
    if (!res.ok) throw new Error(`TravelPayouts: ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error(body.error ?? 'TravelPayouts request failed');

    return ((body.data ?? []) as TpRow[]).map((r) => {
      const departAt = r.departure_at?.slice(0, 16) ?? '';
      const arriveAt =
        departAt && r.duration
          ? new Date(new Date(r.departure_at).getTime() + r.duration * 60000).toISOString().slice(0, 16)
          : null;
      return {
        provider: this.id,
        providerRef: `${r.airline}${r.flight_number}-${r.departure_at}`,
        carrier: r.airline,
        flightNumbers: [`${r.airline}-${r.flight_number}`],
        departAt,
        arriveAt,
        durationMinutes: r.duration,
        transfers: r.transfers,
        currency: 'INR',
        netCost: r.price,
        raw: r,
      };
    });
  }
}
