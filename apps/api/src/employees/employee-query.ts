import { DEPARTMENT_IDS, NAME_MAX_CODE_POINTS, type DepartmentId } from './employee-rules.js';
import { fail, ok, type RuleResult } from '../validation/rule.js';

/** List query rules (PRD §10.3). Query values are strings; repeated keys arrive as arrays and are rejected. */

export const SORT_FIELDS = ['id', 'name', 'department', 'joinDate', 'isActive', 'lastUpdatedDate', 'salary'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export const STATUS_FILTERS = ['all', 'active', 'inactive'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

function single(value: unknown, field: string): RuleResult<string> {
  if (typeof value !== 'string') return fail('QUERY_PARAM_INVALID', `${field} must be given once as a single value.`);
  return ok(value);
}

export const qRule = (value: unknown): RuleResult<string> => {
  const s = single(value, 'q');
  if (!s.ok) return s;
  const q = s.value.normalize('NFC').trim();
  if ([...q].length > NAME_MAX_CODE_POINTS) return fail('QUERY_TOO_LONG', 'Search text must be at most 100 characters.');
  return ok(q);
};

export const departmentFilterRule = (value: unknown): RuleResult<DepartmentId> => {
  const s = single(value, 'departmentId');
  if (!s.ok) return s;
  if (!(DEPARTMENT_IDS as readonly string[]).includes(s.value)) {
    return fail('DEPARTMENT_INVALID', 'departmentId must be engineering, marketing, sales or hr.');
  }
  return ok(s.value as DepartmentId);
};

export const statusFilterRule = (value: unknown): RuleResult<StatusFilter> => {
  const s = single(value, 'status');
  if (!s.ok) return s;
  if (!(STATUS_FILTERS as readonly string[]).includes(s.value)) return fail('STATUS_INVALID', 'status must be all, active or inactive.');
  return ok(s.value as StatusFilter);
};

function intRule(field: string, min: number, max: number) {
  return (value: unknown): RuleResult<number> => {
    const s = single(value, field);
    if (!s.ok) return s;
    if (!/^\d{1,7}$/.test(s.value)) return fail('INTEGER_REQUIRED', `${field} must be a whole number.`);
    const n = Number(s.value);
    if (n < min || n > max) return fail('OUT_OF_RANGE', `${field} must be between ${min} and ${max}.`);
    return ok(n);
  };
}

export const pageRule = intRule('page', 1, 1_000_000);
export const pageSizeRule = intRule('pageSize', 1, 100);

export const sortByRule = (value: unknown): RuleResult<SortField> => {
  const s = single(value, 'sortBy');
  if (!s.ok) return s;
  if (!(SORT_FIELDS as readonly string[]).includes(s.value)) {
    return fail('SORT_FIELD_INVALID', `sortBy must be one of ${SORT_FIELDS.join(', ')}.`);
  }
  return ok(s.value as SortField);
};

export const sortOrderRule = (value: unknown): RuleResult<'asc' | 'desc'> => {
  const s = single(value, 'sortOrder');
  if (!s.ok) return s;
  if (s.value !== 'asc' && s.value !== 'desc') return fail('SORT_ORDER_INVALID', 'sortOrder must be asc or desc.');
  return ok(s.value);
};

/** Escapes LIKE metacharacters so user input is always a literal substring (PRD §10.3). */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface ListQuery {
  q: string;
  departmentId: DepartmentId | null;
  status: StatusFilter;
  page: number;
  pageSize: number;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
}
