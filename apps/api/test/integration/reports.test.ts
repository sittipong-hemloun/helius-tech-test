import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ReportMaintenanceService } from '../../src/reports/report-maintenance.service.js';
import type { FixtureSession } from '../../src/testing/session-fixture.js';
import {
  ADMIN_EMAIL,
  asUser,
  DEFAULT_NOW,
  login,
  resetData,
  SCHEDULER_TOKEN,
  startApp,
  VIEWER_EMAIL,
  WORKER_TOKEN,
  type TestContext,
} from '../support/harness.js';

let ctx: TestContext;
let admin: FixtureSession;
let viewer: FixtureSession;

const worker = () => ({ Authorization: `Bearer ${WORKER_TOKEN}` });
const scheduler = () => ({ Authorization: `Bearer ${SCHEDULER_TOKEN}` });

const NARRATIVE = {
  headline: 'ภาพรวมพนักงานจากข้อมูลปัจจุบัน',
  bullets: [
    'มีพนักงานทั้งหมด 5 รายการ แบ่งเป็น Active 4 รายการ และ In Active 1 รายการ',
    'Engineering มี 2 รายการ ส่วน Marketing, Sales และ HR มีแผนกละ 1 รายการ',
    'รายการที่มีสถานะ In Active อยู่ในแผนก Engineering',
  ],
};

beforeAll(async () => {
  ctx = await startApp();
});
afterAll(async () => ctx.close());
beforeEach(async () => {
  ctx.clock.set(DEFAULT_NOW);
  await resetData(ctx);
  admin = await login(ctx, ADMIN_EMAIL);
  viewer = await login(ctx, VIEWER_EMAIL);
});

const generate = (key = randomUUID(), s = admin) =>
  ctx.http.post('/api/v1/reports').set(asUser(s, { 'Idempotency-Key': key })).send({});
const claim = () => ctx.http.post('/internal/v1/report-jobs/claim').set(worker()).send({});
const complete = (id: string, body: object) => ctx.http.post(`/internal/v1/report-jobs/${id}/complete`).set(worker()).send(body);
const failJob = (id: string, leaseToken: string, errorCode: string) =>
  ctx.http.post(`/internal/v1/report-jobs/${id}/fail`).set(worker()).send({ leaseToken, errorCode });
const detail = (id: string, s = admin) => ctx.http.get(`/api/v1/reports/${id}`).set('Cookie', s.cookieHeader);
const maintenance = () => ctx.app.get(ReportMaintenanceService).tick();

const geminiResult = (leaseToken: string) => ({
  leaseToken,
  generatedBy: 'GEMINI',
  model: 'gemini-3.5-flash-lite',
  promptVersion: 'employee-summary-v1',
  narrative: NARRATIVE,
});

describe('report creation (AC-36..AC-38)', () => {
  it('Admin gets 202 with a QUEUED report and a snapshot computed from the DB (AC-36)', async () => {
    const started = Date.now();
    const res = await generate().expect(202);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(res.headers.location).toBe(`/api/v1/reports/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      status: 'QUEUED',
      source: 'MANUAL',
      totalEmployees: 5,
      completedAt: null,
      generatedBy: null,
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'employee-summary-v1',
      errorCode: null,
      snapshotCapturedAt: DEFAULT_NOW,
    });
    const d = await detail(res.body.data.id).expect(200);
    expect(d.body.data.snapshot).toEqual({
      schemaVersion: 1,
      capturedAt: DEFAULT_NOW,
      businessDate: '2026-10-01',
      timezone: 'Asia/Bangkok',
      totalEmployees: 5,
      activeEmployees: 4,
      inactiveEmployees: 1,
      departments: [
        { id: 'engineering', name: 'Engineering', total: 2, active: 1, inactive: 1 },
        { id: 'marketing', name: 'Marketing', total: 1, active: 1, inactive: 0 },
        { id: 'sales', name: 'Sales', total: 1, active: 1, inactive: 0 },
        { id: 'hr', name: 'HR', total: 1, active: 1, inactive: 0 },
      ],
    });
    expect(d.body.data.narrative).toBeNull();
  });

  it('the snapshot stays fixed when employees change afterwards', async () => {
    const res = await generate().expect(202);
    await ctx.http.delete('/api/v1/employees/105').set(asUser(admin, { 'If-Match': '"1"' })).expect(204);
    const d = await detail(res.body.data.id).expect(200);
    expect(d.body.data.snapshot.totalEmployees).toBe(5);
  });

  it('Viewer cannot generate or see integrations but can read reports (AC-37)', async () => {
    await generate(randomUUID(), viewer).expect(403);
    await ctx.http.get('/api/v1/integrations/status').set('Cookie', viewer.cookieHeader).expect(403);
    const res = await generate().expect(202);
    const list = await ctx.http.get('/api/v1/reports').set('Cookie', viewer.cookieHeader).expect(200);
    expect(list.body.data[0].id).toBe(res.body.data.id);
    await detail(res.body.data.id, viewer).expect(200);
  });

  it('same key replays; a new key while a job is active is 409 with currentReportId (AC-38)', async () => {
    const key = randomUUID();
    const first = await generate(key).expect(202);
    const replay = await generate(key).expect(202);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.data.id).toBe(first.body.data.id);
    const other = await generate().expect(409);
    expect(other.body.error).toMatchObject({ code: 'REPORT_IN_PROGRESS', currentReportId: first.body.data.id });
    const concurrent = await Promise.all([generate(), generate(), generate()]);
    expect(concurrent.every((r) => r.status === 409)).toBe(true);
    const rows = await ctx.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM reports`;
    expect(rows[0].n).toBe(1);
  });

  it('concurrent first requests with different keys still create one active job', async () => {
    const results = await Promise.all([generate(), generate(), generate(), generate()]);
    expect(results.filter((r) => r.status === 202)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
  });

  it('returns 503 AI_NOT_CONFIGURED and creates nothing when reports are disabled', async () => {
    const off = await startApp({ REPORTS_ENABLED: 'false' });
    const s = await login(off, ADMIN_EMAIL);
    const res = await off.http.post('/api/v1/reports').set(asUser(s, { 'Idempotency-Key': randomUUID() })).send({}).expect(503);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
    await off.close();
    const rows = await ctx.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM reports`;
    expect(rows[0].n).toBe(0);
  });

  it('enforces 10 manual reports per hour including failed ones', async () => {
    for (let i = 0; i < 10; i += 1) {
      const r = await generate().expect(202);
      const job = (await claim().expect(200)).body.data;
      await failJob(r.body.data.id, job.leaseToken, 'PROVIDER_AUTH_ERROR').expect(200);
    }
    const limited = await generate().expect(429);
    expect(limited.body.error.code).toBe('REPORT_QUOTA_EXCEEDED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    ctx.clock.advance(61 * 60_000);
    admin = await login(ctx, ADMIN_EMAIL);
    await generate().expect(202);
  });

  it('rejects unknown body fields and invalid list queries', async () => {
    await ctx.http.post('/api/v1/reports').set(asUser(admin, { 'Idempotency-Key': randomUUID() })).send({ filter: 'x' }).expect(400);
    await ctx.http.get('/api/v1/reports?status=DONE').set('Cookie', admin.cookieHeader).expect(400);
    await ctx.http.get('/api/v1/reports?departmentId=hr').set('Cookie', admin.cookieHeader).expect(400);
    await detail('not-a-uuid').expect(404);
    await detail(randomUUID()).expect(404);
  });
});

describe('worker claim/complete/fail (AC-39..AC-45, AC-47, AC-48)', () => {
  it('only one of many concurrent claims gets the job (AC-39)', async () => {
    await generate().expect(202);
    const results = await Promise.all(Array.from({ length: 6 }, () => claim()));
    const jobs = results.map((r) => r.body.data).filter(Boolean);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ attempt: 1, model: 'gemini-3.5-flash-lite', promptVersion: 'employee-summary-v1' });
    const empty = await claim().expect(200);
    expect(empty.body.data).toBeNull();
  });

  it('claim payload is aggregate-only: no names, salaries, emails or employee IDs (AC-48)', async () => {
    await generate().expect(202);
    const job = (await claim()).body.data;
    const text = JSON.stringify(job.snapshot);
    for (const forbidden of ['John', 'Doe', 'Bob', '65000', '72000', '@', '"101"', ':101', 'salary', 'email']) {
      expect(text).not.toContain(forbidden);
    }
    expect(Object.keys(job.snapshot).sort()).toEqual(
      ['activeEmployees', 'businessDate', 'capturedAt', 'departments', 'inactiveEmployees', 'schemaVersion', 'timezone', 'totalEmployees'].sort(),
    );
  });

  it('valid completion → SUCCEEDED with metadata; duplicate same result is a 200 no-op; different result 409 (AC-40, AC-45)', async () => {
    const r = await generate().expect(202);
    const job = (await claim()).body.data;
    ctx.clock.advance(5000);
    const done = await complete(r.body.data.id, geminiResult(job.leaseToken)).expect(200);
    expect(done.body.data).toEqual({ reportId: r.body.data.id, status: 'SUCCEEDED' });
    const d = await detail(r.body.data.id).expect(200);
    expect(d.body.data).toMatchObject({
      status: 'SUCCEEDED',
      generatedBy: 'GEMINI',
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'employee-summary-v1',
      errorCode: null,
      narrative: NARRATIVE,
      completedAt: new Date(new Date(DEFAULT_NOW).getTime() + 5000).toISOString(),
    });
    await complete(r.body.data.id, geminiResult(job.leaseToken)).expect(200);
    const diff = await complete(r.body.data.id, { ...geminiResult(job.leaseToken), narrative: { ...NARRATIVE, headline: 'อื่น' } }).expect(409);
    expect(diff.body.error.code).toBe('REPORT_ALREADY_COMPLETED');
    expect((await detail(r.body.data.id)).body.data.narrative).toEqual(NARRATIVE);
  });

  it('rejects malformed narratives and mismatched model/prompt version', async () => {
    const r = await generate().expect(202);
    const job = (await claim()).body.data;
    const bad = [
      { narrative: { headline: 'x', bullets: ['a', 'b'] } },
      { narrative: { headline: '<script>x</script>', bullets: ['a', 'b', 'c'] } },
      { narrative: { ...NARRATIVE, extra: 1 } },
      { model: 'some-other-model' },
      { promptVersion: 'employee-summary-v0' },
      { generatedBy: 'TEMPLATE', model: null },
    ];
    for (const patch of bad) await complete(r.body.data.id, { ...geminiResult(job.leaseToken), ...patch }).expect(400);
    await ctx.http
      .post(`/internal/v1/report-jobs/${r.body.data.id}/complete`)
      .set(worker())
      .send({ ...geminiResult(job.leaseToken), snapshot: { totalEmployees: 999 } })
      .expect(400);
    expect((await detail(r.body.data.id)).body.data.status).toBe('RUNNING');
  });

  it('retryable failures back off 30s then 60s and fail after 3 attempts (AC-41)', async () => {
    const r = await generate().expect(202);
    const id = r.body.data.id;
    let job = (await claim()).body.data;
    expect((await failJob(id, job.leaseToken, 'PROVIDER_RATE_LIMIT').expect(200)).body.data.status).toBe('QUEUED');
    expect((await claim()).body.data).toBeNull(); // backoff 30s not elapsed
    ctx.clock.advance(29_000);
    expect((await claim()).body.data).toBeNull();
    ctx.clock.advance(1_000);
    job = (await claim()).body.data;
    expect(job.attempt).toBe(2);
    expect((await failJob(id, job.leaseToken, 'PROVIDER_TIMEOUT').expect(200)).body.data.status).toBe('QUEUED');
    ctx.clock.advance(59_000);
    expect((await claim()).body.data).toBeNull();
    ctx.clock.advance(1_000);
    job = (await claim()).body.data;
    expect(job.attempt).toBe(3);
    expect((await failJob(id, job.leaseToken, 'INVALID_MODEL_OUTPUT').expect(200)).body.data.status).toBe('FAILED');
    const d = (await detail(id)).body.data;
    expect(d).toMatchObject({ status: 'FAILED', errorCode: 'INVALID_MODEL_OUTPUT', attempts: 3, narrative: null });
    expect(d.completedAt).not.toBeNull();
  });

  it('non-retryable failures fail immediately without leaking provider details (AC-42)', async () => {
    const r = await generate().expect(202);
    const job = (await claim()).body.data;
    const res = await failJob(r.body.data.id, job.leaseToken, 'PROVIDER_AUTH_ERROR').expect(200);
    expect(res.body.data.status).toBe('FAILED');
    expect((await claim()).body.data).toBeNull();
    const d = (await detail(r.body.data.id)).body.data;
    expect(d).toMatchObject({ status: 'FAILED', errorCode: 'PROVIDER_AUTH_ERROR', attempts: 1 });
    // Free-text provider errors are not accepted.
    const r2 = await generate().expect(202);
    const job2 = (await claim()).body.data;
    await failJob(r2.body.data.id, job2.leaseToken, 'API key AIza... is invalid').expect(400);
  });

  it('expired lease is recovered by maintenance and the late callback gets 409 STALE_LEASE (AC-43)', async () => {
    const r = await generate().expect(202);
    const id = r.body.data.id;
    const first = (await claim()).body.data;
    ctx.clock.advance(121_000); // lease is 120s
    await maintenance();
    expect((await detail(id)).body.data.status).toBe('QUEUED');
    ctx.clock.advance(30_000);
    const second = (await claim()).body.data;
    expect(second.attempt).toBe(2);
    const late = await complete(id, geminiResult(first.leaseToken)).expect(409);
    expect(late.body.error.code).toBe('STALE_LEASE');
    await failJob(id, first.leaseToken, 'PROVIDER_TIMEOUT').expect(409);
    await complete(id, geminiResult(second.leaseToken)).expect(200);
    expect((await detail(id)).body.data.narrative).toEqual(NARRATIVE);
  });

  it('a report fails after the 10-minute deadline even with no worker; CRUD keeps working (AC-44)', async () => {
    const r = await generate().expect(202);
    ctx.clock.advance(10 * 60_000);
    await maintenance();
    const d = (await detail(r.body.data.id)).body.data;
    expect(d).toMatchObject({ status: 'FAILED', errorCode: 'REPORT_DEADLINE_EXCEEDED' });
    await ctx.http.get('/api/v1/employees').set('Cookie', admin.cookieHeader).expect(200);
    await generate().expect(202); // no longer blocked by the failed job
  });

  it('a callback that arrives after the deadline is stale', async () => {
    const r = await generate().expect(202);
    ctx.clock.advance(9 * 60_000);
    const job = (await claim()).body.data;
    ctx.clock.advance(60_001);
    await complete(r.body.data.id, geminiResult(job.leaseToken)).expect(409);
  });

  it('empty snapshot completes with TEMPLATE and model=null (AC-47)', async () => {
    await ctx.prisma.$executeRawUnsafe('DELETE FROM employees');
    const r = await generate().expect(202);
    const job = (await claim()).body.data;
    expect(job.snapshot.totalEmployees).toBe(0);
    await complete(r.body.data.id, { ...geminiResult(job.leaseToken) }).expect(400); // GEMINI not allowed for empty data
    const tpl = {
      leaseToken: job.leaseToken,
      generatedBy: 'TEMPLATE',
      model: null,
      promptVersion: 'employee-summary-v1',
      narrative: {
        headline: 'ยังไม่มีข้อมูลพนักงานสำหรับรายงานนี้',
        bullets: ['ไม่มีรายการพนักงาน', 'ยังไม่มีข้อมูลแผนก', 'เพิ่มข้อมูลก่อนออกรายงาน'],
      },
    };
    await complete(r.body.data.id, tpl).expect(200);
    const d = (await detail(r.body.data.id)).body.data;
    expect(d).toMatchObject({ status: 'SUCCEEDED', generatedBy: 'TEMPLATE', model: null });
  });

  it('records the worker heartbeat on every claim (integration status)', async () => {
    let status = await ctx.http.get('/api/v1/integrations/status').set('Cookie', admin.cookieHeader).expect(200);
    expect(status.body.data.reports).toMatchObject({ enabled: true, workerLastSeenAt: null, workerAvailable: false });
    await claim().expect(200);
    status = await ctx.http.get('/api/v1/integrations/status').set('Cookie', admin.cookieHeader).expect(200);
    expect(status.body.data.reports).toMatchObject({ workerLastSeenAt: DEFAULT_NOW, workerAvailable: true });
    expect(status.body.data.google).toEqual({ configured: false });
    expect(JSON.stringify(status.body)).not.toMatch(/token|secret|postgresql:/i);
    ctx.clock.advance(61_000);
    admin = await login(ctx, ADMIN_EMAIL);
    status = await ctx.http.get('/api/v1/integrations/status').set('Cookie', admin.cookieHeader).expect(200);
    expect(status.body.data.reports.workerAvailable).toBe(false);
  });
});

describe('scheduled reports (AC-46)', () => {
  it('creates one report per Bangkok business day and returns the existing one afterwards', async () => {
    const first = await ctx.http.post('/internal/v1/reports/scheduled').set(scheduler()).send({}).expect(202);
    expect(first.body.data).toMatchObject({ source: 'SCHEDULED', status: 'QUEUED' });
    const job = (await claim()).body.data;
    await complete(first.body.data.id, geminiResult(job.leaseToken)).expect(200);
    const again = await ctx.http.post('/internal/v1/reports/scheduled').set(scheduler()).send({}).expect(200);
    expect(again.body.data.id).toBe(first.body.data.id);
    // Caller cannot choose the day.
    await ctx.http.post('/internal/v1/reports/scheduled').set(scheduler()).send({ businessDate: '2026-01-01' }).expect(400);
    // Next Bangkok day (17:00Z = 00:00 +07) creates a new report.
    ctx.clock.set('2026-10-01T17:00:00Z');
    const next = await ctx.http.post('/internal/v1/reports/scheduled').set(scheduler()).send({}).expect(202);
    expect(next.body.data.id).not.toBe(first.body.data.id);
  });

  it('returns 409 when a manual job is active; scheduled reports do not count toward the manual quota', async () => {
    const manual = await generate().expect(202);
    const res = await ctx.http.post('/internal/v1/reports/scheduled').set(scheduler()).send({}).expect(409);
    expect(res.body.error).toMatchObject({ code: 'REPORT_IN_PROGRESS', currentReportId: manual.body.data.id });
  });

  it('scheduler token cannot claim jobs and worker token cannot schedule', async () => {
    await ctx.http.post('/internal/v1/report-jobs/claim').set(scheduler()).send({}).expect(401);
    await ctx.http.post('/internal/v1/reports/scheduled').set(worker()).send({}).expect(401);
  });
});

describe('report list', () => {
  it('lists newest first with pagination meta', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const r = await generate().expect(202);
      ids.push(r.body.data.id);
      const job = (await claim()).body.data;
      await complete(r.body.data.id, geminiResult(job.leaseToken)).expect(200);
      ctx.clock.advance(1000);
    }
    const list = await ctx.http.get('/api/v1/reports?pageSize=2').set('Cookie', viewer.cookieHeader).expect(200);
    expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([ids[2], ids[1]]);
    expect(list.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    const succeeded = await ctx.http.get('/api/v1/reports?status=SUCCEEDED').set('Cookie', viewer.cookieHeader).expect(200);
    expect(succeeded.body.meta.total).toBe(3);
  });
});
