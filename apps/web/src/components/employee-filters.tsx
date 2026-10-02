'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEPARTMENT_OPTIONS, type ListParams, type StatusFilter } from '@/lib/list-params';
import { Button } from './ui/button';

interface Props {
  params: ListParams;
  onSearch: (q: string) => void;
  onChange: (patch: Partial<ListParams>) => void;
  onClear: () => void;
  filtered: boolean;
}

const selectClass = 'select-control';

/** Search (debounced 300 ms) + Department + Status, combined with AND (PRD §8.3). */
export function EmployeeFilters({ params, onSearch, onChange, onClear, filtered }: Props) {
  const [text, setText] = useState(params.q);
  const lastSent = useRef(params.q);
  // Back/forward or Clear changed the URL: reflect it in the box.
  useEffect(() => {
    if (params.q !== lastSent.current) {
      lastSent.current = params.q;
      setText(params.q);
    }
  }, [params.q]);

  useEffect(() => {
    if (text.trim() === lastSent.current.trim()) return;
    const t = setTimeout(() => {
      lastSent.current = text.trim();
      onSearch(text.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [text, onSearch]);

  const labelClass = 'w-28 shrink-0 text-[0.8125rem] font-medium text-ink-2 md:w-auto';

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-5">
      <div className="flex items-center gap-2">
        <label htmlFor="filter-q" className={labelClass}>
          Search by name
        </label>
        <div className="relative min-w-0 flex-1 md:w-60 md:flex-none">
          <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <input
            id="filter-q"
            type="search"
            value={text}
            maxLength={100}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. John"
            autoComplete="off"
            className="h-8 w-full rounded-[var(--radius-control)] border border-rule-strong bg-sheet pl-7 pr-2 text-[0.875rem] placeholder:text-ink-3"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-department" className={labelClass}>
          Department
        </label>
        <div className="min-w-0 flex-1 md:w-40 md:flex-none">
          <select
            id="filter-department"
            value={params.departmentId}
            onChange={(e) => onChange({ departmentId: e.target.value })}
            className={selectClass}
          >
            <option value="">All departments</option>
            {DEPARTMENT_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-status" className={labelClass}>
          Status
        </label>
        <div className="min-w-0 flex-1 md:w-32 md:flex-none">
          <select
            id="filter-status"
            value={params.status}
            onChange={(e) => onChange({ status: e.target.value as StatusFilter })}
            className={selectClass}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">In Active</option>
          </select>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          lastSent.current = '';
          setText('');
          onClear();
        }}
        disabled={!filtered && text === ''}
        className="self-start md:self-auto"
      >
        <X aria-hidden />
        Clear filters
      </Button>
    </form>
  );
}

export { selectClass };
