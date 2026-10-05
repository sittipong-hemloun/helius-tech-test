'use client';

import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Notice } from '@/components/common/notice';
import { DeleteEmployeeDialog } from '@/components/employees/delete-employee-dialog';
import { RecordUnavailable } from '@/components/employees/record-unavailable';
import { StatusBadge } from '@/components/employees/status-badge';
import { PageBar, pageTitleClass } from '@/components/layout/app-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateOnly, formatSalary } from '@/lib/format';
import { useEmployee } from '@/lib/queries';

/** One label | value pair of the property sheet; label cells are shaded like a printed form. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] bg-sheet">
      <dt className="bg-head px-3 py-2 text-[0.8125rem] font-medium text-ink-2">{label}</dt>
      <dd className="px-3 py-2">{children}</dd>
    </div>
  );
}

/** "Personnel card": the record number is the one large element; the forest-green rule echoes the register header. */
export function EmployeeDetailView({ id }: { id: number }) {
  const router = useRouter();
  const query = useEmployee(id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (query.error instanceof ApiError && query.error.status === 404) return <RecordUnavailable />;
  if (query.isError) {
    return (
      <Notice tone="error" title={errorMessage(query.error)} action={<Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Try again</Button>} />
    );
  }

  const e = query.data;

  const fields = e
    ? [
        <Field key="department" label="Department">{e.departmentName}</Field>,
        <Field key="status" label="Status">
          <StatusBadge isActive={e.isActive} />
        </Field>,
        <Field key="salary" label="Salary">
          <span className="figures">{formatSalary(e.salary)}</span>
        </Field>,
        <Field key="join" label="Join date">
          <span className="figures">{formatDateOnly(e.joinDate)}</span>
        </Field>,
        <Field key="updated" label="Last updated">
          <span className="figures">{formatDateOnly(e.lastUpdatedDate)}</span>
        </Field>,
        <Field key="version" label="Version">
          <span className="figures text-ink-2">{e.version}</span>
        </Field>,
      ]
    : [];

  return (
    <article aria-labelledby="employee-name">
      <PageBar
        back={{ href: '/employees', label: 'Employees' }}
        actions={
          e ? (
            <>
              <Link href={`/employees/${e.id}/edit`} className={buttonVariants({ variant: 'primary' })}>
                <Pencil aria-hidden />
                Edit employee
              </Link>
              <Button variant="danger-secondary" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden />
                Delete employee
              </Button>
            </>
          ) : null
        }
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p aria-label={e ? `Employee ID ${e.id}` : undefined} className={`figures ${pageTitleClass} text-ledger`}>
            {e ? e.id : <Skeleton className="h-5 w-10" />}
          </p>
          <h1 id="employee-name" className={`${pageTitleClass} break-words`}>
            {e ? e.name : <Skeleton className="h-5 w-40" />}
          </h1>
          {e ? <p className="text-[0.8125rem] text-ink-2">{e.departmentName}</p> : null}
        </div>
      </PageBar>

      <div className="max-w-4xl overflow-hidden rounded-[var(--radius-sheet)] border border-rule">
        <dl className="grid gap-px bg-rule sm:grid-cols-2">
          {e
            ? fields
            : Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="bg-sheet px-3 py-2.5">
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
        </dl>
      </div>

      {e ? (
        <DeleteEmployeeDialog
          target={confirmDelete ? { id: e.id, name: e.name, version: e.version } : null}
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => {
            setConfirmDelete(false);
            router.push('/employees');
          }}
        />
      ) : null}
    </article>
  );
}
