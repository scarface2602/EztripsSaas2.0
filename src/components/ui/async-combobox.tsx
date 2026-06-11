'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export interface AsyncOption {
  id: string | number;
  label: string;
  description?: string;
}

interface AsyncComboboxProps {
  value: AsyncOption | null;
  onSelect: (option: AsyncOption | null) => void;
  search: (q: string) => Promise<AsyncOption[]>;
  /** When provided, an unmatched entry shows "+ Add …" and calls this. */
  onCreate?: (label: string) => Promise<AsyncOption | null>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Minimum characters before searching. Default 0: suggestions show on focus. */
  minChars?: number;
}

// Debounced server-backed combobox with inline create. The dropdown is
// position:fixed so it escapes Card's overflow-hidden clipping.
export function AsyncCombobox({
  value,
  onSelect,
  search,
  onCreate,
  placeholder = 'Type to search…',
  className = '',
  disabled,
  minChars = 0,
}: AsyncComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value?.label ?? '');
  const [options, setOptions] = useState<AsyncOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef('');

  useEffect(() => {
    setInputValue(value?.label ?? '');
  }, [value]);

  const positionDropdown = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionDropdown();
    // Scrolling inside the dropdown must not close it; scrolling the page
    // repositions the (fixed) dropdown so it stays glued to the input.
    const onScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      positionDropdown();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', positionDropdown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', positionDropdown);
    };
  }, [open, positionDropdown]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
      setInputValue(value?.label ?? '');
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const runSearch = useCallback(
    (q: string) => {
      queryRef.current = q;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (q.trim().length < minChars) {
          setOptions([]);
          return;
        }
        setLoading(true);
        try {
          const results = await search(q.trim());
          if (queryRef.current === q) setOptions(results);
        } finally {
          setLoading(false);
        }
      }, q.trim().length === 0 ? 0 : 300); // instant on focus, debounced while typing
    },
    [search, minChars],
  );

  function handlePick(opt: AsyncOption) {
    onSelect(opt);
    setInputValue(opt.label);
    setOpen(false);
  }

  async function handleCreate() {
    const label = inputValue.trim();
    if (!label || !onCreate || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(label);
      if (created) handlePick(created);
    } finally {
      setCreating(false);
    }
  }

  const exactMatch = options.some((o) => o.label.toLowerCase() === inputValue.trim().toLowerCase());
  const showCreate = !!onCreate && inputValue.trim().length >= 2 && !exactMatch && !loading;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Input
        value={inputValue}
        disabled={disabled}
        onChange={(e) => {
          setInputValue(e.target.value);
          setOpen(true);
          if (value) onSelect(null);
          runSearch(e.target.value);
        }}
        onFocus={() => {
          setOpen(true);
          if (inputValue.trim().length >= minChars) runSearch(inputValue);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (options.length === 1) handlePick(options[0]);
            else if (showCreate) void handleCreate();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {open && rect && (options.length > 0 || showCreate) && (
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, zIndex: 100 }}
          className="bg-background border rounded-md shadow-lg max-h-56 overflow-y-auto"
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => handlePick(opt)}
            >
              <span className="font-medium">{opt.label}</span>
              {opt.description && (
                <span className="block text-xs text-muted-foreground truncate">{opt.description}</span>
              )}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              disabled={creating}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-t text-primary font-medium disabled:opacity-50"
              onClick={() => void handleCreate()}
            >
              {creating ? 'Adding…' : `+ Add "${inputValue.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
