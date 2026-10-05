'use client';

import type { components, Employee, EmployeeListMeta } from '@employee-console/api-client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { toApiQuery, type ListParams } from './list-params';

export type EmployeeInput = components['schemas']['CreateEmployeeDto'];
export type EmployeePatch = components['schemas']['UpdateEmployeeDto'];

export function useEmployees(params: ListParams) {
  const qs = toApiQuery(params);
  return useQuery({
    queryKey: ['employees', qs],
    // TanStack aborts the superseded request through `signal`, so the latest filter wins.
    queryFn: ({ signal }) => api<Employee[], EmployeeListMeta>(`/api/v1/employees?${qs}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** `editing`: fetch fresh on mount, then never refetch in the background so the form is not reset under the user. */
export function useEmployee(id: number | null, { editing = false }: { editing?: boolean } = {}) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: ({ signal }) => api<Employee>(`/api/v1/employees/${id}`, { signal }).then((r) => r.data),
    enabled: id !== null,
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 1,
    ...(editing ? { refetchOnMount: 'always' as const, refetchOnWindowFocus: false, refetchOnReconnect: false } : {}),
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: EmployeeInput; idempotencyKey: string }) =>
      api<Employee>('/api/v1/employees', { method: 'POST', body: input, headers: { 'Idempotency-Key': idempotencyKey } }),
    onSuccess: (res) => {
      qc.setQueryData(['employee', res.data.id], res.data);
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ patch, version }: { patch: EmployeePatch; version: number }) =>
      api<Employee, { changed: boolean }>(`/api/v1/employees/${id}`, {
        method: 'PATCH',
        body: patch,
        headers: { 'If-Match': `"${version}"` },
      }),
    onSuccess: (res) => {
      qc.setQueryData(['employee', id], res.data);
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) =>
      api<void>(`/api/v1/employees/${id}`, { method: 'DELETE', headers: { 'If-Match': `"${version}"` } }),
    onSettled: (_r, _e, vars) => {
      qc.removeQueries({ queryKey: ['employee', vars.id] });
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
