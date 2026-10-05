/** Employee list state ↔ URL search params, so reload/back/forward restore the filters (PRD §8.3). */
import { isDepartmentId } from './departments';

export const PAGE_SIZES = [10, 20, 50] as const;

export type SortBy = 'id' | 'name' | 'department' | 'salary' | 'joinDate' | 'isActive' | 'lastUpdatedDate';
export type StatusFilter = 'all' | 'active' | 'inactive';

export interface ListParams {
  q: string;
  departmentId: string;
  status: StatusFilter;
  page: number;
  pageSize: number;
  sortBy: SortBy;
  sortOrder: 'asc' | 'desc';
}

/** Same defaults as the API, so the URL (and the API query) only carries what differs. */
export const DEFAULT_PARAMS: ListParams = {
  q: '',
  departmentId: '',
  status: 'all',
  page: 1,
  pageSize: 20,
  sortBy: 'id',
  sortOrder: 'asc',
};

const SORTS: SortBy[] = ['id', 'name', 'department', 'salary', 'joinDate', 'isActive', 'lastUpdatedDate'];

/** Reads the URL; anything invalid falls back to the default. */
export function readListParams(sp: { get(name: string): string | null }): ListParams {
  const page = Number(sp.get('page'));
  const pageSize = Number(sp.get('pageSize'));
  const sortBy = sp.get('sortBy') as SortBy;
  const status = sp.get('status');
  const departmentId = sp.get('departmentId') ?? '';
  return {
    q: (sp.get('q') ?? '').slice(0, 100),
    departmentId: isDepartmentId(departmentId) ? departmentId : '',
    status: status === 'active' || status === 'inactive' ? status : 'all',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : 20,
    sortBy: SORTS.includes(sortBy) ? sortBy : 'id',
    sortOrder: sp.get('sortOrder') === 'desc' ? 'desc' : 'asc',
  };
}

/** `?…` with the non-default values only; '' for the default view. Used for both the page URL and the API call. */
export function toSearch(params: ListParams): string {
  const out = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_PARAMS) as (keyof ListParams)[]) {
    const value = key === 'q' ? params.q.trim() : params[key];
    if (value !== DEFAULT_PARAMS[key]) out.set(key, String(value));
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}

export function isFiltered(params: ListParams): boolean {
  return Boolean(params.q.trim() || params.departmentId || params.status !== 'all');
}
