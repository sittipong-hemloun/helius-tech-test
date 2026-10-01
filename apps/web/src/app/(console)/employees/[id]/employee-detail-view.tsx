'use client';

import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DeleteEmployeeDialog } from '@/components/delete-employee-dialog';
import { Notice } from '@/components/notice';
import { StatusBadge } from '@/components/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, describeError } from '@/lib/api';
import { formatDateOnly, formatSalary } from '@/lib/format';
import { useEmployee } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { GuardedLink } from '@/lib/unsaved-changes';
import { lastListHref } from '../employees-view';

export function parseEmployeeId(raw: string): number | null {
  return /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null;
}

export function RecordUnavailable() {
  return (
    <div className="max-w-xl">
      <Notice tone="warning" title="This employee record is unavailable.">
        It may have been deleted, or the link is wrong.
      </Notice>
      <GuardedLink href={lastListHref()} className={`${buttonVariants({ variant: 'secondary' })} mt-5`}>
        <ArrowLeft aria-hidden />
        Back to employees
      </GuardedLink>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-lg">{children}</dd>
    </div>
  );
}

/** "Personnel card": the record number is the one large element on the page. */
export function EmployeeDetailView({ rawId }: { rawId: string }) {
  const id = parseEmployeeId(rawId);
  const { session } = useSession();
  const router = useRouter();
  const query = useEmployee(id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (id === null || (query.error instanceof ApiError && query.error.status === 404)) return <RecordUnavailable />;
  if (query.isError) {
    return (
      <Notice tone="error" title={describeError(query.error).title} action={<Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Try again</Button>}>
        {describeError(query.error).detail}
      </Notice>
    );
  }

  const e = query.data;
  const canWrite = session.permissions.canWriteEmployees;

  return (
    <article aria-labelledby="employee-name" className="max-w-4xl">
      <GuardedLink href={lastListHref()} className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Employees
      </GuardedLink>

      <div className="overflow-hidden rounded-[var(--radius-sheet)] border border-rule bg-sheet">
        <header className="flex flex-col gap-5 border-b border-rule bg-ledger-wash/60 px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="flex items-end gap-5">
            <p aria-label={e ? `Employee ID ${e.id}` : undefined} className="figures type-expanded text-[3.5rem] font-black leading-[0.85] text-ledger sm:text-[4.5rem]">
              {e ? e.id : <Skeleton className="h-14 w-28" />}
            </p>
            <div className="min-w-0 pb-1">
              <h1 id="employee-name" className="type-wide break-words text-2xl font-bold leading-tight sm:text-[1.75rem]">
                {e ? e.name : <Skeleton className="h-7 w-48" />}
              </h1>
              <p className="mt-1 text-ink-2">{e ? e.departmentName : <Skeleton className="mt-1 h-4 w-24" />}</p>
            </div>
          </div>
          {e && canWrite ? (
            <div className="flex gap-2">
              <GuardedLink href={`/employees/${e.id}/edit`} className={buttonVariants({ variant: 'primary' })}>
                <Pencil aria-hidden />
                Edit
              </GuardedLink>
              <Button variant="secondary" onClick={() => setConfirmDelete(true)} className="text-stamp">
                <Trash2 aria-hidden />
                Delete
              </Button>
            </div>
          ) : null}
        </header>

        <dl className="grid gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2 sm:px-8">
          {e ? (
            <>
              <Field label="Department">{e.departmentName}</Field>
              <Field label="Status">
                <StatusBadge isActive={e.isActive} className="text-sm" />
              </Field>
              {session.permissions.canViewSalary ? (
                <Field label="Salary">
                  <span className="figures">{formatSalary(e.salary)}</span>
                </Field>
              ) : null}
              <Field label="Join date">
                <span className="figures">{formatDateOnly(e.joinDate)}</span>
              </Field>
              <Field label="Last updated">
                <span className="figures">{formatDateOnly(e.lastUpdatedDate)}</span>
              </Field>
              <Field label="Version">
                <span className="figures text-ink-2">{e.version}</span>
              </Field>
            </>
          ) : (
            Array.from({ length: 6 }, (_, i) => (
              <div key={i}>
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="mt-2 h-5 w-36" />
              </div>
            ))
          )}
        </dl>
      </div>

      {e ? (
        <DeleteEmployeeDialog
          target={confirmDelete ? { id: e.id, name: e.name, version: e.version } : null}
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => {
            setConfirmDelete(false);
            router.push(lastListHref());
          }}
        />
      ) : null}
    </article>
  );
}
