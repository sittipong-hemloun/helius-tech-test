import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedOriginal } from '../../src/seed/seed-original.js';
import { resetData, startApp, type TestContext } from '../support/harness.js';

const DANA = { name: 'Dana Lee', departmentId: 'engineering', salary: '62000.00', joinDate: '2026-09-01', isActive: true };

const SOURCE = {
  101: { name: 'John Doe', departmentId: 'engineering', salary: '65000.00', joinDate: '2023-01-15', isActive: true, lastUpdatedDate: '2026-01-10' },
  102: { name: 'Jane Smith', departmentId: 'marketing', salary: '58000.00', joinDate: '2023-03-22', isActive: true, lastUpdatedDate: '2025-12-05' },
  103: { name: 'Alice Wong', departmentId: 'sales', salary: '45000.00', joinDate: '2024-06-01', isActive: true, lastUpdatedDate: '2026-02-14' },
  104: { name: 'Bob Brown', departmentId: 'engineering', salary: '72000.00', joinDate: '2022-11-10', isActive: false, lastUpdatedDate: '2026-03-01' },
  105: { name: 'Charlie Day', departmentId: 'hr', salary: '50000.00', joinDate: '2024-02-19', isActive: true, lastUpdatedDate: '2026-04-20' },
} as const;

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.close());
beforeEach(async () => resetData(ctx));

async function dbRow(id: number) {
  const rows = await ctx.prisma.$queryRaw<
    { name: string; salary: string; version: number; last_updated_date: string; updated_at: Date; is_active: boolean }[]
  >`SELECT name, salary::text, version, last_updated_date::text, updated_at, is_active FROM employees WHERE id = ${id}`;
  return rows[0];
}

const create = (body: unknown, key = randomUUID()) => ctx.http.post('/api/v1/employees').set('Idempotency-Key', key).send(body as object);

describe('seed data (AC-01, AC-02, AC-03)', () => {
  it('fresh migrate+seed has 5 records, 4 departments, 4/1 status and salary sum 290000.00', async () => {
    const res = await ctx.http.get('/api/v1/employees').expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 5, totalPages: 1, sortBy: 'id', sortOrder: 'asc' });
    expect(res.body.data.map((e: { id: number }) => e.id)).toEqual([101, 102, 103, 104, 105]);
    const sum = res.body.data.reduce((s: number, e: { salary: string }) => s + Math.round(Number(e.salary) * 100), 0);
    expect((sum / 100).toFixed(2)).toBe('290000.00');
    expect(res.body.data.filter((e: { isActive: boolean }) => e.isActive)).toHaveLength(4);
    const depts = await ctx.http.get('/api/v1/departments').expect(200);
    expect(depts.body.data).toEqual([
      { id: 'engineering', name: 'Engineering', sortOrder: 1 },
      { id: 'marketing', name: 'Marketing', sortOrder: 2 },
      { id: 'sales', name: 'Sales', sortOrder: 3 },
      { id: 'hr', name: 'HR', sortOrder: 4 },
    ]);
  });

  it('every source field matches Appendix C for Admin detail', async () => {
    for (const [id, expected] of Object.entries(SOURCE)) {
      const res = await ctx.http.get(`/api/v1/employees/${id}`).expect(200);
      expect(res.body.data).toMatchObject({ id: Number(id), ...expected, version: 1 });
      expect(res.headers.etag).toBe('"1"');
    }
  });

  it('seeding again does not add rows or overwrite edited values', async () => {
    const before = await ctx.http.get('/api/v1/employees/101');
    await ctx.http
      .patch('/api/v1/employees/101')
      .set({ 'If-Match': `"${before.body.data.version}"` })
      .send({ name: 'John Edited' })
      .expect(200);
    const edited = await dbRow(101);
    const result = await seedOriginal(ctx.prisma);
    expect(result.employeesInserted).toBe(0);
    expect(await dbRow(101)).toEqual(edited);
    const count = await ctx.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM employees`;
    expect(count[0].n).toBe(5);
  });
});

describe('create (AC-04, AC-05, AC-06..AC-10, AC-19, AC-20)', () => {
  it('creates ID 106 with version 1 and today (Bangkok) as Last Updated Date', async () => {
    const res = await create(DANA).expect(201);
    expect(res.body.data).toEqual({
      id: 106,
      name: 'Dana Lee',
      departmentId: 'engineering',
      departmentName: 'Engineering',
      salary: '62000.00',
      joinDate: '2026-09-01',
      isActive: true,
      lastUpdatedDate: '2026-10-01',
      version: 1,
    });
    expect(res.headers.location).toBe('/api/v1/employees/106');
    expect(res.headers.etag).toBe('"1"');
    expect(res.body.meta.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-request-id']).toBe(res.body.meta.requestId);
  });

  it('uses the Bangkok day near midnight UTC', async () => {
    ctx.clock.set('2026-10-01T17:30:00Z'); // 00:30 on 2 Oct in Bangkok
    const res = await create(DANA).expect(201);
    expect(res.body.data.lastUpdatedDate).toBe('2026-10-02');
    ctx.clock.set('2026-10-01T03:00:00Z');
  });

  it('persists after an application restart (AC-04)', async () => {
    await create(DANA).expect(201);
    await ctx.close();
    ctx = await startApp();
    const res = await ctx.http.get('/api/v1/employees/106').expect(200);
    expect(res.body.data.name).toBe('Dana Lee');
  });

  it('rejects system-managed fields and unknown fields without inserting (AC-05)', async () => {
    for (const extra of [{ id: 999 }, { lastUpdatedDate: '2026-01-01' }, { version: 5 }, { nickname: 'x' }]) {
      const res = await create({ ...DANA, ...extra }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(['READ_ONLY_FIELD', 'UNKNOWN_FIELD']).toContain(res.body.error.details[0].code);
    }
    const count = await ctx.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM employees`;
    expect(count[0].n).toBe(5);
  });

  it('normalizes names and rejects invalid ones (AC-06)', async () => {
    const thai = await create({ ...DANA, name: '  สมหญิง  ใจดี ' }).expect(201);
    expect(thai.body.data.name).toBe('สมหญิง  ใจดี');
    const punct = await create({ ...DANA, name: "Zoë O'Neil-Smith" }).expect(201);
    expect(punct.body.data.name).toBe("Zoë O'Neil-Smith");
    for (const [name, code] of [
      ['   ', 'NAME_REQUIRED'],
      ['Line\nBreak', 'NAME_INVALID_CHARACTERS'],
      ['a'.repeat(101), 'NAME_TOO_LONG'],
    ] as const) {
      const res = await create({ ...DANA, name }).expect(400);
      expect(res.body.error.details[0]).toMatchObject({ field: 'name', code });
    }
  });

  it('rejects unknown departments and labels (AC-07)', async () => {
    for (const departmentId of ['Engineering', 'finance', '']) {
      const res = await create({ ...DANA, departmentId }).expect(400);
      expect(res.body.error.details[0].field).toBe('departmentId');
    }
  });

  it('stores exact decimals and rejects unsafe salary inputs (AC-08, AC-09)', async () => {
    for (const [salary, expected] of [
      ['65000', '65000.00'],
      ['0', '0.00'],
      ['9999999999.99', '9999999999.99'],
    ]) {
      const res = await create({ ...DANA, salary }).expect(201);
      expect(res.body.data.salary).toBe(expected);
      expect((await dbRow(res.body.data.id)).salary).toBe(expected);
    }
    for (const [salary, code] of [
      ['-1', 'SALARY_NEGATIVE'],
      ['65000.999', 'DECIMAL_SCALE_EXCEEDED'],
      [65000, 'SALARY_TYPE_INVALID'],
      ['6.5e4', 'SALARY_FORMAT_INVALID'],
      ['65,000.00', 'SALARY_FORMAT_INVALID'],
    ] as const) {
      const res = await create({ ...DANA, salary }).expect(400);
      expect(res.body.error.details[0]).toMatchObject({ field: 'salary', code });
      if (typeof salary === "string" && salary.length > 4) expect(JSON.stringify(res.body)).not.toContain(String(salary)); // input never echoed
    }
  });

  it('accepts real dates in range only (AC-10)', async () => {
    await create({ ...DANA, joinDate: '2024-02-29' }).expect(201);
    await create({ ...DANA, joinDate: '2030-01-01' }).expect(201);
    for (const joinDate of ['2026-02-30', '2026-09-01T00:00:00Z', '1899-12-31', '09/01/2026']) {
      const res = await create({ ...DANA, joinDate }).expect(400);
      expect(res.body.error.details[0].field).toBe('joinDate');
    }
  });

  it('accepts only JSON booleans for isActive (AC-12)', async () => {
    for (const isActive of ['false', 0, null]) {
      const res = await create({ ...DANA, isActive }).expect(400);
      expect(res.body.error.details[0]).toMatchObject({ field: 'isActive', code: 'BOOLEAN_REQUIRED' });
    }
  });

  it('requires a UUID Idempotency-Key', async () => {
    const res = await ctx.http.post('/api/v1/employees').send(DANA).expect(400);
    expect(res.body.error.code).toBe('INVALID_IDEMPOTENCY_KEY');
  });

  it('replays the same key+payload and rejects the same key with another payload (AC-19)', async () => {
    const key = randomUUID();
    const first = await create(DANA, key).expect(201);
    const replay = await create(DANA, key).expect(201);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.data).toEqual(first.body.data);
    const conflict = await create({ ...DANA, salary: '1.00' }, key).expect(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    const count = await ctx.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM employees WHERE name = 'Dana Lee'`;
    expect(count[0].n).toBe(1);
  });

  it('two concurrent POSTs with the same key create exactly one row (AC-19)', async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => create(DANA, key)));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
    expect(results.filter((r) => r.headers['idempotency-replayed'] === 'true')).toHaveLength(4);
    const count = await ctx.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM employees WHERE name = 'Dana Lee'`;
    expect(count[0].n).toBe(1);
  });

  it('a retry after a lost response returns the committed record (AC-20)', async () => {
    const key = randomUUID();
    await create(DANA, key); // response "lost" — the client never looked at it
    const retry = await create(DANA, key).expect(201);
    expect(retry.body.data.id).toBe(106);
    expect(retry.headers['idempotency-replayed']).toBe('true');
  });
});

describe('update (AC-12..AC-16)', () => {
  it('changes values, bumps version and stamps today (AC-13)', async () => {
    const before = await dbRow(104);
    ctx.clock.set('2026-10-01T05:00:00Z');
    const res = await ctx.http
      .patch('/api/v1/employees/104')
      .set({ 'If-Match': '"1"' })
      .send({ isActive: true })
      .expect(200);
    expect(res.body.data).toMatchObject({ id: 104, isActive: true, version: 2, lastUpdatedDate: '2026-10-01' });
    expect(res.body.meta.changed).toBe(true);
    expect(res.headers.etag).toBe('"2"');
    const after = await dbRow(104);
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
    expect(after.is_active).toBe(true);
  });

  it('rejects string booleans on PATCH (AC-12)', async () => {
    const res = await ctx.http
      .patch('/api/v1/employees/104')
      .set({ 'If-Match': '"1"' })
      .send({ isActive: 'true' })
      .expect(400);
    expect(res.body.error.details[0].code).toBe('BOOLEAN_REQUIRED');
  });

  it('an unchanged PATCH after normalization is a no-op (AC-14)', async () => {
    const before = await dbRow(101);
    const res = await ctx.http
      .patch('/api/v1/employees/101')
      .set({ 'If-Match': '"1"' })
      .send({ name: '  John Doe ', salary: '65000', isActive: true })
      .expect(200);
    expect(res.body.meta.changed).toBe(false);
    expect(res.body.data).toMatchObject({ version: 1, lastUpdatedDate: '2026-01-10' });
    expect(await dbRow(101)).toEqual(before);
  });

  it('reads, searches and failed validation leave rows untouched (AC-15)', async () => {
    const before = await dbRow(102);
    await ctx.http.get('/api/v1/employees/102').expect(200);
    await ctx.http.get('/api/v1/employees?q=jane').expect(200);
    await ctx.http.patch('/api/v1/employees/102').set({ 'If-Match': '"1"' }).send({ salary: '-5' }).expect(400);
    expect(await dbRow(102)).toEqual(before);
  });

  it('requires If-Match (428) and rejects stale versions (409) without overwriting (AC-16)', async () => {
    await ctx.http.patch('/api/v1/employees/103').send({ name: 'A' }).expect(428);
    await ctx.http.patch('/api/v1/employees/103').set({ 'If-Match': '"1"' }).send({ name: 'Alice W.' }).expect(200);
    const stale = await ctx.http
      .patch('/api/v1/employees/103')
      .set({ 'If-Match': '"1"' })
      .send({ name: 'Overwrite attempt' })
      .expect(409);
    expect(stale.body.error).toMatchObject({ code: 'VERSION_CONFLICT', currentVersion: 2 });
    expect((await dbRow(103)).name).toBe('Alice W.');
  });

  it('concurrent PATCHes with the same version: exactly one wins', async () => {
    const results = await Promise.all(
      ['First', 'Second', 'Third'].map((name) =>
        ctx.http.patch('/api/v1/employees/105').set({ 'If-Match': '"1"' }).send({ name }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect((await dbRow(105)).version).toBe(2);
  });

  it('rejects empty and null-only PATCH bodies', async () => {
    const empty = await ctx.http.patch('/api/v1/employees/101').set({ 'If-Match': '"1"' }).send({}).expect(400);
    expect(empty.body.error.details[0].code).toBe('EMPTY_PATCH');
    const nulls = await ctx.http.patch('/api/v1/employees/101').set({ 'If-Match': '"1"' }).send({ name: null }).expect(400);
    expect(nulls.body.error.details[0].field).toBe('name');
  });

  it('returns 404 for a missing id', async () => {
    await ctx.http.patch('/api/v1/employees/999').set({ 'If-Match': '"1"' }).send({ name: 'x' }).expect(404);
    await ctx.http.get('/api/v1/employees/abc').expect(404);
  });
});

describe('delete (AC-16, AC-17)', () => {
  it('deletes one row, then 404; other rows unchanged; IDs are not reused', async () => {
    const created = await create(DANA).expect(201);
    await ctx.http.delete('/api/v1/employees/106').expect(428);
    await ctx.http.delete('/api/v1/employees/106').set({ 'If-Match': '"9"' }).expect(409);
    const del = await ctx.http.delete('/api/v1/employees/106').set({ 'If-Match': `"${created.body.data.version}"` }).expect(204);
    expect(del.text).toBe('');
    expect(del.headers['x-request-id']).toBeTruthy();
    await ctx.http.get('/api/v1/employees/106').expect(404);
    await ctx.http.delete('/api/v1/employees/106').set({ 'If-Match': '"1"' }).expect(404);
    const list = await ctx.http.get('/api/v1/employees').expect(200);
    expect(list.body.meta.total).toBe(5);
    const next = await create({ ...DANA, name: 'Next Person' }).expect(201);
    expect(next.body.data.id).toBe(107);
  });
});

describe('listing, search and filters (AC-21..AC-25)', () => {
  const list = (qs: string) => ctx.http.get(`/api/v1/employees${qs}`);

  it('name search is case-insensitive contains (AC-21)', async () => {
    for (const q of ['john', 'JOHN', ' oh ']) {
      const res = await list(`?q=${encodeURIComponent(q)}`).expect(200);
      expect(res.body.data.map((e: { name: string }) => e.name)).toEqual(['John Doe']);
    }
  });

  it('Engineering + inactive finds Bob Brown; clearing returns 5 (AC-22)', async () => {
    const res = await list('?departmentId=engineering&status=inactive').expect(200);
    expect(res.body.data.map((e: { id: number }) => e.id)).toEqual([104]);
    expect(res.body.meta.total).toBe(1);
    expect((await list('').expect(200)).body.meta.total).toBe(5);
  });

  it('treats %, _ and SQL-looking text as literals (AC-23)', async () => {
    for (const q of ['%', '_', "' OR 1=1 --", '\\']) {
      const res = await list(`?q=${encodeURIComponent(q)}`).expect(200);
      expect(res.body.meta.total).toBe(0);
    }
    await create({ ...DANA, name: '100% Real_Name' }).expect(201);
    expect((await list(`?q=${encodeURIComponent('0% r')}`)).body.data.map((e: { name: string }) => e.name)).toEqual(['100% Real_Name']);
    expect((await list(`?q=${encodeURIComponent('l_n')}`)).body.data.map((e: { name: string }) => e.name)).toEqual(['100% Real_Name']);
  });

  it('sorts stably with id as tiebreaker and paginates (AC-24, AC-25)', async () => {
    const byDept = await list('?sortBy=department&sortOrder=asc').expect(200);
    expect(byDept.body.data.map((e: { id: number }) => e.id)).toEqual([101, 104, 105, 102, 103]);
    const byDeptDesc = await list('?sortBy=department&sortOrder=desc').expect(200);
    expect(byDeptDesc.body.data.map((e: { id: number }) => e.id)).toEqual([103, 102, 105, 101, 104]);
    const byName = await list('?sortBy=name').expect(200);
    expect(byName.body.data.map((e: { name: string }) => e.name)).toEqual(['Alice Wong', 'Bob Brown', 'Charlie Day', 'Jane Smith', 'John Doe']);
    const page = await list('?departmentId=engineering&pageSize=1&page=2').expect(200);
    expect(page.body.data.map((e: { id: number }) => e.id)).toEqual([104]);
    expect(page.body.meta).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    const beyond = await list('?page=9').expect(200);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.meta).toMatchObject({ total: 5, totalPages: 1 });
    const none = await list('?q=zzz').expect(200);
    expect(none.body.meta).toMatchObject({ total: 0, totalPages: 0 });
  });

  it('matches the PRD list example (Engineering, pageSize=1)', async () => {
    const res = await list('?departmentId=engineering&pageSize=1').expect(200);
    expect(res.body).toMatchObject({
      data: [
        {
          id: 101,
          name: 'John Doe',
          departmentId: 'engineering',
          departmentName: 'Engineering',
          salary: '65000.00',
          joinDate: '2023-01-15',
          isActive: true,
          lastUpdatedDate: '2026-01-10',
          version: 1,
        },
      ],
      meta: { page: 1, pageSize: 1, total: 2, totalPages: 2, sortBy: 'id', sortOrder: 'asc' },
    });
  });

  it('rejects unknown query keys and invalid values with INVALID_QUERY', async () => {
    for (const qs of ['?foo=1', '?pageSize=500', '?sortBy=email', '?status=disabled', '?departmentId=Engineering', '?q=a&q=b']) {
      const res = await list(qs).expect(400);
      expect(res.body.error.code).toBe('INVALID_QUERY');
    }
  });
});
