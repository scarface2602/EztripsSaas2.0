'use client';

import { useLookup } from '@/lib/hooks/use-lookup';

export interface CityOption {
  value: string;
  label: string;
}

// Fallback when the 'city' lookup category hasn't been seeded yet —
// same list the editor previously hardcoded inline in two files.
export const STATIC_CITY_OPTIONS: CityOption[] = [
  { value: 'delhi', label: 'Delhi' },
  { value: 'mumbai', label: 'Mumbai' },
  { value: 'jaipur', label: 'Jaipur' },
  { value: 'udaipur', label: 'Udaipur' },
  { value: 'goa', label: 'Goa' },
  { value: 'kerala', label: 'Kerala' },
  { value: 'shimla', label: 'Shimla' },
  { value: 'manali', label: 'Manali' },
  { value: 'kochi', label: 'Kochi' },
  { value: 'coorg', label: 'Coorg' },
  { value: 'agra', label: 'Agra' },
  { value: 'varanasi', label: 'Varanasi' },
  { value: 'rishikesh', label: 'Rishikesh' },
  { value: 'darjeeling', label: 'Darjeeling' },
  { value: 'andaman', label: 'Andaman' },
  { value: 'leh-ladakh', label: 'Leh-Ladakh' },
  { value: 'srinagar', label: 'Srinagar' },
  { value: 'dubai', label: 'Dubai' },
  { value: 'singapore', label: 'Singapore' },
  { value: 'thailand', label: 'Thailand' },
  { value: 'bali', label: 'Bali' },
  { value: 'maldives', label: 'Maldives' },
  { value: 'sri-lanka', label: 'Sri Lanka' },
  { value: 'vietnam', label: 'Vietnam' },
  { value: 'europe', label: 'Europe' },
];

/**
 * City options for every city input in the proposal editor, fed by the
 * CMS-managed 'city' lookup category (seeded from quoting history), with
 * the static list as fallback so the editor works before seeding.
 */
export function useCityOptions(): CityOption[] {
  const { items } = useLookup('city');
  if (items.length === 0) return STATIC_CITY_OPTIONS;
  return items.map(i => ({ value: i.value, label: i.label }));
}

/**
 * Self-growing lookup: when an agent types a city that isn't in the list,
 * persist it so the whole team sees it next time. Fire-and-forget —
 * duplicates are rejected server-side (409) and silently ignored.
 */
export function addCityToLookup(label: string): void {
  const trimmed = label.trim();
  if (!trimmed) return;
  fetch('/api/lookup-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'city',
      value: trimmed.toLowerCase().replace(/\s+/g, '-'),
      label: trimmed,
      sort_order: 500,
    }),
  }).catch(() => {});
}
