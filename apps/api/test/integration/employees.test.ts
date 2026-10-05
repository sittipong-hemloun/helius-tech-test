import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seed } from '../../src/seed.js';
import { startApp, type TestApp } from './app.js';

const DANA = { name: 'Dana Lee', departmentId: 'engineering', salary: '62000.00', joinDate: '2026-09-01', isActive: true };

const SOURCE = {
  101: { name: 'John Doe', departmentId: 'engineering', salary: '65000.00', joinDate: '2023-01-15', isActive: true, lastUpdatedDate: '2026-01-10' },
  102: { name: 'Jane Smith', departmentId: 'marketing', salary: '58000.00', joinDate: '2023-03-22', isActive: true, lastUpdatedDate: '2025-12-05' },
  103: { name: 'Alice Wong', departmentId: 'sales', salary: '45000.00', joinDate: '2024-06-01', isActive: true, lastUpdatedDate: '2026-02-14' },
  104: { name: 'Bob Brown', departmentId: 'engineering', salary: '72000.00', joinDate: '2022-11-10', isActive: false, lastUpdatedDate: '2026-03-01' },
  105: { name: 'Charlie Day', departmentId: 'hr', salary: '50000.00', joinDate: '2024-02-19', isActive: true, lastUpdatedDate: '2026-04-20' },
} as const;

let t: TestApp;

beforeAll(async () => {
  t = await startApp();
});
afterAll(async () => t.close());
beforeEach(async () => {
  // "Now" is 2026-10-01 10:00 in Bangkok; only Date is faked, timers keep running.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-01T03:00:00Z') });
  await seed(t.prisma, { reset: true });
});
afterEach(() => {
  vi.useRealTimers();
});

const create = (body: object) => t.http.post('/api/employees').send(body);
const patch = (id: number, version: number | null, body: object) => {
  const req = t.http.patch(`/api/employees/${id}`);
  return (version === null ? req : req.set('If-Match', `"${version}"`)).send(body);
};
const list = (qs = '') => t.http.get(`/api/employees${qs}`);
const ids = (res: { body: { items: { id: number }[] } }) => res.body.items.map((e) => e.id);
const count = () => t.prisma.employee.count();

describe('seed data (AC-01, AC-02, AC-03)', () => {
  it('has the 5 Excel records with every field as in the sheet', async () => {
    const res = await list().expect(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 5, totalPages: 1 });
    expect(ids(res)).toEqual([101, 102, 103, 104, 105]);
    for (const [id, expected] of Object.entries(SOURCE)) {
      const one = await t.http.get(`/api/employees/${id}`).expect(200);
      expect(one.body).toMatchObject({ id: Number(id), ...expected, version: 1 });
    }
  });

  it('seeding again adds nothing and keeps edited values', async () => {
    await patch(101, 1, { name: 'John Edited' }).expect(200);
    expect(await seed(t.prisma)).toBe(0);
    expect(await count()).toBe(5);
    expect((await t.http.get('/api/employees/101')).body.name).toBe('John Edited');
  });
});

describe('create (AC-04..AC-10)', () => {
  it('creates ID 106 with version 1 and today in Bangkok as Last Updated Date', async () => {
    const res = await create(DANA).expect(201);
    expect(res.body).toEqual({ id: 106, ...DANA, departmentName: 'Engineering', lastUpdatedDate: '2026-10-01', version: 1 });
  });

  it('uses the Bangkok day just after midnight in Bangkok (still the previous day in UTC)', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:30:00Z'));
    expect((await create(DANA).expect(201)).body.lastUpdatedDate).toBe('2026-10-02');
  });

  it('rejects system-managed and unknown fields without inserting (AC-05)', async () => {
    for (const extra of [{ id: 999 }, { lastUpdatedDate: '2026-01-01' }, { version: 5 }, { nickname: 'x' }]) {
      const res = await create({ ...DANA, ...extra }).expect(400);
      expect(res.body.message[0]).toMatch(/should not exist/);
    }
    expect(await count()).toBe(5);
  });

  it('trims names and rejects empty, multi-line and too long names (AC-06)', async () => {
    expect((await create({ ...DANA, name: '  สมหญิง  ใจดี ' }).expect(201)).body.name).toBe('สมหญิง  ใจดี');
    expect((await create({ ...DANA, name: "Zoë O'Neil-Smith" }).expect(201)).body.name).toBe("Zoë O'Neil-Smith");
    for (const name of ['   ', 'Line\nBreak', 'a'.repeat(101)]) await create({ ...DANA, name }).expect(400);
  });

  it('accepts only the 4 department ids (AC-07)', async () => {
    for (const departmentId of ['Engineering', 'finance', '']) await create({ ...DANA, departmentId }).expect(400);
  });

  it('stores exact decimals and rejects anything that is not a decimal string (AC-08, AC-09)', async () => {
    for (const [salary, expected] of [
      ['65000', '65000.00'],
      ['0', '0.00'],
      ['9999999999.99', '9999999999.99'],
    ]) {
      expect((await create({ ...DANA, salary }).expect(201)).body.salary).toBe(expected);
    }
    for (const salary of ['-1', '65000.999', 65000, '6.5e4', '65,000.00']) await create({ ...DANA, salary }).expect(400);
  });

  it('accepts real YYYY-MM-DD dates between 1900 and 2100 only (AC-10)', async () => {
    await create({ ...DANA, joinDate: '2024-02-29' }).expect(201);
    for (const joinDate of ['2026-02-30', '2026-09-01T00:00:00Z', '1899-12-31', '09/01/2026']) {
      await create({ ...DANA, joinDate }).expect(400);
    }
  });

  it('accepts only JSON booleans for isActive (AC-12)', async () => {
    for (const isActive of ['false', 0, null]) await create({ ...DANA, isActive }).expect(400);
  });
});

describe('update with If-Match (AC-12..AC-16)', () => {
  it('changes values, bumps the version and stamps today (AC-13)', async () => {
    const res = await patch(104, 1, { isActive: true }).expect(200);
    expect(res.body).toMatchObject({ id: 104, isActive: true, version: 2, lastUpdatedDate: '2026-10-01' });
  });

  it('a failed validation leaves the row untouched (AC-15)', async () => {
    await patch(102, 1, { salary: '-5' }).expect(400);
    await patch(102, 1, { isActive: 'true' }).expect(400);
    await patch(102, 1, { name: null }).expect(400);
    expect((await t.http.get('/api/employees/102')).body).toMatchObject({ ...SOURCE[102], version: 1 });
  });

  it('needs If-Match (428) and refuses a stale version (409) without overwriting (AC-16)', async () => {
    await patch(103, null, { name: 'A' }).expect(428);
    await patch(103, 1, { name: 'Alice W.' }).expect(200);
    const stale = await patch(103, 1, { name: 'Overwrite attempt' }).expect(409);
    expect(stale.body.message).toBe('This employee was changed by another user. Reload the latest version.');
    expect((await t.http.get('/api/employees/103')).body.name).toBe('Alice W.');
  });

  it('three concurrent edits of the same version: exactly one wins', async () => {
    const results = await Promise.all(['First', 'Second', 'Third'].map((name) => patch(105, 1, { name })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect((await t.http.get('/api/employees/105')).body.version).toBe(2);
  });

  it('404 for a missing employee, 400 for a non-numeric id', async () => {
    await patch(999, 1, { name: 'x' }).expect(404);
    await t.http.get('/api/employees/abc').expect(400);
  });
});

describe('delete (AC-16, AC-17)', () => {
  it('needs the current version, removes one row, and never reuses its ID', async () => {
    await create(DANA).expect(201);
    await t.http.delete('/api/employees/106').expect(428);
    await t.http.delete('/api/employees/106').set('If-Match', '"9"').expect(409);
    await t.http.delete('/api/employees/106').set('If-Match', '"1"').expect(204);
    await t.http.get('/api/employees/106').expect(404);
    await t.http.delete('/api/employees/106').set('If-Match', '"1"').expect(404);
    expect(await count()).toBe(5);
    expect((await create({ ...DANA, name: 'Next Person' }).expect(201)).body.id).toBe(107);
  });
});

describe('list: search, filters, sort, pages (AC-21..AC-25)', () => {
  it('name search is case-insensitive "contains" (AC-21)', async () => {
    for (const q of ['john', 'JOHN', ' oh ']) {
      expect((await list(`?q=${encodeURIComponent(q)}`).expect(200)).body.items.map((e: { name: string }) => e.name)).toEqual(['John Doe']);
    }
  });

  it('department + status combine with AND (AC-22)', async () => {
    const res = await list('?departmentId=engineering&status=inactive').expect(200);
    expect(ids(res)).toEqual([104]);
    expect(res.body.total).toBe(1);
  });

  it('treats %, _ and SQL-looking text as plain text (AC-23)', async () => {
    for (const q of ['%', '_', "' OR 1=1 --", '\\']) {
      expect((await list(`?q=${encodeURIComponent(q)}`).expect(200)).body.total).toBe(0);
    }
    await create({ ...DANA, name: '100% Real_Name' }).expect(201);
    expect((await list(`?q=${encodeURIComponent('0% r')}`)).body.total).toBe(1);
    expect((await list(`?q=${encodeURIComponent('l_n')}`)).body.total).toBe(1);
  });

  it('sorts with ID as the tie-breaker and pages the result (AC-24, AC-25)', async () => {
    expect(ids(await list('?sortBy=department'))).toEqual([101, 104, 105, 102, 103]);
    expect(ids(await list('?sortBy=department&sortOrder=desc'))).toEqual([103, 102, 105, 101, 104]);
    expect(ids(await list('?sortBy=name'))).toEqual([103, 104, 105, 102, 101]);
    expect(ids(await list('?sortBy=salary&sortOrder=desc'))).toEqual([104, 101, 102, 105, 103]);
    const page2 = await list('?departmentId=engineering&pageSize=1&page=2').expect(200);
    expect(page2.body).toMatchObject({ items: [{ id: 104 }], page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect((await list('?page=9').expect(200)).body).toMatchObject({ items: [], total: 5, totalPages: 1 });
    expect((await list('?q=zzz').expect(200)).body).toMatchObject({ total: 0, totalPages: 0 });
  });

  it('rejects unknown or invalid query parameters with 400', async () => {
    for (const qs of ['?foo=1', '?pageSize=500', '?page=0', '?sortBy=email', '?status=disabled', '?departmentId=Engineering', '?q=a&q=b']) {
      await list(qs).expect(400);
    }
  });
});
