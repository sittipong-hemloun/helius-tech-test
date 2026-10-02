import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/app-config.js';
import { createFixtureSession, FixtureRefused } from '../../src/testing/session-fixture.js';
import {
  ADMIN_EMAIL,
  asUser,
  login,
  ORIGIN,
  resetData,
  startApp,
  testEnv,
  VIEWER_EMAIL,
  WORKER_TOKEN,
  type TestContext,
} from '../support/harness.js';

const DANA = { name: 'Dana Lee', departmentId: 'engineering', salary: '62000.00', joinDate: '2026-09-01', isActive: true };

describe('role projections and authorization (AC-26..AC-28, §11.3)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await startApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => resetData(ctx));

  it('Admin sees Salary and CRUD permissions (AC-26)', async () => {
    const admin = await login(ctx, ADMIN_EMAIL);
    const list = await ctx.http.get('/api/v1/employees').set('Cookie', admin.cookieHeader).expect(200);
    expect(list.body.data[0]).toHaveProperty('salary', '65000.00');
    const session = await ctx.http.get('/api/auth/session').set('Cookie', admin.cookieHeader).expect(200);
    expect(session.body.data).toMatchObject({
      user: { email: ADMIN_EMAIL, role: 'ADMIN', displayName: 'Test Admin' },
      permissions: { canWriteEmployees: true, canViewSalary: true, canGenerateReports: true, canViewIntegrations: true },
      csrfToken: admin.csrfToken,
    });
    expect(session.headers['cache-control']).toBe('no-store');
  });

  it('Viewer responses have no salary key at all and salary sort is forbidden (AC-27)', async () => {
    const viewer = await login(ctx, VIEWER_EMAIL);
    const list = await ctx.http.get('/api/v1/employees').set('Cookie', viewer.cookieHeader).expect(200);
    for (const e of list.body.data) expect(Object.keys(e)).not.toContain('salary');
    expect(JSON.stringify(list.body)).not.toMatch(/65000|salary/i);
    const detail = await ctx.http.get('/api/v1/employees/104').set('Cookie', viewer.cookieHeader).expect(200);
    expect(Object.keys(detail.body.data).sort()).toEqual(
      ['departmentId', 'departmentName', 'id', 'isActive', 'joinDate', 'lastUpdatedDate', 'name', 'version'].sort(),
    );
    const sort = await ctx.http.get('/api/v1/employees?sortBy=salary').set('Cookie', viewer.cookieHeader).expect(403);
    expect(sort.body.error.code).toBe('FORBIDDEN');
    const session = await ctx.http.get('/api/auth/session').set('Cookie', viewer.cookieHeader).expect(200);
    expect(session.body.data.permissions).toEqual({
      canWriteEmployees: false,
      canViewSalary: false,
      canGenerateReports: false,
      canViewIntegrations: false,
    });
  });

  it('Viewer mutations via the API are 403 and change nothing (AC-28)', async () => {
    const viewer = await login(ctx, VIEWER_EMAIL);
    const before = await ctx.prisma.$queryRaw`SELECT * FROM employees ORDER BY id`;
    await ctx.http.post('/api/v1/employees').set(asUser(viewer, { 'Idempotency-Key': randomUUID() })).send(DANA).expect(403);
    await ctx.http.patch('/api/v1/employees/101').set(asUser(viewer, { 'If-Match': '"1"' })).send({ name: 'X' }).expect(403);
    await ctx.http.delete('/api/v1/employees/101').set(asUser(viewer, { 'If-Match': '"1"' })).expect(403);
    await ctx.http.get('/api/v1/integrations/status').set('Cookie', viewer.cookieHeader).expect(403);
    expect(await ctx.prisma.$queryRaw`SELECT * FROM employees ORDER BY id`).toEqual(before);
  });

  it('unauthenticated and service-token callers cannot use employee endpoints', async () => {
    const anon = await ctx.http.get('/api/v1/employees').expect(401);
    expect(anon.body.error).toMatchObject({ code: 'UNAUTHENTICATED' });
    await ctx.http.get('/api/v1/employees').set('Authorization', `Bearer ${WORKER_TOKEN}`).expect(401);
    await ctx.http.get('/api/v1/departments').expect(401);
  });

  it('internal endpoints ignore session cookies and require the right token scope', async () => {
    const admin = await login(ctx, ADMIN_EMAIL);
    await ctx.http.post('/internal/v1/report-jobs/claim').set(asUser(admin)).send({}).expect(401);
    const wrongScope = await ctx.http.post('/internal/v1/reports/scheduled').set('Authorization', `Bearer ${WORKER_TOKEN}`).send({}).expect(401);
    expect(wrongScope.body.error.code).toBe('INVALID_SERVICE_TOKEN');
    await ctx.http.post('/internal/v1/report-jobs/claim').set('Authorization', `Bearer ${WORKER_TOKEN}`).send({}).expect(200);
  });

  it('OpenAPI UI and document are Admin-only', async () => {
    const admin = await login(ctx, ADMIN_EMAIL);
    const viewer = await login(ctx, VIEWER_EMAIL);
    await ctx.http.get('/api/openapi.json').expect(401);
    await ctx.http.get('/api/openapi.json').set('Cookie', viewer.cookieHeader).expect(403);
    const doc = await ctx.http.get('/api/openapi.json').set('Cookie', admin.cookieHeader).expect(200);
    expect(doc.body.paths['/api/v1/employees']).toBeDefined();
    await ctx.http.get('/api/docs/').set('Cookie', viewer.cookieHeader).expect(403);
    // No YAML copy of the document is served (and the path is guarded anyway).
    await ctx.http.get('/api/docs-yaml').expect(401);
    const yaml = await ctx.http.get('/api/docs-yaml').set('Cookie', admin.cookieHeader);
    expect(yaml.status).toBe(404);
  });

  it('health endpoints are public and reveal nothing internal', async () => {
    const live = await ctx.http.get('/api/health/live').expect(200);
    expect(live.body).toEqual({ status: 'ok' });
    const ready = await ctx.http.get('/api/health/ready').expect(200);
    expect(ready.body).toEqual({ status: 'ready' });
  });

  it('rejects bodies over 32 KB and non-JSON bodies', async () => {
    const admin = await login(ctx, ADMIN_EMAIL);
    const big = await ctx.http
      .post('/api/v1/employees')
      .set(asUser(admin, { 'Idempotency-Key': randomUUID() }))
      .send({ ...DANA, name: 'x'.repeat(40_000) })
      .expect(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    await ctx.http
      .post('/api/v1/employees')
      .set(asUser(admin, { 'Idempotency-Key': randomUUID(), 'Content-Type': 'text/plain' }))
      .send('name=Dana')
      .expect(415);
    const malformed = await ctx.http
      .post('/api/v1/employees')
      .set(asUser(admin, { 'Idempotency-Key': randomUUID(), 'Content-Type': 'application/json' }))
      .send('{"name":')
      .expect(400);
    expect(malformed.body.error.code).toBe('MALFORMED_JSON');
  });
});

describe('CSRF and origin checks (AC-32)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await startApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => resetData(ctx));

  it('cookie-authenticated mutations without/with wrong CSRF or foreign Origin are 403 with no side effects', async () => {
    const admin = await login(ctx, ADMIN_EMAIL);
    const key = { 'Idempotency-Key': randomUUID() };
    const cases = [
      { Cookie: admin.cookieHeader, ...key },
      { Cookie: admin.cookieHeader, 'X-CSRF-Token': 'wrong-token', ...key },
      { Cookie: admin.cookieHeader, 'X-CSRF-Token': admin.csrfToken, Origin: 'http://evil.example', ...key },
    ];
    for (const headers of cases) {
      const res = await ctx.http.post('/api/v1/employees').set(headers).send(DANA).expect(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    }
    await ctx.http.patch('/api/v1/employees/101').set({ Cookie: admin.cookieHeader, 'If-Match': '"1"' }).send({ name: 'X' }).expect(403);
    await ctx.http.post('/api/auth/logout').set({ Cookie: admin.cookieHeader }).expect(403);
    const count = await ctx.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM employees`;
    expect(count[0].n).toBe(5);
    // A client without Origin (e.g. Postman) still works with a valid session + CSRF token.
    await ctx.http
      .post('/api/v1/employees')
      .set({ Cookie: admin.cookieHeader, 'X-CSRF-Token': admin.csrfToken, 'Idempotency-Key': randomUUID() })
      .send(DANA)
      .expect(201);
  });

  it('a CSRF token from another session is rejected', async () => {
    const a = await login(ctx, ADMIN_EMAIL);
    const b = await login(ctx, ADMIN_EMAIL);
    await ctx.http
      .post('/api/v1/employees')
      .set({ Cookie: a.cookieHeader, 'X-CSRF-Token': b.csrfToken, Origin: ORIGIN, 'Idempotency-Key': randomUUID() })
      .send(DANA)
      .expect(403);
  });
});

describe('session lifetime and logout (AC-31)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await startApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => resetData(ctx));

  it('logout destroys the server session and clears the cookie', async () => {
    const admin = await login(ctx, ADMIN_EMAIL);
    const res = await ctx.http.post('/api/auth/logout').set(asUser(admin)).expect(204);
    expect(res.headers['set-cookie']?.[0]).toMatch(/employee_console\.test\.sid=;/);
    await ctx.http.get('/api/auth/session').set('Cookie', admin.cookieHeader).expect(401);
    const rows = await ctx.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM sessions`;
    expect(rows[0].n).toBe(0);
  });

  it('idle timeout: an expired store entry is no longer accepted', async () => {
    const idle = await login(ctx, ADMIN_EMAIL, { idleMs: -1000 });
    await ctx.http.get('/api/auth/session').set('Cookie', idle.cookieHeader).expect(401);
  });

  it('absolute timeout (8h) applies even with recent activity', async () => {
    const admin = await login(ctx, ADMIN_EMAIL);
    await ctx.http.get('/api/auth/session').set('Cookie', admin.cookieHeader).expect(200);
    ctx.clock.advance(8 * 60 * 60_000);
    const res = await ctx.http.get('/api/auth/session').set('Cookie', admin.cookieHeader).expect(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
    ctx.clock.set('2026-10-01T03:00:00Z');
  });

  it('active requests refresh the idle window via a rolling cookie', async () => {
    const admin = await login(ctx, ADMIN_EMAIL);
    const res = await ctx.http.get('/api/v1/employees').set('Cookie', admin.cookieHeader).expect(200);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Domain=/);
  });
});

describe('allowlist changes apply on the next request (AC-33)', () => {
  it('uses the role from the current configuration, not the one at login', async () => {
    const email = 'switch@example.test';
    let ctx = await startApp({ VIEWER_EMAILS: `${VIEWER_EMAIL},${email}` });
    await resetData(ctx);
    const s = await login(ctx, email);
    expect(s.role).toBe('VIEWER');
    const asViewer = await ctx.http.get('/api/v1/employees/101').set('Cookie', s.cookieHeader).expect(200);
    expect(asViewer.body.data.salary).toBeUndefined();
    await ctx.close();

    ctx = await startApp({ ADMIN_EMAILS: `${ADMIN_EMAIL},${email}` });
    const asAdmin = await ctx.http.get('/api/v1/employees/101').set('Cookie', s.cookieHeader).expect(200);
    expect(asAdmin.body.data.salary).toBe('65000.00');
    await ctx.close();

    ctx = await startApp();
    const removed = await ctx.http.get('/api/v1/employees/101').set('Cookie', s.cookieHeader).expect(403);
    expect(removed.body.error.code).toBe('ACCOUNT_NOT_ALLOWED');
    await ctx.http.get('/api/v1/employees/101').set('Cookie', s.cookieHeader).expect(401); // session destroyed
    await ctx.close();
  });
});

describe('session fixtures are test-only (AC-34)', () => {
  it('refuses when the database purpose does not match APP_ENV', async () => {
    const ctx = await startApp();
    const perfConfig = loadConfig(testEnv({ APP_ENV: 'performance', PERF_RATE_LIMIT_OVERRIDE: 'true', RATE_LIMIT_ENABLED: 'true' }));
    await expect(createFixtureSession(ctx.prisma, perfConfig, { email: ADMIN_EMAIL })).rejects.toBeInstanceOf(FixtureRefused);
    const disabled = loadConfig(testEnv({ AUTH_FIXTURES_ENABLED: 'false' }));
    await expect(createFixtureSession(ctx.prisma, disabled, { email: ADMIN_EMAIL })).rejects.toThrow(/AUTH_FIXTURES_ENABLED/);
    await expect(createFixtureSession(ctx.prisma, ctx.config, { email: 'nobody@example.test' })).rejects.toThrow(/not in/);
    await ctx.close();
  });

  it('staging configuration cannot enable fixtures', () => {
    expect(() => loadConfig(testEnv({ APP_ENV: 'staging' }))).toThrow(/AUTH_FIXTURES_ENABLED/);
  });

  it('exposes no HTTP route that issues sessions', async () => {
    const ctx = await startApp();
    for (const path of ['/api/test/session', '/api/auth/test-session', '/api/auth/fixture', '/api/v1/test/session']) {
      const res = await ctx.http.post(path).send({ email: ADMIN_EMAIL });
      expect([401, 404]).toContain(res.status);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
    await ctx.close();
  });
});

describe('rate limits (PRD §11.4)', () => {
  it('limits login starts per IP and returns Retry-After', async () => {
    const ctx = await startApp({ RATE_LIMIT_ENABLED: 'true' });
    for (let i = 0; i < 10; i += 1) await ctx.http.get('/api/auth/login?role=ADMIN').expect(302);
    const limited = await ctx.http.get('/api/auth/login?role=ADMIN').expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    // Through the proxy, a client's own X-Forwarded-For entries come first and the proxy appends the
    // address it saw (here 127.0.0.1). Only that last hop is believed, so forged entries change nothing.
    await ctx.http.get('/api/auth/login?role=ADMIN').set('X-Forwarded-For', '203.0.113.7, 127.0.0.1').expect(429);
    await ctx.http.get('/api/auth/login?role=ADMIN').set('X-Forwarded-For', '198.51.100.1, 203.0.113.9, 127.0.0.1').expect(429);
    await ctx.close();
  });

  it('limits writes to 60/minute per session', async () => {
    const ctx = await startApp({ RATE_LIMIT_ENABLED: 'true' });
    await resetData(ctx);
    const admin = await login(ctx, ADMIN_EMAIL);
    let last = 0;
    for (let i = 0; i < 61; i += 1) {
      const res = await ctx.http.patch('/api/v1/employees/999').set(asUser(admin, { 'If-Match': '"1"' })).send({ name: 'x' });
      last = res.status;
    }
    expect(last).toBe(429);
    await ctx.close();
  });
});

describe('local role-based authentication', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await startApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => resetData(ctx));

  it('GET /api/auth/login?role=ADMIN logs in as admin, sets session cookie and redirects to /employees', async () => {
    const res = await ctx.http.get('/api/auth/login?role=ADMIN').expect(302);
    expect(res.headers.location).toBe(`${ORIGIN}/employees`);
    const cookie = res.headers['set-cookie']?.[0]?.split(';')[0];
    expect(cookie).toBeTruthy();

    const sessionRes = await ctx.http.get('/api/auth/session').set('Cookie', cookie!).expect(200);
    expect(sessionRes.body.data.user.role).toBe('ADMIN');
    expect(sessionRes.body.data.permissions.canWriteEmployees).toBe(true);
  });

  it('GET /api/auth/login?role=VIEWER logs in as viewer, sets session cookie and redirects to /employees', async () => {
    const res = await ctx.http.get('/api/auth/login?role=VIEWER').expect(302);
    expect(res.headers.location).toBe(`${ORIGIN}/employees`);
    const cookie = res.headers['set-cookie']?.[0]?.split(';')[0];
    expect(cookie).toBeTruthy();

    const sessionRes = await ctx.http.get('/api/auth/session').set('Cookie', cookie!).expect(200);
    expect(sessionRes.body.data.user.role).toBe('VIEWER');
    expect(sessionRes.body.data.permissions.canWriteEmployees).toBe(false);
    expect(sessionRes.body.data.permissions.canViewSalary).toBe(false);
  });

  it('POST /api/auth/login logs in programmatically with JSON response', async () => {
    const res = await ctx.http.post('/api/auth/login').send({ role: 'ADMIN' }).expect(200);
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.csrfToken).toBeTruthy();
    const cookie = res.headers['set-cookie']?.[0]?.split(';')[0];
    expect(cookie).toBeTruthy();
  });

  it('POST /api/auth/login with unauthorized email is rejected with 403', async () => {
    const res = await ctx.http.post('/api/auth/login').send({ email: 'stranger@nowhere.test' }).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('providers endpoint returns google configured false for backward compatibility', async () => {
    const res = await ctx.http.get('/api/auth/providers').expect(200);
    expect(res.body.data).toEqual({ google: { configured: false } });
  });

  it('logout destroys session and clears cookie', async () => {
    const admin = await login(ctx, ADMIN_EMAIL);
    const res = await ctx.http.post('/api/auth/logout').set(asUser(admin)).expect(204);
    expect(res.headers['set-cookie']).toBeDefined();
    await ctx.http.get('/api/auth/session').set('Cookie', admin.cookieHeader).expect(401);
  });
});
