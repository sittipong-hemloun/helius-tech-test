/** The fixed department list; same ids as the API (DEPARTMENT_IDS in apps/api/src/employees/employee.dto.ts). */
export const DEPARTMENTS = [
  { id: 'engineering', name: 'Engineering' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'sales', name: 'Sales' },
  { id: 'hr', name: 'HR' },
] as const;

export function isDepartmentId(value: string): boolean {
  return DEPARTMENTS.some((d) => d.id === value);
}
