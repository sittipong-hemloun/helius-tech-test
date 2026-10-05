'use client';

import { Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Notice } from '@/components/common/notice';
import { Pagination } from '@/components/common/pagination';
import { DeleteEmployeeDialog } from '@/components/employees/delete-employee-dialog';
import { EmployeeFilters } from '@/components/employees/employee-filters';
import { EmployeeTable } from '@/components/employees/employee-table';
import { PageHeader } from '@/components/layout/app-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { errorMessage, type Employee } from '@/lib/api';
import { plural } from '@/lib/format';
import { DEFAULT_PARAMS, isFiltered, readListParams, toSearch, type ListParams, type SortBy } from '@/lib/list-params';
import { useEmployees } from '@/lib/queries';

export function EmployeesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(() => readListParams(searchParams), [searchParams]);
  const [toDelete, setToDelete] = useState<Employee | null>(null);

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
  const meta = query.data;
  const rows = query.data?.items;

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

  const clearAll = () => navigate({ ...DEFAULT_PARAMS, pageSize: params.pageSize });
  const retry = (
    <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
      Try again
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Employees"
        meta={
          meta ? (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="figures" aria-live="polite">
                {meta.total === 0 ? (filtered ? 'No matching employees' : 'No employees yet') : `${from}–${to} of ${plural(meta.total, 'employee')}`}
                {filtered && meta.total > 0 ? ' match the filters' : ''}
              </span>
              {query.isFetching && rows ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-ink-2" role="status">
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                  Updating
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-ink-2">Loading employees…</span>
          )
        }
        actions={
          <Link href="/employees/new" className={buttonVariants({ variant: 'primary' })}>
            <Plus aria-hidden />
            Add employee
          </Link>
        }
      />

      {query.isError && rows ? (
        // Background refresh failed: keep the last loaded data visible, say so, and offer a retry.
        <Notice tone="warning" title="Couldn't refresh the list. Showing the last loaded data." className="mb-4" action={retry}>
          {errorMessage(query.error)}
        </Notice>
      ) : null}

      {/* One sheet: filter toolbar, register, pagination footer. */}
      <section aria-label="Employee register" className="overflow-hidden rounded-[var(--radius-sheet)] border border-rule-strong/60 bg-sheet">
        <div className="border-b border-rule px-3 py-2">
          <EmployeeFilters params={params} onSearch={onSearch} onChange={update} onClear={clearAll} filtered={filtered} />
        </div>

        {query.isError && !rows ? (
          <div className="px-4 py-4">
            <Notice bare tone="error" title={errorMessage(query.error)} action={retry} />
          </div>
        ) : rows && rows.length === 0 && meta?.total === 0 ? (
          <div className="px-4 py-5">
            <p className="font-semibold">{filtered ? 'No matching employees.' : 'No employees yet.'}</p>
            <p className="mt-0.5 text-ink-2">{filtered ? 'Try a different name or clear the filters.' : 'Records you add will appear here.'}</p>
            <div className="mt-3">
              {filtered ? (
                <Button variant="secondary" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : (
                <Link href="/employees/new" className={buttonVariants({ variant: 'primary' })}>
                  <Plus aria-hidden />
                  Add employee
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <EmployeeTable rows={rows} params={params} loading={query.isFetching} onSort={onSort} onDelete={setToDelete} />
            {meta ? (
              <div className="border-t border-rule px-3 py-1.5">
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
      </section>

      <DeleteEmployeeDialog
        target={toDelete ? { id: toDelete.id, name: toDelete.name, version: toDelete.version } : null}
        onClose={() => setToDelete(null)}
        onDeleted={() => setToDelete(null)}
      />
    </>
  );
}
