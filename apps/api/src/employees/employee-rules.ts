import { DATE_MAX, DATE_MIN, isDateInRange, isIsoDateShape, isRealIsoDate } from '../common/dates.js';
import { fail, ok, type RuleResult } from '../validation/rule.js';

/**
 * Field rules for the 5 business fields (PRD §9.3). Pure functions: used by DTO
 * validation, services (normalization), the seed, and unit tests.
 */

export const DEPARTMENT_IDS = ['engineering', 'marketing', 'sales', 'hr'] as const;
export type DepartmentId = (typeof DEPARTMENT_IDS)[number];

export const NAME_MAX_CODE_POINTS = 100;

// C0/C1 controls (includes CR/LF/TAB) plus Unicode line/paragraph separators.
const CONTROL_CHARS = /[\p{Cc}\u2028\u2029]/u;

function normalizeName(raw: string): string {
  return raw.normalize('NFC').trim();
}

export function nameRule(value: unknown): RuleResult<string> {
  if (typeof value !== 'string') return fail('NAME_REQUIRED', 'Name is required.');
  if (CONTROL_CHARS.test(value)) return fail('NAME_INVALID_CHARACTERS', 'Name cannot contain line breaks or control characters.');
  const name = normalizeName(value);
  if (name.length === 0) return fail('NAME_REQUIRED', 'Name is required.');
  if ([...name].length > NAME_MAX_CODE_POINTS) {
    return fail('NAME_TOO_LONG', `Name must be at most ${NAME_MAX_CODE_POINTS} characters.`);
  }
  return ok(name);
}

export function departmentRule(value: unknown): RuleResult<DepartmentId> {
  if (typeof value !== 'string' || value.length === 0) return fail('DEPARTMENT_REQUIRED', 'Choose a department.');
  if (!(DEPARTMENT_IDS as readonly string[]).includes(value)) {
    return fail('DEPARTMENT_INVALID', 'Department must be one of engineering, marketing, sales or hr.');
  }
  return ok(value as DepartmentId);
}

/**
 * Salary arrives as a decimal string (never a JSON number) and is normalized to
 * exactly two decimals without floating point: "65000" → "65000.00".
 */
export function salaryRule(value: unknown): RuleResult<string> {
  if (typeof value !== 'string') {
    return fail('SALARY_TYPE_INVALID', 'Salary must be sent as a decimal string, for example "65000.00".');
  }
  const s = value.trim();
  if (s.length === 0) return fail('SALARY_REQUIRED', 'Salary is required.');
  if (s.startsWith('-')) return fail('SALARY_NEGATIVE', 'Salary cannot be negative.');
  if (/^\d+\.\d{3,}$/.test(s)) return fail('DECIMAL_SCALE_EXCEEDED', 'Salary must have at most 2 decimal places.');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return fail('SALARY_FORMAT_INVALID', 'Salary must contain digits and an optional decimal point only.');
  const integer = m[1].replace(/^0+(?=\d)/, '');
  const fraction = (m[2] ?? '').padEnd(2, '0');
  if (integer.length > 10) return fail('SALARY_OUT_OF_RANGE', 'Salary must be at most 9,999,999,999.99.');
  return ok(`${integer}.${fraction}`);
}

export function joinDateRule(value: unknown): RuleResult<string> {
  if (typeof value !== 'string' || value.length === 0) return fail('DATE_REQUIRED', 'Join date is required.');
  if (!isIsoDateShape(value)) return fail('DATE_FORMAT_INVALID', 'Join date must use the YYYY-MM-DD format.');
  if (!isRealIsoDate(value)) return fail('DATE_INVALID', 'Join date is not a real calendar date.');
  if (!isDateInRange(value)) return fail('DATE_OUT_OF_RANGE', `Join date must be between ${DATE_MIN} and ${DATE_MAX}.`);
  return ok(value);
}

export function isActiveRule(value: unknown): RuleResult<boolean> {
  if (typeof value !== 'boolean') return fail('BOOLEAN_REQUIRED', 'isActive must be true or false.');
  return ok(value);
}

/** Excel "Status" → isActive. Explicit mapping; `Boolean("In Active")` would be true (PRD §4.3). */
export function statusFromExcel(status: string): boolean {
  if (status === 'Active') return true;
  if (status === 'In Active') return false;
  throw new Error(`Unknown Excel status "${status}"`);
}

export function statusLabel(isActive: boolean): 'Active' | 'In Active' {
  return isActive ? 'Active' : 'In Active';
}

export interface EmployeeFields {
  name: string;
  departmentId: DepartmentId;
  salary: string;
  joinDate: string;
  isActive: boolean;
}

export const EMPLOYEE_FIELD_RULES = {
  name: nameRule,
  departmentId: departmentRule,
  salary: salaryRule,
  joinDate: joinDateRule,
  isActive: isActiveRule,
} as const;
