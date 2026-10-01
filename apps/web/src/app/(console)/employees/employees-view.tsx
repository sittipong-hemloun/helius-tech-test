'use client';

import type { Employee } from '@employee-console/api-client';
import { Loader2, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/app-shell';
import { DeleteEmployeeDialog } from '@/components/delete-employee-dialog';
import { EmployeeFilters } from '@/components/employee-filters';
import { EmployeeTable } from '@/components/employee-table';
import { Notice } from '@/components/notice';
import { Pagination } from '@/components/pagination';
import { Button, buttonVariants } from '@/components/ui/button';
import { describeError } from '@/lib/api';
import { plural } from '@/lib/format';
import { DEFAULT_PARAMS, isFiltered, readListParams, toSearch, type ListParams, type SortBy } from '@/lib/list-params';
import { useEmployees } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { GuardedLink } from '@/lib/unsaved-changes';

export function rememberListHref(href: string) {
  if (typeof window !== 'undefined') (window as unknown as { __ecListHref?: string }).__ecListHref = href;
}
export function lastListHref(): string {
  if (typeof window === 'undefined') return '/employees';
  return (window as unknown as { __ecListHref?: string }).__ecListHref ?? '/employees';
}

export function EmployeesView() {
  const { session } = useSession();
  const isAdmin = session.permissions.canWriteEmployees;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(() => readListParams(searchParams, session.permissions.canViewSalary), [searchParams, session.permissions.canViewSalary]);
  const [toDelete, setToDelete] = useState<Employee | null>(null);

  useEffect(() => rememberListHref(`${pathname}${toSearch(params)}`), [pathname, params]);

  const navigate = useCallback(
    (next: ListParams, mode: 'push' | 'replace' = 'push') => {
      const href = `${pathname}${toSearch(next)}`;
      if (mode === 'replace') router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router],
  );

  // Any condition change returns to page 1 (PRD §8.3).
  const update = useCallback((patch: Partial<ListParams>) => navigate({ ...params, ...patch, page: 1 }), [navigate, params]);
  const onSearch = useCallback((q: string) => navigate({ ...params, q, page: 1 }, 'replace'), [navigate, params]);

  const query = useEmployees(params);
  const meta = query.data?.meta;
  const rows = query.data?.data;

  // Deleting the last row of a page: step back to the last page that still has data.
  useEffect(() => {
    if (!meta || !rows) return;
    if (rows.length === 0 && meta.total > 0 && params.page > meta.totalPages) navigate({ ...params, page: meta.totalPages }, 'replace');
  }, [meta, rows, params, navigate]);

  const onSort = (key: SortBy) =>
    update({ sortBy: key, sortOrder: params.sortBy === key && params.sortOrder === 'asc' ? 'desc' : 'asc' });

  const filtered = isFiltered(params);
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.pageSize, meta.total) : 0;

  return (
    <>
      <PageHeader
        title="Employees"
        meta={
          meta ? (
            <span className="figures" aria-live="polite">
              {meta.total === 0 ? (filtered ? 'No matching employees' : 'No employees yet') : `${from}–${to} of ${plural(meta.total, 'employee')}`}
              {filtered && meta.total > 0 ? ' match the filters' : ''}
            </span>
          ) : (
            <span className="text-ink-3">Loading employees…</span>
          )
        }
        actions={
          isAdmin ? (
            <GuardedLink href="/employees/new" className={buttonVariants({ variant: 'primary' })}>
              <Plus aria-hidden />
              Add employee
            </GuardedLink>
          ) : null
        }
      />

      <div className="mb-4">
        <EmployeeFilters params={params} onSearch={onSearch} onChange={update} onClear={() => navigate({ ...DEFAULT_PARAMS, pageSize: params.pageSize })} filtered={filtered} />
      </div>

      {query.isError && !rows ? (
        <Notice
          tone="error"
          title={describeError(query.error).title}
          action={
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        >
          {describeError(query.error).detail}
        </Notice>
      ) : rows && rows.length === 0 && meta?.total === 0 ? (
        <div className="rounded-[var(--radius-sheet)] border border-dashed border-rule-strong bg-sheet px-6 py-12 text-center">
          <p className="type-wide text-lg font-semibold">{filtered ? 'No matching employees.' : 'No employees yet.'}</p>
          <p className="mt-1 text-ink-2">{filtered ? 'Try a different name or clear the filters.' : 'Records you add will appear here.'}</p>
          <div className="mt-5">
            {filtered ? (
              <Button variant="secondary" onClick={() => navigate({ ...DEFAULT_PARAMS, pageSize: params.pageSize })}>
                Clear filters
              </Button>
            ) : isAdmin ? (
              <GuardedLink href="/employees/new" className={buttonVariants({ variant: 'primary' })}>
                <Plus aria-hidden />
                Add employee
              </GuardedLink>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            {query.isFetching && rows ? (
              <span className="absolute -top-7 right-0 inline-flex items-center gap-1.5 text-sm text-ink-3" role="status">
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
                Updating
              </span>
            ) : null}
            <EmployeeTable rows={rows} isAdmin={isAdmin} params={params} loading={query.isFetching} onSort={onSort} onDelete={setToDelete} />
          </div>
          {meta ? (
            <div className="mt-4">
              <Pagination
                page={meta.page}
                pageSize={meta.pageSize}
                total={meta.total}
                totalPages={meta.totalPages}
                onPage={(page) => navigate({ ...params, page })}
                onPageSize={(pageSize) => update({ pageSize })}
              />
            </div>
          ) : null}
        </>
      )}

      <DeleteEmployeeDialog
        target={toDelete ? { id: toDelete.id, name: toDelete.name, version: toDelete.version } : null}
        onClose={() => setToDelete(null)}
        onDeleted={() => setToDelete(null)}
      />
    </>
  );
}
