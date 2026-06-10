'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Search, ClipboardList, FileText, Inbox, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  type: 'booking' | 'proposal' | 'enquiry' | 'client';
  id: string;
  title: string;
  subtitle: string | null;
  trip_id: string | null;
  href: string;
}

const TYPE_META = {
  booking: { label: 'Bookings', icon: ClipboardList },
  proposal: { label: 'Proposals', icon: FileText },
  enquiry: { label: 'Enquiries', icon: Inbox },
  client: { label: 'Clients', icon: Users },
} as const;

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        // aborted or network error — keep previous results
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const onSelect = useCallback((href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  }, [router]);

  const grouped = (['booking', 'proposal', 'enquiry', 'client'] as const)
    .map(type => ({ type, items: results.filter(r => r.type === type) }))
    .filter(g => g.items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
        aria-label="Search trips, bookings, clients"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left truncate">Search trips…</span>
        <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search trips, bookings, proposals, enquiries and clients">
        <Command shouldFilter={false}>
        <CommandInput
          placeholder="Trip ID, client name, phone, destination…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? 'Searching…' : query.trim().length < 2 ? 'Type a trip ID, name or phone number' : 'No results found'}
          </CommandEmpty>
          {grouped.map(group => {
            const meta = TYPE_META[group.type];
            const Icon = meta.icon;
            return (
              <CommandGroup key={group.type} heading={meta.label}>
                {group.items.map(r => (
                  <CommandItem
                    key={`${r.type}-${r.id}`}
                    value={`${r.type}-${r.id}`}
                    onSelect={() => onSelect(r.href)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate">{r.title}</span>
                      {r.subtitle && (
                        <span className="block text-xs text-muted-foreground truncate capitalize">{r.subtitle}</span>
                      )}
                    </div>
                    {r.trip_id && (
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">{r.trip_id}</Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
