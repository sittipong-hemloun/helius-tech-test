'use client';

import type { Employee } from '@employee-console/api-client';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from 'lucide-react';
import { formatDateOnly, formatSalary } from '@/lib/format';
import type { ListParams, SortBy } from '@/lib/list-params';
import { GuardedLink } from '@/lib/unsaved-changes';
import { StatusBadge } from './status-badge';
import { Skeleton } from './ui/skeleton';
import { cn } from './ui/cn';

interface Column {
  key: SortBy;
  label: string;
  align?: 'right';
  adminOnly?: boolean;
  width?: string;
}

const COLUMNS: Column[] = [
  { key: 'id', label: 'ID', width: 'w-16' },
  { key: 'name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'salary', label: 'Salary', align: 'right', adminOnly: true },
  { key: 'joinDate', label: 'Join date' },
  { key: 'isActive', label: 'Status' },
  { key: 'lastUpdatedDate', label: 'Last updated' },
];

interface Props {
  rows: Employee[] | undefined;
  isAdmin: boolean;
  params: ListParams;
  loading: boolean;
  onSort: (key: SortBy) => void;
  onDelete: (row: Employee) => void;
}

/** The green-bar register: banded rows, tabular figures, sortable headers (aria-sort). */
export function EmployeeTable({ rows, isAdmin, params, loading, onSort, onDelete }: Props) {
  const columns = COLUMNS.filter((c) => !c.adminOnly || isAdmin);
  const colCount = columns.length + (isAdmin ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-[var(--radius-sheet)] border border-rule bg-sheet">
      <table className="w-full min-w-[48rem] border-collapse text-left">
        <caption className="sr-only">Employees, sorted by {params.sortBy} {params.sortOrder === 'asc' ? 'ascending' : 'descending'}</caption>
        <thead>
          <tr className="border-b border-rule-strong">
            {columns.map((c) => {
              const active = params.sortBy === c.key;
              const Icon = active ? (params.sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (params.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn('type-condensed px-3 py-2.5 text-[0.875rem] font-semibold text-ink-2', c.width, c.align === 'right' && 'text-right')}
                >
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className={cn('inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-ink', c.align === 'right' && 'flex-row-reverse', active && 'text-ink')}
                  >
                    {c.label}
                    <Icon aria-hidden className={cn('size-3.5', !active && 'opacity-40')} />
                  </button>
                </th>
              );
            })}
            {isAdmin ? (
              <th scope="col" className="type-condensed px-3 py-2.5 text-right text-[0.875rem] font-semibold text-ink-2">
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="greenbar">
          {rows === undefined
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i} data-skeleton="" aria-hidden>
                  {Array.from({ length: colCount }, (__, j) => (
                    <td key={j} className="px-3 py-3">
                      <Skeleton className="h-4 w-full max-w-[9rem]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((e) => (
                <tr key={e.id} className={cn(loading && 'opacity-70')}>
                  <td className="figures type-wide px-3 py-2.5 text-ink-2">{e.id}</td>
                  <td className="px-3 py-2.5">
                    <GuardedLink href={`/employees/${e.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                      {e.name}
                    </GuardedLink>
                  </td>
                  <td className="px-3 py-2.5">{e.departmentName}</td>
                  {isAdmin ? <td className="figures px-3 py-2.5 text-right">{formatSalary(e.salary)}</td> : null}
                  <td className="figures px-3 py-2.5 whitespace-nowrap">{formatDateOnly(e.joinDate)}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge isActive={e.isActive} />
                  </td>
                  <td className="figures px-3 py-2.5 whitespace-nowrap text-ink-2">{formatDateOnly(e.lastUpdatedDate)}</td>
                  {isAdmin ? (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <GuardedLink
                        href={`/employees/${e.id}/edit`}
                        className="inline-flex size-8 items-center justify-center rounded text-ink-2 hover:bg-sheet hover:text-ink"
                        aria-label={`Edit ${e.name}`}
                      >
                        <Pencil aria-hidden className="size-4" />
                      </GuardedLink>
                      <button
                        type="button"
                        onClick={() => onDelete(e)}
                        className="inline-flex size-8 items-center justify-center rounded text-ink-2 hover:bg-stamp-wash hover:text-stamp"
                        aria-label={`Delete ${e.name}`}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
