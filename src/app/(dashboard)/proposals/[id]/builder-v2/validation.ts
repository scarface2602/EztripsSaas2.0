// Proposal sanity checks — deterministic, run on every change, surfaced
// as non-blocking warnings. Goal: catch human error (wrong-country
// flight, out-of-window dates, unpriced work) before the client does.

import type { BuilderData } from './types';

export interface ProposalWarning {
  id: string;
  step: 'trip' | 'stays' | 'itinerary' | 'extras' | 'pricing' | 'review';
  message: string;
}

// Common airports for the org's selling markets: IATA → country code.
const IATA_COUNTRY: Record<string, string> = {
  // India (home market — always allowed as origin)
  DEL: 'IN', BOM: 'IN', BLR: 'IN', MAA: 'IN', CCU: 'IN', HYD: 'IN', COK: 'IN',
  GOI: 'IN', GOX: 'IN', PNQ: 'IN', AMD: 'IN', JAI: 'IN', LKO: 'IN', IXC: 'IN',
  // SE Asia
  DPS: 'ID', CGK: 'ID', SUB: 'ID', LOP: 'ID', BKK: 'TH', DMK: 'TH', HKT: 'TH',
  USM: 'TH', KBV: 'TH', CNX: 'TH', SIN: 'SG', KUL: 'MY', LGK: 'MY', PEN: 'MY',
  BKI: 'MY', HAN: 'VN', SGN: 'VN', DAD: 'VN', PQC: 'VN', CXR: 'VN', MNL: 'PH',
  CEB: 'PH', MPH: 'PH',
  // East Asia
  NRT: 'JP', HND: 'JP', KIX: 'JP', CTS: 'JP', FUK: 'JP', HKG: 'HK', MFM: 'MO',
  // Gulf / West & Central Asia
  DXB: 'AE', AUH: 'AE', SHJ: 'AE', MCT: 'OM', SLL: 'OM', IST: 'TR', SAW: 'TR',
  AYT: 'TR', TBS: 'GE', BUS: 'GE', GYD: 'AZ', ALA: 'KZ', NQZ: 'KZ', TAS: 'UZ',
  SKD: 'UZ',
  // Europe
  ZRH: 'CH', GVA: 'CH', CDG: 'FR', ORY: 'FR', AMS: 'NL', BRU: 'BE', MUC: 'DE',
  BER: 'DE', FRA: 'DE', VIE: 'AT', SZG: 'AT', INN: 'AT', MXP: 'IT', LIN: 'IT',
  FCO: 'IT', VCE: 'IT', FLR: 'IT', PSA: 'IT', MAD: 'ES', BCN: 'ES', SVO: 'RU',
  // South Asia / Indian Ocean / others
  CMB: 'LK', PBH: 'BT', KTM: 'NP', PKR: 'NP', MLE: 'MV', MRU: 'MU', SEZ: 'SC',
  NBO: 'KE', MBA: 'KE', SYD: 'AU', MEL: 'AU', AKL: 'NZ',
};

function placeCountry(raw: string | undefined, tripCityNames: Set<string>): string | 'trip-city' | null {
  if (!raw) return null;
  const s = raw.trim();
  const iata = s.toUpperCase();
  if (IATA_COUNTRY[iata]) return IATA_COUNTRY[iata];
  const lower = s.toLowerCase();
  const isTripCity = Array.from(tripCityNames).some(
    (city) => lower.includes(city) || city.includes(lower),
  );
  return isTripCity ? 'trip-city' : null;
}

export function buildWarnings(data: BuilderData): ProposalWarning[] {
  const warnings: ProposalWarning[] = [];
  const { proposal, destinations, items, groups } = data;
  const today = new Date().toISOString().slice(0, 10);

  // ── Trip basics ──
  if (proposal.travel_start && proposal.travel_start < today) {
    warnings.push({ id: 'past-start', step: 'trip', message: `Travel start ${proposal.travel_start} is in the past.` });
  }
  for (const d of destinations) {
    if (d.nights === 0) {
      warnings.push({ id: `zero-${d.id}`, step: 'trip', message: `${d.city_name} has 0 nights — remove it or give it nights.` });
    }
  }

  // ── Date window: every dated thing must sit inside the trip ──
  const windowStart = proposal.travel_start;
  const windowEnd = proposal.travel_end;
  if (windowStart && windowEnd) {
    const pad = (s: string, days: number) =>
      new Date(new Date(s + 'T00:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10);
    const lo = pad(windowStart, -1); // red-eyes / day-before departures
    const hi = pad(windowEnd, 1);
    for (const i of items) {
      const flightDetails = i.details as { depart_at?: string };
      const itemDate = i.item_type === 'flight' ? flightDetails.depart_at?.slice(0, 10) || i.check_in : i.check_in;
      if (itemDate && (itemDate < lo || itemDate > hi)) {
        warnings.push({
          id: `date-${i.id}`,
          step: i.item_type === 'flight' ? 'extras' : 'stays',
          message: `"${i.title}" is dated ${itemDate}, but the trip runs ${windowStart} → ${windowEnd}.`,
        });
      }
    }
  }

  // ── Geography: flights must touch the trip ──
  const tripCountries = new Set(destinations.map((d) => d.country_code).filter(Boolean) as string[]);
  tripCountries.add('IN'); // home market: departures from India are normal
  const tripCityNames = new Set(destinations.map((d) => d.city_name.toLowerCase()));
  for (const i of items.filter((x) => x.item_type === 'flight')) {
    const d = i.details as { origin?: string; destination?: string };
    for (const [label, place] of [['from', d.origin], ['to', d.destination]] as const) {
      const country = placeCountry(place, tripCityNames);
      if (country && country !== 'trip-city' && !tripCountries.has(country)) {
        warnings.push({
          id: `geo-${i.id}-${label}`,
          step: 'extras',
          message: `Flight "${i.title}" flies ${label} ${place} — that's not part of this trip's route.`,
        });
      }
    }
  }

  // ── Pricing sanity ──
  for (const g of groups) {
    if (g.cost_amount > 0 && g.sell_amount < g.cost_amount) {
      warnings.push({ id: `loss-${g.id}`, step: 'pricing', message: `"${g.name}" sells below cost — negative margin.` });
    }
    if (g.cost_amount === 0 && items.some((i) => i.price_group_id === g.id)) {
      warnings.push({ id: `nocost-${g.id}`, step: 'pricing', message: `"${g.name}" covers items but has no cost entered.` });
    }
  }
  for (const i of items.filter((x) => !x.price_group_id && x.cost_amount != null && x.sell_amount != null)) {
    if ((i.sell_amount ?? 0) < (i.cost_amount ?? 0)) {
      warnings.push({ id: `loss-${i.id}`, step: 'pricing', message: `"${i.title}" sells below cost — negative margin.` });
    }
  }

  // ── Stays ──
  for (const i of items.filter((x) => x.item_type === 'hotel' && x.title.startsWith('Hotel in '))) {
    warnings.push({ id: `nohotel-${i.id}`, step: 'stays', message: `No hotel picked yet for ${i.title.replace('Hotel in ', '')}.` });
  }

  return warnings;
}
