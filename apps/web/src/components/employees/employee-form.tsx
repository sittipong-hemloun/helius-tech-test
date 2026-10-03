'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Employee } from '@employee-console/api-client';
import { Loader2, Save } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Controller, useForm, type UseFormSetError } from 'react-hook-form';
import { z } from 'zod';
import { useUnsavedChanges } from '@/components/common/unsaved-changes';
import { formatDateOnly } from '@/lib/format';
import { DEPARTMENT_OPTIONS } from '@/lib/list-params';
import { formatSalaryInput, parseSalaryInput } from '@/lib/salary';
import type { EmployeeInput } from '@/lib/queries';
import type { FieldError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cellInputClass, FormCell } from '@/components/ui/form-cell';

const CONTROL = /[\p{Cc}\u2028\u2029]/u;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(v: string): boolean {
  const m = ISO.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Same rules as the API (PRD §9.3); the server stays the final judge. */
export const employeeSchema = z.object({
  name: z
    .string()
    .refine((v) => v.normalize('NFC').trim().length > 0, 'Name is required.')
    .refine((v) => !CONTROL.test(v), 'Name cannot contain line breaks or control characters.')
    .refine((v) => [...v.normalize('NFC').trim()].length <= 100, 'Name must be at most 100 characters.'),
  departmentId: z.string().refine((v) => DEPARTMENT_OPTIONS.some((d) => d.id === v), 'Choose a department.'),
  salary: z.string().superRefine((v, ctx) => {
    const r = parseSalaryInput(v);
    if (!r.ok) ctx.addIssue({ code: 'custom', message: r.message });
  }),
  joinDate: z
    .string()
    .min(1, 'Join date is required.')
    .refine((v) => isRealDate(v), 'Enter a real date (YYYY-MM-DD).')
    .refine((v) => v >= '1900-01-01' && v <= '2100-12-31', 'Join date must be between 1900 and 2100.'),
  isActive: z.boolean(),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

export function toInput(values: EmployeeFormValues): EmployeeInput {
  const salary = parseSalaryInput(values.salary);
  return {
    name: values.name.normalize('NFC').trim(),
    departmentId: values.departmentId,
    salary: salary.ok ? salary.canonical : values.salary,
    joinDate: values.joinDate,
    isActive: values.isActive,
  };
}

export function valuesFromEmployee(e: Employee): EmployeeFormValues {
  return {
    name: e.name,
    departmentId: e.departmentId,
    salary: formatSalaryInput(e.salary ?? ''),
    joinDate: e.joinDate,
    isActive: e.isActive,
  };
}

export const EMPTY_VALUES: EmployeeFormValues = { name: '', departmentId: '', salary: '', joinDate: '', isActive: true };

const FIELDS = ['name', 'departmentId', 'salary', 'joinDate', 'isActive'] as const;

/** Puts server-side field errors under the matching inputs; returns false when none matched. */
export function applyServerErrors(details: FieldError[], setError: UseFormSetError<EmployeeFormValues>): boolean {
  let matched = false;
  for (const d of details) {
    const field = FIELDS.find((f) => f === d.field);
    if (field) {
      setError(field, { type: 'server', message: d.message }, { shouldFocus: !matched });
      matched = true;
    }
  }
  return matched;
}

interface Props {
  mode: 'create' | 'edit';
  employee?: Employee;
  defaultValues: EmployeeFormValues;
  pending: boolean;
  banner?: ReactNode;
  onSubmit: (values: EmployeeFormValues, setError: UseFormSetError<EmployeeFormValues>, markClean: (v?: EmployeeFormValues) => void) => void;
  onCancel: () => void;
  /** Changes when the server copy is reloaded, so the form can reset to it. */
  resetKey?: string | number;
}

export function EmployeeForm({ mode, employee, defaultValues, pending, banner, onSubmit, onCancel, resetKey }: Props) {
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues,
    mode: 'onTouched',
    shouldFocusError: true,
  });
  const { register, handleSubmit, control, formState, setError, reset } = form;
  const { errors, isDirty } = formState;

  useEffect(() => {
    if (resetKey !== undefined) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const guard = useUnsavedChanges(isDirty && !pending);
  const markClean = (v?: EmployeeFormValues) => reset(v ?? form.getValues());
  const describedBy = (field: keyof EmployeeFormValues) => (errors[field] ? `emp-${field}-error` : undefined);

  return (
    <form noValidate onSubmit={handleSubmit((v) => onSubmit(v, setError, markClean))} className="max-w-3xl" aria-busy={pending}>
      {banner ? <div className="mb-4">{banner}</div> : null}

      <fieldset className={`form-grid mb-4 grid-cols-2 ${employee ? 'sm:grid-cols-3' : ''}`} aria-label="Assigned by the system">
        <FormCell id="emp-id" label="ID" readOnly>
          <output id="emp-id" className="figures block py-0.5 text-[0.9375rem] font-semibold text-ink-2">
            {employee ? employee.id : 'Assigned on save'}
          </output>
        </FormCell>
        <FormCell id="emp-updated" label="Last updated" readOnly>
          <output id="emp-updated" className="figures block py-0.5 text-[0.9375rem] text-ink-2">
            {employee ? formatDateOnly(employee.lastUpdatedDate) : 'Assigned on save'}
          </output>
        </FormCell>
        {employee ? (
          <FormCell id="emp-version" label="Version" readOnly className="hidden sm:block">
            <output id="emp-version" className="figures block py-0.5 text-[0.9375rem] text-ink-2">
              {employee.version}
            </output>
          </FormCell>
        ) : null}
      </fieldset>

      <div className="form-grid sm:grid-cols-2">
        <FormCell id="emp-name" label="Name" error={errors.name?.message} className="sm:col-span-2">
          <input
            id="emp-name"
            type="text"
            autoComplete="off"
            maxLength={150}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy('name')}
            className={cellInputClass}
            {...register('name')}
          />
        </FormCell>

        <FormCell id="emp-departmentId" label="Department" error={errors.departmentId?.message}>
          <select
            id="emp-departmentId"
            aria-invalid={Boolean(errors.departmentId)}
            aria-describedby={describedBy('departmentId')}
            className={`${cellInputClass} cell-select`}
            {...register('departmentId')}
          >
            <option value="" disabled>
              Choose a department
            </option>
            {DEPARTMENT_OPTIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </FormCell>

        <div className="form-cell flex items-center gap-3 px-3 py-2">
          <input
            id="emp-isActive"
            type="checkbox"
            className="size-5 shrink-0 accent-[var(--color-ledger)] focus-visible:outline-none"
            aria-describedby="emp-isActive-hint"
            {...register('isActive')}
          />
          <div>
            <label htmlFor="emp-isActive" className="font-medium">
              Active
            </label>
            <p id="emp-isActive-hint" className="text-[0.75rem] text-ink-2">
              Unchecked means In Active.
            </p>
          </div>
        </div>

        <Controller
          control={control}
          name="salary"
          render={({ field }) => (
            <FormCell id="emp-salary" label="Salary" error={errors.salary?.message} hint="Up to 2 decimal places. No currency.">
              <input
                id="emp-salary"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={Boolean(errors.salary)}
                aria-describedby={describedBy('salary') ?? 'emp-salary-hint'}
                className={`${cellInputClass} figures`}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                // Commas are accepted while typing; reformatting only on blur avoids moving the caret/selection.
                onBlur={() => {
                  field.onChange(formatSalaryInput(field.value));
                  field.onBlur();
                }}
              />
            </FormCell>
          )}
        />

        <FormCell id="emp-joinDate" label="Join date" error={errors.joinDate?.message}>
          <input
            id="emp-joinDate"
            type="date"
            min="1900-01-01"
            max="2100-12-31"
            aria-invalid={Boolean(errors.joinDate)}
            aria-describedby={describedBy('joinDate')}
            className={`${cellInputClass} figures`}
            {...register('joinDate')}
          />
        </FormCell>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => guard(onCancel)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          {pending ? 'Saving…' : mode === 'create' ? 'Save employee' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
