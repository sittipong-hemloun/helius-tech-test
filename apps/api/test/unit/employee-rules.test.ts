import { describe, expect, it } from 'vitest';
import {
  departmentRule,
  isActiveRule,
  joinDateRule,
  nameRule,
  salaryRule,
  statusFromExcel,
  statusLabel,
} from '../../src/employees/employee-rules.js';

const code = (r: { ok: boolean; code?: string }) => (r.ok ? 'OK' : r.code);

describe('nameRule (REQ-13, AC-06)', () => {
  it('trims and NFC-normalizes', () => {
    expect(nameRule('  Dana Lee  ')).toEqual({ ok: true, value: 'Dana Lee' });
    // "é" as e + combining acute → single code point
    expect(nameRule('Amélie')).toEqual({ ok: true, value: 'Amélie' });
  });
  it('accepts Thai, apostrophes and hyphens', () => {
    expect(nameRule('สมชาย ใจดี').ok).toBe(true);
    expect(nameRule("O'Brien-Smith, Jr.").ok).toBe(true);
  });
  it('rejects empty, whitespace-only, control characters and line breaks', () => {
    expect(code(nameRule(''))).toBe('NAME_REQUIRED');
    expect(code(nameRule('   '))).toBe('NAME_REQUIRED');
    expect(code(nameRule('Bad\nName'))).toBe('NAME_INVALID_CHARACTERS');
    expect(code(nameRule('Bad\u0007'))).toBe('NAME_INVALID_CHARACTERS');
    expect(code(nameRule(null))).toBe('NAME_REQUIRED');
    expect(code(nameRule(42))).toBe('NAME_REQUIRED');
  });
  it('counts Unicode code points (100 ok, 101 rejected)', () => {
    expect(nameRule('ก'.repeat(100)).ok).toBe(true);
    expect(code(nameRule('ก'.repeat(101)))).toBe('NAME_TOO_LONG');
    expect(nameRule('😀'.repeat(100)).ok).toBe(true); // 200 UTF-16 units, 100 code points
  });
});

describe('departmentRule (REQ-14, AC-07)', () => {
  it('accepts the four ids', () => {
    for (const id of ['engineering', 'marketing', 'sales', 'hr']) expect(departmentRule(id).ok).toBe(true);
  });
  it('rejects labels, unknown ids and empty values', () => {
    expect(code(departmentRule('Engineering'))).toBe('DEPARTMENT_INVALID');
    expect(code(departmentRule('finance'))).toBe('DEPARTMENT_INVALID');
    expect(code(departmentRule(''))).toBe('DEPARTMENT_REQUIRED');
  });
});

describe('salaryRule (REQ-15, AC-08, AC-09)', () => {
  it('normalizes exact decimals to two places', () => {
    expect(salaryRule('65000')).toEqual({ ok: true, value: '65000.00' });
    expect(salaryRule('65000.5')).toEqual({ ok: true, value: '65000.50' });
    expect(salaryRule('0')).toEqual({ ok: true, value: '0.00' });
    expect(salaryRule('9999999999.99')).toEqual({ ok: true, value: '9999999999.99' });
    expect(salaryRule('00012.30')).toEqual({ ok: true, value: '12.30' });
  });
  it('rejects JSON numbers, commas, currency, exponent, negatives, scale > 2 and > max', () => {
    expect(code(salaryRule(65000))).toBe('SALARY_TYPE_INVALID');
    expect(code(salaryRule('65,000.00'))).toBe('SALARY_FORMAT_INVALID');
    expect(code(salaryRule('$65000'))).toBe('SALARY_FORMAT_INVALID');
    expect(code(salaryRule('6.5e4'))).toBe('SALARY_FORMAT_INVALID');
    expect(code(salaryRule('NaN'))).toBe('SALARY_FORMAT_INVALID');
    expect(code(salaryRule('-1'))).toBe('SALARY_NEGATIVE');
    expect(code(salaryRule('65000.999'))).toBe('DECIMAL_SCALE_EXCEEDED');
    expect(code(salaryRule('10000000000.00'))).toBe('SALARY_OUT_OF_RANGE');
    expect(code(salaryRule(''))).toBe('SALARY_REQUIRED');
  });
});

describe('joinDateRule (REQ-16, AC-10)', () => {
  it('accepts real ISO dates in range, including leap day and future dates', () => {
    expect(joinDateRule('2024-02-29').ok).toBe(true);
    expect(joinDateRule('2099-12-31').ok).toBe(true);
    expect(joinDateRule('1900-01-01').ok).toBe(true);
    expect(joinDateRule('2100-12-31').ok).toBe(true);
  });
  it('rejects impossible dates, datetimes, ambiguous formats and out-of-range dates', () => {
    expect(code(joinDateRule('2026-02-30'))).toBe('DATE_INVALID');
    expect(code(joinDateRule('2025-02-29'))).toBe('DATE_INVALID');
    expect(code(joinDateRule('2026-09-01T00:00:00Z'))).toBe('DATE_FORMAT_INVALID');
    expect(code(joinDateRule('01/09/2026'))).toBe('DATE_FORMAT_INVALID');
    expect(code(joinDateRule('1899-12-31'))).toBe('DATE_OUT_OF_RANGE');
    expect(code(joinDateRule('2101-01-01'))).toBe('DATE_OUT_OF_RANGE');
  });
});

describe('isActive and Excel status mapping (REQ-17, AC-12)', () => {
  it('accepts only JSON booleans', () => {
    expect(isActiveRule(true).ok).toBe(true);
    expect(isActiveRule(false).ok).toBe(true);
    for (const bad of ['false', 'true', 0, 1, null]) expect(code(isActiveRule(bad))).toBe('BOOLEAN_REQUIRED');
  });
  it('maps "In Active" to false explicitly (Boolean("In Active") would be true)', () => {
    expect(Boolean('In Active')).toBe(true);
    expect(statusFromExcel('In Active')).toBe(false);
    expect(statusFromExcel('Active')).toBe(true);
    expect(() => statusFromExcel('Inactive')).toThrow();
    expect(statusLabel(false)).toBe('In Active');
  });
});
