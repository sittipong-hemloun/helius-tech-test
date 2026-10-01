import { describe, expect, it } from 'vitest';
import { loadSourceData, mapSourceRow } from '../../src/seed/seed-original.js';

describe('Excel source mapping (PRD §4.3, §9.5, AC-01)', () => {
  const source = loadSourceData();
  const rows = source.employees.map((r) => mapSourceRow(r, source.departments));

  it('keeps all 5 rows, IDs 101–105 in order', () => {
    expect(rows.map((r) => r.id)).toEqual([101, 102, 103, 104, 105]);
  });
  it('maps Bob Brown "In Active" to false and the others to true', () => {
    expect(rows.filter((r) => r.isActive)).toHaveLength(4);
    expect(rows.find((r) => r.id === 104)).toMatchObject({ name: 'Bob Brown', isActive: false, departmentId: 'engineering' });
  });
  it('keeps original Last Updated Dates and exact salaries', () => {
    expect(Object.fromEntries(rows.map((r) => [r.id, r.lastUpdatedDate]))).toEqual({
      101: '2026-01-10',
      102: '2025-12-05',
      103: '2026-02-14',
      104: '2026-03-01',
      105: '2026-04-20',
    });
    const sum = rows.reduce((s, r) => s + Number(r.salary) * 100, 0) / 100;
    expect(sum.toFixed(2)).toBe('290000.00');
    expect(rows[0].salary).toBe('65000.00');
  });
  it('matches the source date ranges (PRD §4.4)', () => {
    const joins = rows.map((r) => r.joinDate).sort();
    expect([joins[0], joins.at(-1)]).toEqual(['2022-11-10', '2024-06-01']);
    const updated = rows.map((r) => r.lastUpdatedDate).sort();
    expect([updated[0], updated.at(-1)]).toEqual(['2025-12-05', '2026-04-20']);
    expect(new Set(rows.map((r) => r.departmentId)).size).toBe(4);
  });
});
