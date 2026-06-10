'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface CreatableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  className?: string;
  onCreateNew?: (value: string) => void;
}

export function CreatableCombobox({
  value,
  onChange,
  options,
  placeholder = 'Type to search or create...',
  className = '',
  onCreateNew,
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  const exactMatch = options.some(
    (opt) => opt.label.toLowerCase() === inputValue.trim().toLowerCase()
  );

  function handleSelect(label: string) {
    setInputValue(label);
    onChange(label);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        onChange(inputValue.trim());
        if (!exactMatch && onCreateNew) {
          onCreateNew(inputValue.trim());
        }
        setOpen(false);
      }
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {open && (filtered.length > 0 || (inputValue.trim() && !exactMatch)) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 8).map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => handleSelect(opt.label)}
            >
              <span className="font-medium">{opt.label}</span>
              {opt.description && (
                <span className="block text-xs text-muted-foreground truncate">{opt.description}</span>
              )}
            </button>
          ))}
          {inputValue.trim() && !exactMatch && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-t text-primary font-medium"
              onClick={() => {
                handleSelect(inputValue.trim());
                if (onCreateNew) onCreateNew(inputValue.trim());
              }}
            >
              + Create &quot;{inputValue.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
