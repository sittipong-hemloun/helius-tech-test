'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Notice } from '@/components/common/notice';
import { EMPTY_VALUES, EmployeeForm, toInput } from '@/components/employees/employee-form';
import { PageHeader } from '@/components/layout/app-shell';
import { errorMessage } from '@/lib/api';
import { useCreateEmployee } from '@/lib/queries';

export function NewEmployeeView() {
  const router = useRouter();
  const create = useCreateEmployee();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Add employee" meta="ID and Last updated are set by the system when you save." back={{ href: '/employees', label: 'Employees' }} />
      <EmployeeForm
        mode="create"
        defaultValues={EMPTY_VALUES}
        pending={create.isPending}
        banner={error ? <Notice tone="error" title={error} /> : null}
        onCancel={() => router.push('/employees')}
        onSubmit={(values) => {
          setError(null);
          create.mutate(toInput(values), {
            onSuccess: (employee) => {
              toast.success('Employee created.', { description: `${employee.name} (ID ${employee.id})` });
              router.push(`/employees/${employee.id}`);
            },
            onError: (err) => setError(errorMessage(err)),
          });
        }}
      />
    </>
  );
}
