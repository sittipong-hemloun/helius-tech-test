import type { components } from '@employee-console/api-client';

export type DepartmentId = components['schemas']['EmployeeDto']['departmentId'];

// Mirrors GET /api/v1/departments (fixed seed, PRD §9.2); static so URL params and form defaults never wait on async options.
const DEPARTMENT_LIST = [
  { id: 'engineering', name: 'Engineering' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'sales', name: 'Sales' },
  { id: 'hr', name: 'HR' },
] as const satisfies readonly { id: DepartmentId; name: string }[];

/** API department ids missing from the list above; must stay `never`. */
type Unlisted = Exclude<DepartmentId, (typeof DEPARTMENT_LIST)[number]['id']>;

/** Typed `never` (so typecheck fails here) when the API enum gains a department that is not listed. */
export const DEPARTMENT_OPTIONS: [Unlisted] extends [never] ? typeof DEPARTMENT_LIST : never = DEPARTMENT_LIST;

export function isDepartmentId(value: string): value is DepartmentId {
  return DEPARTMENT_OPTIONS.some((d) => d.id === value);
}
