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

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_10rem_auto] sm:items-end">
      <div>
        <label htmlFor="filter-q" className="mb-1 block text-sm font-medium text-ink-2">
          Search by name
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            id="filter-q"
            type="search"
            value={text}
            maxLength={100}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. John"
            autoComplete="off"
            className="h-10 w-full rounded-[var(--radius-control)] border border-rule-strong bg-sheet pl-9 pr-3 text-[0.9375rem] placeholder:text-ink-3"
          />
        </div>
      </div>
      <div>
        <label htmlFor="filter-department" className="mb-1 block text-sm font-medium text-ink-2">
          Department
        </label>
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
      <div>
        <label htmlFor="filter-status" className="mb-1 block text-sm font-medium text-ink-2">
          Status
        </label>
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
      <Button
        variant="ghost"
        onClick={() => {
          lastSent.current = '';
          setText('');
          onClear();
        }}
        disabled={!filtered && text === ''}
        className="h-10"
      >
        <X aria-hidden />
        Clear filters
      </Button>
    </form>
  );
}

export { selectClass };
