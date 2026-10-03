// Contract types generated from apps/api (OpenAPI). Do not hand-edit schema.d.ts.
import type { components } from './schema.js';

type Schemas = components['schemas'];

export type Employee = Schemas['EmployeeDto'];

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
    currentVersion?: number;
  };
}

export type { components, paths } from './schema.js';
