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
}

// Debounced server-backed combobox with inline create. Used for cities,
// hotels, suppliers, and clients in the proposal builder.
export function AsyncCombobox({
  value,
  onSelect,
  search,
  onCreate,
  placeholder = 'Type to search…',
  className = '',
  disabled,
}: AsyncComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value?.label ?? '');
  const [options, setOptions] = useState<AsyncOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef('');

  useEffect(() => {
    setInputValue(value?.label ?? '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Revert a half-typed query back to the committed selection.
        setInputValue(value?.label ?? '');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const runSearch = useCallback(
    (q: string) => {
      queryRef.current = q;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (q.trim().length < 2) {
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
      }, 300);
    },
    [search],
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
          if (inputValue.trim().length >= 2) runSearch(inputValue);
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
      {open && (options.length > 0 || showCreate) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-56 overflow-y-auto">
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
