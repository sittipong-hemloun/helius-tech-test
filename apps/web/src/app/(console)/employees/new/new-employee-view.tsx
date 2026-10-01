'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/app-shell';
import { applyServerErrors, EMPTY_VALUES, EmployeeForm, toInput } from '@/components/employee-form';
import { Notice } from '@/components/notice';
import { ApiError, describeError } from '@/lib/api';
import { useCreateEmployee } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { lastListHref } from '../employees-view';

export function NewEmployeeView() {
  const { session } = useSession();
  const router = useRouter();
  const create = useCreateEmployee();
  // One key per create intent; kept across retries until the outcome is known (PRD §10.5).
  const keyRef = useRef<string>(crypto.randomUUID());
  const [banner, setBanner] = useState<{ title: string; detail?: string; tone: 'error' | 'warning' } | null>(null);

  if (!session.permissions.canWriteEmployees) {
    return (
      <Notice tone="error" title="Your role can't add employees.">
        Viewers can search and read records. Ask an admin if you need a record added.
      </Notice>
    );
  }

  return (
    <>
      <PageHeader title="Add employee" meta="ID and Last updated are set by the system when you save." />
      <EmployeeForm
        mode="create"
        defaultValues={EMPTY_VALUES}
        pending={create.isPending}
        banner={banner ? <Notice tone={banner.tone} title={banner.title}>{banner.detail}</Notice> : null}
        onCancel={() => router.push(lastListHref())}
        onSubmit={(values, setError, markClean) => {
          setBanner(null);
          create.mutate(
            { input: toInput(values), idempotencyKey: keyRef.current },
            {
              onSuccess: (res) => {
                markClean();
                keyRef.current = crypto.randomUUID();
                toast.success('Employee created.', { description: `${res.data.name} (ID ${res.data.id})` });
                router.push(`/employees/${res.data.id}`);
              },
              onError: (err) => {
                if (err instanceof ApiError && err.outcomeUnknown) {
                  // Same key on retry: the server replays the first result instead of creating a duplicate.
                  setBanner({
                    tone: 'warning',
                    title: "We couldn't confirm whether the employee was saved.",
                    detail: 'Select Save employee again — the retry is safe and will not create a duplicate.',
                  });
                  return;
                }
                keyRef.current = crypto.randomUUID(); // definitive answer: the next attempt is a new intent
                if (err instanceof ApiError && err.code === 'IDEMPOTENCY_CONFLICT') {
                  // An earlier, unconfirmed attempt used different values and may have been saved.
                  setBanner({
                    tone: 'warning',
                    title: 'An earlier attempt with different values may already be saved.',
                    detail: 'Check the employee list before saving again.',
                  });
                  return;
                }
                if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && applyServerErrors(err.details, setError)) return;
                const { title, detail } = describeError(err);
                setBanner({ tone: 'error', title, detail });
              },
            },
          );
        }}
      />
    </>
  );
}
