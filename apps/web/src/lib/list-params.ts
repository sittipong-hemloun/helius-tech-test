/** Employee list state ↔ URL search params (PRD §8.3: reload/back/forward restore filters). */
export const PAGE_SIZES = [10, 20, 50] as const;
export const DEPARTMENT_OPTIONS = [
  { id: 'engineering', name: 'Engineering' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'sales', name: 'Sales' },
  { id: 'hr', name: 'HR' },
] as const;

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

interface Readable {
  get(name: string): string | null;
}

export function readListParams(sp: Readable): ListParams {
  const int = (v: string | null, fallback: number, ok: (n: number) => boolean) => {
    const n = v && /^\d+$/.test(v) ? Number(v) : NaN;
    return Number.isFinite(n) && ok(n) ? n : fallback;
  };
  const sortBy = sp.get('sortBy') as SortBy | null;
  const status = sp.get('status');
  const dept = sp.get('departmentId') ?? '';
  return {
    q: (sp.get('q') ?? '').slice(0, 100),
    departmentId: DEPARTMENT_OPTIONS.some((d) => d.id === dept) ? dept : '',
    status: status === 'active' || status === 'inactive' ? status : 'all',
    page: int(sp.get('page'), 1, (n) => n >= 1 && n <= 1_000_000),
    pageSize: int(sp.get('pageSize'), 20, (n) => (PAGE_SIZES as readonly number[]).includes(n)),
    sortBy: sortBy && SORTS.includes(sortBy) ? sortBy : 'id',
    sortOrder: sp.get('sortOrder') === 'desc' ? 'desc' : 'asc',
  };
}

/** Only non-default values go into the URL, so the bare /employees is the default view. */
export function toSearch(params: ListParams): string {
  const out = new URLSearchParams();
  if (params.q.trim()) out.set('q', params.q.trim());
  if (params.departmentId) out.set('departmentId', params.departmentId);
  if (params.status !== 'all') out.set('status', params.status);
  if (params.page !== 1) out.set('page', String(params.page));
  if (params.pageSize !== 20) out.set('pageSize', String(params.pageSize));
  if (params.sortBy !== 'id') out.set('sortBy', params.sortBy);
  if (params.sortOrder !== 'asc') out.set('sortOrder', params.sortOrder);
  const s = out.toString();
  return s ? `?${s}` : '';
}

/** API query: the same keys, trimmed search, always explicit paging. */
export function toApiQuery(params: ListParams): string {
  const out = new URLSearchParams();
  if (params.q.trim()) out.set('q', params.q.trim());
  if (params.departmentId) out.set('departmentId', params.departmentId);
  if (params.status !== 'all') out.set('status', params.status);
  out.set('page', String(params.page));
  out.set('pageSize', String(params.pageSize));
  out.set('sortBy', params.sortBy);
  out.set('sortOrder', params.sortOrder);
  return out.toString();
}

export function isFiltered(params: ListParams): boolean {
  return Boolean(params.q.trim() || params.departmentId || params.status !== 'all');
}
