'use client';

import { useState, useEffect } from 'react';

export interface LookupItem {
  value: string;
  label: string;
  group_name: string | null;
  metadata: Record<string, unknown>;
}

// Simple in-memory cache shared across hook instances
const cache: Record<string, { data: LookupItem[]; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useLookup(category: string) {
  const [items, setItems] = useState<LookupItem[]>(cache[category]?.data || []);
  const [loading, setLoading] = useState(!cache[category]);

  useEffect(() => {
    const cached = cache[category];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setItems(cached.data);
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch(`/api/lookup-items?category=${category}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: LookupItem[]) => {
        if (cancelled) return;
        cache[category] = { data, ts: Date.now() };
        setItems(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [category]);

  // Group items by group_name
  const grouped = items.reduce<Record<string, LookupItem[]>>((acc, item) => {
    const group = item.group_name || '';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  return { items, grouped, loading };
}
