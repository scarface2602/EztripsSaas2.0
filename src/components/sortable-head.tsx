'use client';

import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortDir = 'asc' | 'desc' | null;

interface SortableHeadProps {
  label: string;
  column: string;
  currentSort: string | null;
  currentDir: SortDir;
  onSort: (column: string) => void;
  className?: string;
}

export function SortableHead({ label, column, currentSort, currentDir, onSort, className }: SortableHeadProps) {
  const active = currentSort === column;
  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:text-foreground transition-colors', className)}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          currentDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

export function useSort(defaultCol: string, defaultDir: SortDir = 'desc') {
  const [sortCol, setSortCol] = useState<string>(defaultCol);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const onSort = (column: string) => {
    if (sortCol === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(column);
      setSortDir('desc');
    }
  };

  return { sortCol, sortDir, onSort };
}
