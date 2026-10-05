import { describe, expect, it } from 'vitest';
import { loadSeedData, toEmployeeRow } from '../../src/seed.js';

describe('Excel seed data', () => {
  const { departments, employees } = loadSeedData();
  const rows = employees.map((row) => toEmployeeRow(row, departments));

  it('has the 5 source records and 4 departments', () => {
    expect(rows.map((r) => r.id)).toEqual([101, 102, 103, 104, 105]);
    expect(departments.map((d) => d.name)).toEqual(['Engineering', 'Marketing', 'Sales', 'HR']);
  });

  it('maps Status "Active" / "In Active" to true / false (Bob Brown is In Active)', () => {
    expect(rows.map((r) => r.isActive)).toEqual([true, true, true, false, true]);
  });

  it('keeps salaries as exact 2-decimal strings and dates as UTC midnight', () => {
    const bob = rows.find((r) => r.id === 104)!;
    expect(bob).toMatchObject({ name: 'Bob Brown', departmentId: 'engineering', salary: '72000.00' });
    expect(bob.joinDate.toISOString()).toBe('2022-11-10T00:00:00.000Z');
    expect(bob.lastUpdatedDate.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('fails loudly on an unknown department', () => {
    expect(() => toEmployeeRow({ ...employees[0], Department: 'Finance' }, departments)).toThrow(/Unknown department/);
  });
});
