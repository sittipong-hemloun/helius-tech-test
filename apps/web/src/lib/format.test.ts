import { describe, expect, it } from 'vitest';
import { formatDateOnly, formatSalary, formatTimestamp } from './format';
import { formatSalaryInput, parseSalaryInput } from './salary';
import { readListParams, toSearch, DEFAULT_PARAMS } from './list-params';

describe('formatSalary (#,##0.00, REQ-15)', () => {
  it('formats exact decimal strings', () => {
    expect(formatSalary('65000.00')).toBe('65,000.00');
    expect(formatSalary('0.00')).toBe('0.00');
    expect(formatSalary('9999999999.99')).toBe('9,999,999,999.99');
    expect(formatSalary('1234567.5')).toBe('1,234,567.50');
  });
});

describe('formatDateOnly (no timezone shift, AC-11)', () => {
  it('formats YYYY-MM-DD without constructing a Date', () => {
    expect(formatDateOnly('2023-01-15')).toBe('15 Jan 2023');
    expect(formatDateOnly('2022-11-10')).toBe('10 Nov 2022');
    expect(formatDateOnly('2024-02-29')).toBe('29 Feb 2024');
  });
  it('shows timestamps in Bangkok time', () => {
    expect(formatTimestamp('2026-10-01T03:00:00.000Z')).toBe('01 Oct 2026, 10:00');
    expect(formatTimestamp('2026-09-30T17:30:00.000Z')).toBe('01 Oct 2026, 00:30');
  });
});

describe('salary input', () => {
  it('accepts commas typed by users and produces the canonical string', () => {
    expect(parseSalaryInput('65,000')).toEqual({ ok: true, canonical: '65000.00' });
    expect(parseSalaryInput(' 62000.5 ')).toEqual({ ok: true, canonical: '62000.50' });
    expect(formatSalaryInput('63000')).toBe('63,000.00');
  });
  it('never rounds silently', () => {
    expect(parseSalaryInput('65000.999')).toMatchObject({ ok: false, message: expect.stringContaining('2 decimal') });
    expect(parseSalaryInput('-5').ok).toBe(false);
    expect(parseSalaryInput('1e5').ok).toBe(false);
    expect(parseSalaryInput('').ok).toBe(false);
  });
});

describe('list params ↔ URL', () => {
  const sp = (s: string) => new URLSearchParams(s);
  it('round-trips non-default state and drops invalid values', () => {
    const p = readListParams(sp('q=john&departmentId=engineering&status=inactive&page=2&pageSize=10&sortBy=name&sortOrder=desc'), true);
    expect(toSearch(p)).toBe('?q=john&departmentId=engineering&status=inactive&page=2&pageSize=10&sortBy=name&sortOrder=desc');
    expect(readListParams(sp('pageSize=999&status=x&departmentId=Finance'), true)).toEqual(DEFAULT_PARAMS);
  });
  it('ignores salary sort for viewers', () => {
    expect(readListParams(sp('sortBy=salary'), false).sortBy).toBe('id');
    expect(readListParams(sp('sortBy=salary'), true).sortBy).toBe('salary');
  });
});
