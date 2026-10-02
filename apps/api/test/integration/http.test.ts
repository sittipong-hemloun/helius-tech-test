import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetData, startApp, type TestContext } from '../support/harness.js';

const DANA = { name: 'Dana Lee', departmentId: 'engineering', salary: '62000.00', joinDate: '2026-09-01', isActive: true };

describe('HTTP surface', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await startApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => resetData(ctx));

  it('serves the OpenAPI document and UI, but no YAML copy', async () => {
    const doc = await ctx.http.get('/api/openapi.json').expect(200);
    expect(doc.body.paths['/api/v1/employees']).toBeDefined();
    await ctx.http.get('/api/docs/').expect(200);
    await ctx.http.get('/api/docs-yaml').expect(404);
  });

  it('health endpoints reveal nothing internal', async () => {
    const live = await ctx.http.get('/api/health/live').expect(200);
    expect(live.body).toEqual({ status: 'ok' });
    const ready = await ctx.http.get('/api/health/ready').expect(200);
    expect(ready.body).toEqual({ status: 'ready' });
  });

  it('rejects bodies over 32 KB and non-JSON bodies', async () => {
    const big = await ctx.http
      .post('/api/v1/employees')
      .set('Idempotency-Key', randomUUID())
      .send({ ...DANA, name: 'x'.repeat(40_000) })
      .expect(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    await ctx.http
      .post('/api/v1/employees')
      .set({ 'Idempotency-Key': randomUUID(), 'Content-Type': 'text/plain' })
      .send('name=Dana')
      .expect(415);
    const malformed = await ctx.http
      .post('/api/v1/employees')
      .set({ 'Idempotency-Key': randomUUID(), 'Content-Type': 'application/json' })
      .send('{"name":')
      .expect(400);
    expect(malformed.body.error.code).toBe('MALFORMED_JSON');
  });
});

describe('rate limits (PRD §11.4)', () => {
  it('limits writes to 60/minute per client IP and returns Retry-After', async () => {
    const ctx = await startApp({ RATE_LIMIT_ENABLED: 'true' });
    await resetData(ctx);
    const patch = () => ctx.http.patch('/api/v1/employees/999').set('If-Match', '"1"').send({ name: 'x' });
    for (let i = 0; i < 60; i += 1) await patch().expect(404);
    const limited = await patch().expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    // Through the proxy, a client's own X-Forwarded-For entries come first and the proxy appends the
    // address it saw (here 127.0.0.1). Only that last hop is believed, so forged entries change nothing.
    await patch().set('X-Forwarded-For', '203.0.113.7, 127.0.0.1').expect(429);
    await patch().set('X-Forwarded-For', '198.51.100.1, 203.0.113.9, 127.0.0.1').expect(429);
    await ctx.close();
  });
});
