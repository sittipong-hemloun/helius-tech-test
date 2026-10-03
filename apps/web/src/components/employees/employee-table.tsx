'use client';

import type { Employee } from '@employee-console/api-client';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { GuardedLink } from '@/components/common/unsaved-changes';
import { formatDateOnly, formatSalary } from '@/lib/format';
import type { ListParams, SortBy } from '@/lib/list-params';
import { StatusBadge } from '@/components/employees/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/components/ui/cn';

interface Column {
  key: SortBy;
  label: string;
  align?: 'right' | 'center';
  width?: string;
}

const COLUMNS: Column[] = [
  { key: 'id', label: 'ID', width: 'w-16' },
  { key: 'name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'salary', label: 'Salary', align: 'right' },
  { key: 'joinDate', label: 'Join date' },
  { key: 'isActive', label: 'Status', align: 'center' },
  { key: 'lastUpdatedDate', label: 'Last updated' },
];

interface Props {
  rows: Employee[] | undefined;
  params: ListParams;
  loading: boolean;
  onSort: (key: SortBy) => void;
  onDelete: (row: Employee) => void;
}

const alignClass = { right: 'text-right', center: 'text-center' } as const;

/**
 * The register: every cell ruled, filled sticky header, green-bar bands, tabular figures,
 * sortable headers (aria-sort). It scrolls inside its own box so wide columns never widen the page.
 */
export function EmployeeTable({ rows, params, loading, onSort, onDelete }: Props) {
  const colCount = COLUMNS.length + 1;

  return (
    <div className="relative max-h-[max(20rem,calc(100dvh-15rem))] overflow-auto overscroll-x-contain">
      <table className="register w-full min-w-[52rem] text-left text-[0.8125rem]">
        <caption className="sr-only">Employees, sorted by {params.sortBy} {params.sortOrder === 'asc' ? 'ascending' : 'descending'}</caption>
        <thead>
          <tr>
            {COLUMNS.map((c) => {
              const active = params.sortBy === c.key;
              const Icon = active ? (params.sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (params.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn('whitespace-nowrap p-0 font-semibold text-ink', c.width, c.align && alignClass[c.align])}
                >
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className={cn(
                      'group flex w-full items-center gap-1 px-2.5 py-1.5 hover:bg-bar-strong',
                      c.align === 'right' && 'flex-row-reverse',
                      c.align === 'center' && 'justify-center',
                      active && 'text-ledger-deep',
                    )}
                  >
                    {c.label}
                    <Icon
                      aria-hidden
                      className={cn('size-3', active ? 'text-ledger' : 'text-ink-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100')}
                    />
                  </button>
                </th>
              );
            })}
            <th scope="col" className="w-28 whitespace-nowrap px-2.5 py-1.5 text-center font-semibold text-ink">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="greenbar">
          {rows === undefined
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i} data-skeleton="" aria-hidden>
                  {Array.from({ length: colCount }, (__, j) => (
                    <td key={j} className="px-2.5 py-2">
                      <Skeleton className="h-3.5 w-full max-w-[8rem]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((e) => (
                <tr key={e.id} className={cn(loading && 'opacity-70')}>
                  <td className="figures px-2.5 py-1.5 font-semibold">{e.id}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5">
                    <GuardedLink href={`/employees/${e.id}`} className="font-medium text-ledger underline-offset-2 hover:underline">
                      {e.name}
                    </GuardedLink>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5">{e.departmentName}</td>
                  <td className="figures px-2.5 py-1.5 text-right">{formatSalary(e.salary)}</td>
                  <td className="figures whitespace-nowrap px-2.5 py-1.5">{formatDateOnly(e.joinDate)}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <StatusBadge isActive={e.isActive} />
                  </td>
                  <td className="figures whitespace-nowrap px-2.5 py-1.5 text-ink-2">{formatDateOnly(e.lastUpdatedDate)}</td>
                  <td className="whitespace-nowrap px-2.5 py-1 text-center">
                    <GuardedLink
                      href={`/employees/${e.id}/edit`}
                      className="rounded px-1 text-ledger underline-offset-2 hover:underline"
                      aria-label={`Edit ${e.name}`}
                    >
                      Edit
                    </GuardedLink>
                    <span aria-hidden className="mx-1.5 text-rule-strong">|</span>
                    <button
                      type="button"
                      onClick={() => onDelete(e)}
                      className="rounded px-1 text-stamp underline-offset-2 hover:underline"
                      aria-label={`Delete ${e.name}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
