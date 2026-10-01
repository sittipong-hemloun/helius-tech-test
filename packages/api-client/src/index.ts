// Contract types generated from apps/api (OpenAPI). Do not hand-edit schema.d.ts.
import type { components } from './schema.js';

type Schemas = components['schemas'];

export type Employee = Schemas['EmployeeDto'];
export type CreateEmployeeInput = Schemas['CreateEmployeeDto'];
export type UpdateEmployeeInput = Schemas['UpdateEmployeeDto'];
export type Department = Schemas['DepartmentDto'];
export type SessionData = Schemas['SessionDataDto'];
export type ReportSummary = Schemas['ReportSummaryDto'];
export type ReportDetail = Schemas['ReportDetailDto'];
export type Snapshot = Schemas['SnapshotDto'];
export type Narrative = Schemas['NarrativeDto'];
export type IntegrationStatus = Schemas['IntegrationStatusDto'];

export type Role = SessionData['user']['role'];
export type ReportStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface Envelope<T, M = Record<string, unknown>> {
  data: T;
  meta: { requestId: string } & M;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EmployeeListMeta extends PageMeta {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: { field: string; code: string; message: string }[];
    currentReportId?: string | null;
    currentVersion?: number;
  };
}

export type { components, paths } from './schema.js';
