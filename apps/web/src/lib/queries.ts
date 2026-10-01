'use client';

import type {
  Department,
  Employee,
  EmployeeListMeta,
  IntegrationStatus,
  PageMeta,
  ReportDetail,
  ReportSummary,
} from '@employee-console/api-client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { toApiQuery, type ListParams } from './list-params';
import { useSession } from './session';

export interface EmployeeInput {
  name: string;
  departmentId: string;
  salary: string;
  joinDate: string;
  isActive: boolean;
}

export function useEmployees(params: ListParams) {
  const { scope } = useSession();
  const qs = toApiQuery(params);
  return useQuery({
    queryKey: [...scope, 'employees', qs],
    // TanStack aborts the superseded request through `signal`, so the latest filter wins.
    queryFn: ({ signal }) => api<Employee[], EmployeeListMeta>(`/api/v1/employees?${qs}`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(id: number | null) {
  const { scope } = useSession();
  return useQuery({
    queryKey: [...scope, 'employee', id],
    queryFn: ({ signal }) => api<Employee>(`/api/v1/employees/${id}`, { signal }).then((r) => r.data),
    enabled: id !== null,
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 1,
  });
}

export function useDepartments() {
  const { scope } = useSession();
  return useQuery({
    queryKey: [...scope, 'departments'],
    queryFn: ({ signal }) => api<Department[]>('/api/v1/departments', { signal }).then((r) => r.data),
    staleTime: 60 * 60_000,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  const { scope } = useSession();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: EmployeeInput; idempotencyKey: string }) =>
      api<Employee>('/api/v1/employees', { method: 'POST', body: input, headers: { 'Idempotency-Key': idempotencyKey } }),
    onSuccess: (res) => {
      qc.setQueryData([...scope, 'employee', res.data.id], res.data);
      void qc.invalidateQueries({ queryKey: [...scope, 'employees'] });
    },
  });
}

export function useUpdateEmployee(id: number) {
  const qc = useQueryClient();
  const { scope } = useSession();
  return useMutation({
    mutationFn: ({ patch, version }: { patch: Partial<EmployeeInput>; version: number }) =>
      api<Employee, { changed: boolean }>(`/api/v1/employees/${id}`, {
        method: 'PATCH',
        body: patch,
        headers: { 'If-Match': `"${version}"` },
      }),
    onSuccess: (res) => {
      qc.setQueryData([...scope, 'employee', id], res.data);
      void qc.invalidateQueries({ queryKey: [...scope, 'employees'] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  const { scope } = useSession();
  return useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) =>
      api<void>(`/api/v1/employees/${id}`, { method: 'DELETE', headers: { 'If-Match': `"${version}"` } }),
    onSettled: (_r, _e, vars) => {
      qc.removeQueries({ queryKey: [...scope, 'employee', vars.id] });
      void qc.invalidateQueries({ queryKey: [...scope, 'employees'] });
    },
  });
}

export function useReports(page: number) {
  const { scope } = useSession();
  return useQuery({
    queryKey: [...scope, 'reports', page],
    queryFn: ({ signal }) => api<ReportSummary[], PageMeta>(`/api/v1/reports?page=${page}&pageSize=20`, { signal }),
    placeholderData: keepPreviousData,
    // Keep the list fresh while something is still being generated.
    refetchInterval: (q) => (q.state.data?.data.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING') ? 2000 : false),
  });
}

export function useReport(id: string) {
  const { scope } = useSession();
  return useQuery({
    queryKey: [...scope, 'report', id],
    queryFn: ({ signal }) => api<ReportDetail>(`/api/v1/reports/${id}`, { signal }).then((r) => r.data),
    // Poll every 2s until terminal (PRD §10.6); stops when the page unmounts.
    refetchInterval: (q) => (q.state.data && (q.state.data.status === 'QUEUED' || q.state.data.status === 'RUNNING') ? 2000 : false),
    refetchIntervalInBackground: false,
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 1,
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  const { scope } = useSession();
  return useMutation({
    mutationFn: (idempotencyKey: string) =>
      api<ReportSummary>('/api/v1/reports', { method: 'POST', body: {}, headers: { 'Idempotency-Key': idempotencyKey } }),
    onSettled: () => void qc.invalidateQueries({ queryKey: [...scope, 'reports'] }),
  });
}

export function useIntegrations() {
  const { scope } = useSession();
  return useQuery({
    queryKey: [...scope, 'integrations'],
    queryFn: ({ signal }) => api<IntegrationStatus>('/api/v1/integrations/status', { signal }).then((r) => r.data),
    refetchInterval: 15_000,
  });
}

export function useReadiness() {
  return useQuery({
    queryKey: ['health', 'ready'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/health/ready', { cache: 'no-store', signal });
      return res.ok;
    },
    refetchInterval: 15_000,
  });
}
