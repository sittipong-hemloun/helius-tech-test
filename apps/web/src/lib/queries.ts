'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type Employee, type EmployeeInput, type EmployeePage } from './api';
import { toSearch, type ListParams } from './list-params';

export function useEmployees(params: ListParams) {
  const search = toSearch(params);
  return useQuery({
    queryKey: ['employees', search],
    // TanStack aborts the superseded request through `signal`, so the latest filter wins.
    queryFn: ({ signal }) => api<EmployeePage>(`/api/employees${search}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(id: number) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: ({ signal }) => api<Employee>(`/api/employees/${id}`, { signal }),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeInput) => api<Employee>('/api/employees', { method: 'POST', body: input }),
    onSuccess: (employee) => {
      qc.setQueryData(['employee', employee.id], employee);
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

/** PATCH only the changed fields; If-Match carries the version the user edited (409 if it changed meanwhile). */
export function useUpdateEmployee(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ patch, version }: { patch: Partial<EmployeeInput>; version: number }) =>
      api<Employee>(`/api/employees/${id}`, { method: 'PATCH', body: patch, headers: { 'If-Match': `"${version}"` } }),
    onSuccess: (employee) => {
      qc.setQueryData(['employee', id], employee);
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) =>
      api<void>(`/api/employees/${id}`, { method: 'DELETE', headers: { 'If-Match': `"${version}"` } }),
    onSettled: (_res, _err, { id }) => {
      qc.removeQueries({ queryKey: ['employee', id] });
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
