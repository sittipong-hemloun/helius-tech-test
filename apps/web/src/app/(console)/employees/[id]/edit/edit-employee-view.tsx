'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Notice } from '@/components/common/notice';
import { EmployeeForm, toInput, valuesFromEmployee, type EmployeeFormValues } from '@/components/employees/employee-form';
import { RecordUnavailable } from '@/components/employees/record-unavailable';
import { PageHeader } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, errorMessage, type Employee, type EmployeeInput } from '@/lib/api';
import { useEmployee, useUpdateEmployee } from '@/lib/queries';

/** Only the fields the user changed go into the PATCH. */
function changedFields(next: EmployeeInput, current: Employee): Partial<EmployeeInput> {
  const keys = ['name', 'departmentId', 'salary', 'joinDate', 'isActive'] as const;
  return Object.fromEntries(keys.filter((k) => next[k] !== current[k]).map((k) => [k, next[k]]));
}

export function EditEmployeeView({ id }: { id: number }) {
  const router = useRouter();
  const query = useEmployee(id);
  const update = useUpdateEmployee(id);
  // `conflict`: someone else saved first (409) — offer to reload their version.
  const [banner, setBanner] = useState<{ title: string; conflict: boolean } | null>(null);
  const employee = query.data;

  if (query.error instanceof ApiError && query.error.status === 404) return <RecordUnavailable />;
  if (!employee) {
    return query.isError ? (
      <Notice tone="error" title={errorMessage(query.error)} />
    ) : (
      <div className="max-w-3xl space-y-3" aria-busy>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  const save = (values: EmployeeFormValues) => {
    setBanner(null);
    const patch = changedFields(toInput(values), employee);
    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save.');
      return;
    }
    update.mutate(
      { patch, version: employee.version },
      {
        onSuccess: () => {
          toast.success('Employee updated.');
          router.push(`/employees/${id}`);
        },
        onError: (err) => setBanner({ title: errorMessage(err), conflict: err instanceof ApiError && err.status === 409 }),
      },
    );
  };

  const reloadLatest = async () => {
    await query.refetch(); // new version → resetKey changes → the form shows the latest values
    setBanner(null);
  };

  return (
    <>
      <PageHeader title="Edit employee" meta={<span className="figures">ID {employee.id}, {employee.name}</span>} back={{ href: `/employees/${id}`, label: employee.name }} />
      <EmployeeForm
        mode="edit"
        employee={employee}
        defaultValues={valuesFromEmployee(employee)}
        resetKey={employee.version}
        pending={update.isPending}
        banner={
          banner ? (
            <Notice
              tone={banner.conflict ? 'warning' : 'error'}
              title={banner.title}
              action={banner.conflict ? <Button variant="secondary" size="sm" onClick={() => void reloadLatest()}>Reload latest</Button> : undefined}
            />
          ) : null
        }
        onCancel={() => router.push(`/employees/${id}`)}
        onSubmit={save}
      />
    </>
  );
}
