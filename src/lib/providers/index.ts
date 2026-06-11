import type { HotelProvider, FlightProvider } from './types';

export * from './types';

// Registry of configured providers. Adapters self-disable when their
// env keys are absent, so the builder works fully manual until keys
// arrive (LITEAPI_KEY / DUFFEL_TOKEN — later TBO_*, TRIPJACK_*).

import { LiteApiProvider } from './liteapi';

const hotelProviders: HotelProvider[] = [];
const flightProviders: FlightProvider[] = [];

if (process.env.LITEAPI_KEY) hotelProviders.push(new LiteApiProvider(process.env.LITEAPI_KEY));
// Flights: Duffel doesn't onboard Indian businesses — slot stays open
// for TBO/Tripjack credentials when they arrive.

export function getHotelProvider(id?: string): HotelProvider | null {
  if (id) return hotelProviders.find((p) => p.id === id) ?? null;
  return hotelProviders[0] ?? null;
}

export function getFlightProvider(id?: string): FlightProvider | null {
  if (id) return flightProviders.find((p) => p.id === id) ?? null;
  return flightProviders[0] ?? null;
}
