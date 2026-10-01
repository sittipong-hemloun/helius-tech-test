'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/app-shell';
import { applyServerErrors, EmployeeForm, toInput, valuesFromEmployee, type EmployeeFormValues } from '@/components/employee-form';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, api, describeError } from '@/lib/api';
import { useEmployee, useUpdateEmployee, type EmployeeInput } from '@/lib/queries';
import { useSession } from '@/lib/session';
import type { Employee } from '@employee-console/api-client';
import { parseEmployeeId, RecordUnavailable } from '../employee-detail-view';

type Banner = { tone: 'error' | 'warning'; title: string; detail?: string; reload?: boolean } | null;

function diff(next: EmployeeInput, current: Employee): Partial<EmployeeInput> {
  const patch: Partial<EmployeeInput> = {};
  if (next.name !== current.name) patch.name = next.name;
  if (next.departmentId !== current.departmentId) patch.departmentId = next.departmentId;
  if (next.salary !== current.salary) patch.salary = next.salary;
  if (next.joinDate !== current.joinDate) patch.joinDate = next.joinDate;
  if (next.isActive !== current.isActive) patch.isActive = next.isActive;
  return patch;
}

export function EditEmployeeView({ rawId }: { rawId: string }) {
  const id = parseEmployeeId(rawId);
  const { session } = useSession();
  const router = useRouter();
  // No background refetch while editing: the copy (and its version) the user started from stays put.
  const query = useEmployee(id, { editing: true });
  const update = useUpdateEmployee(id ?? 0);
  const [banner, setBanner] = useState<Banner>(null);
  const employee = query.data ?? null;

  if (!session.permissions.canWriteEmployees) {
    return <Notice tone="error" title="Your role can't edit employees.">Viewers can read records only.</Notice>;
  }
  if (id === null || (query.error instanceof ApiError && query.error.status === 404)) return <RecordUnavailable />;
  if (!employee) {
    return query.isError ? (
      <Notice tone="error" title={describeError(query.error).title}>{describeError(query.error).detail}</Notice>
    ) : (
      <div className="max-w-3xl space-y-4" aria-busy>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const reloadLatest = async () => {
    const latest = await query.refetch();
    if (latest.data) setBanner(null); // new version → resetKey changes → form shows the latest values
  };

  const save = (values: EmployeeFormValues, setError: Parameters<Parameters<typeof EmployeeForm>[0]['onSubmit']>[1], markClean: (v?: EmployeeFormValues) => void) => {
    setBanner(null);
    const input = toInput(values);
    const patch = diff(input, employee);
    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save.');
      return;
    }
    update.mutate(
      { patch, version: employee.version },
      {
        onSuccess: (res) => {
          markClean();
          toast[res.meta.changed ? 'success' : 'info'](res.meta.changed ? 'Employee updated.' : 'No changes to save.');
          router.push(`/employees/${res.data.id}`);
        },
        onError: async (err) => {
          if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
            setBanner({ tone: 'warning', title: 'This employee was changed by another user. Reload the latest version.', reload: true });
            return;
          }
          if (err instanceof ApiError && err.status === 404) {
            setBanner({ tone: 'error', title: 'This employee was deleted by another user.' });
            return;
          }
          if (err instanceof ApiError && err.outcomeUnknown) {
            // Check what the server has before offering another save (PRD §10.5).
            try {
              const latest = await api<Employee>(`/api/v1/employees/${employee.id}`);
              const applied = latest.data.version > employee.version && Object.keys(diff(input, latest.data)).length === 0;
              if (applied) {
                markClean();
                toast.success('Employee updated.');
                router.push(`/employees/${employee.id}`);
                return;
              }
            } catch {
              /* still unknown */
            }
            setBanner({ tone: 'warning', title: "We couldn't confirm the save.", detail: 'Reload the latest version and check the values before saving again.', reload: true });
            return;
          }
          if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && applyServerErrors(err.details, setError)) return;
          const { title, detail } = describeError(err);
          setBanner({ tone: 'error', title, detail });
        },
      },
    );
  };

  return (
    <>
      <PageHeader title="Edit employee" meta={<span className="figures">ID {employee.id}</span>} />
      <EmployeeForm
        mode="edit"
        employee={employee}
        defaultValues={valuesFromEmployee(employee)}
        resetKey={employee.version}
        pending={update.isPending}
        banner={
          banner ? (
            <Notice
              tone={banner.tone}
              title={banner.title}
              action={banner.reload ? <Button variant="secondary" size="sm" onClick={() => void reloadLatest()}>Reload latest</Button> : undefined}
            >
              {banner.detail}
            </Notice>
          ) : null
        }
        onCancel={() => router.push(`/employees/${employee.id}`)}
        onSubmit={save}
      />
    </>
  );
}
