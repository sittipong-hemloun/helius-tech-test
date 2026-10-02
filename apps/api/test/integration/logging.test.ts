import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetData, startApp, type TestContext } from '../support/harness.js';

/**
 * AC-57: logs (JSON lines on stdout/stderr) must never carry salaries, names or request bodies —
 * even at LOG_LEVEL=debug.
 */
describe('log hygiene (AC-57)', () => {
  let ctx: TestContext;
  const lines: string[] = [];
  // Keep the real writers before spying, otherwise the spy would call itself.
  const realOut = process.stdout.write.bind(process.stdout);
  const realErr = process.stderr.write.bind(process.stderr);
  const capture = (orig: (...a: unknown[]) => boolean) =>
    ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      lines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return orig(chunk, ...rest);
    }) as typeof process.stdout.write;

  beforeAll(async () => {
    ctx = await startApp({ LOG_LEVEL: 'debug' });
    await resetData(ctx);
    vi.spyOn(process.stdout, 'write').mockImplementation(capture(realOut as (...a: unknown[]) => boolean));
    vi.spyOn(process.stderr, 'write').mockImplementation(capture(realErr as (...a: unknown[]) => boolean));
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await ctx.close();
  });

  it('does not log sensitive values during CRUD and errors', async () => {
    const salary = '87654.32';
    await ctx.http
      .post('/api/v1/employees')
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Log Probe', departmentId: 'hr', salary, joinDate: '2026-01-01', isActive: true })
      .expect(201);
    await ctx.http
      .post('/api/v1/employees')
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Bad', departmentId: 'hr', salary: '12345.678', joinDate: '2026-01-01', isActive: true })
      .expect(400);
    await ctx.http.get('/api/v1/employees?sortBy=salary').expect(200);

    const log = lines.join('');
    expect(log).toContain('"message":"request"'); // the access log really was captured
    for (const secret of [
      salary,
      '87654',
      '12345.678',
      'Log Probe',
    ]) {
      expect(log, `log contains ${secret.slice(0, 6)}…`).not.toContain(secret);
    }
  });
});
