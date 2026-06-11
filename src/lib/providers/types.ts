// Provider abstraction for live hotel/flight content.
//
// The builder talks ONLY to these interfaces. Concrete adapters
// (LiteAPI, Duffel, later TBO/Tripjack) map their wire formats to these
// shapes; swapping providers means writing one adapter file and
// changing the registry default — no UI or schema changes. Stored
// proposal_items keep `provider` + `provider_ref` + raw payload, so
// historical items survive a provider switch.

export interface HotelSearchParams {
  cityName: string;
  countryCode?: string;
  checkIn: string; // ISO date
  checkOut: string;
  rooms: { adults: number; children?: number[] }[];
}

export interface HotelRate {
  provider: string;
  providerRef: string; // rate/offer id used for booking later
  hotelName: string;
  roomType: string;
  mealPlan?: string;
  currency: string;
  netCost: number; // what the agent pays — never shown to clients
  cancellationPolicy?: string;
  raw: unknown; // full provider payload, persisted to provider_payload
}

export interface FlightSearchParams {
  origin: string; // IATA
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children?: number;
  cabin?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface FlightOffer {
  provider: string;
  providerRef: string;
  carrier: string;
  flightNumbers: string[];
  departAt: string;
  arriveAt: string;
  currency: string;
  netCost: number;
  raw: unknown;
}

export interface HotelProvider {
  readonly id: string; // 'liteapi' | 'tbo' | ...
  searchRates(params: HotelSearchParams): Promise<HotelRate[]>;
}

export interface FlightProvider {
  readonly id: string; // 'duffel' | 'tripjack' | ...
  searchOffers(params: FlightSearchParams): Promise<FlightOffer[]>;
}
