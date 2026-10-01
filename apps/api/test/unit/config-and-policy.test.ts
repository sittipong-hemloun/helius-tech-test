import { describe, expect, it } from 'vitest';
import { AccessPolicyService } from '../../src/auth/access-policy.service.js';
import { cookieMaxAge, isAbsolutelyExpired } from '../../src/auth/session-helpers.js';
import { ConfigError, loadConfig } from '../../src/config/app-config.js';

const base = {
  APP_ENV: 'local',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  SESSION_SECRET: 'x'.repeat(40),
  PUBLIC_APP_ORIGIN: 'http://localhost:3000',
};

describe('configuration validation (PRD §13.2)', () => {
  it('loads PRD defaults', () => {
    const c = loadConfig(base);
    expect(c.session.cookieName).toBe('employee_console.local.sid');
    expect(c.session.secure).toBe(false);
    expect(c.session.idleTimeoutMs).toBe(30 * 60_000);
    expect(c.session.absoluteTimeoutMs).toBe(8 * 3_600_000);
    expect(c.reports.leaseMs).toBe(120_000);
    expect(c.reports.backoffMs).toEqual([30_000, 60_000]);
    expect(c.google.configured).toBe(false);
    expect(c.google.redirectUri).toBe('http://localhost:3000/api/auth/google/callback');
  });
  it('refuses overlapping admin/viewer lists (PRD §11.1 step 5)', () => {
    expect(() => loadConfig({ ...base, ADMIN_EMAILS: 'A@x.test', VIEWER_EMAILS: 'a@x.test ' })).toThrow(ConfigError);
  });
  it('refuses auth fixtures outside test/performance (AC-34)', () => {
    for (const APP_ENV of ['local', 'staging']) {
      expect(() => loadConfig({ ...base, APP_ENV, AUTH_FIXTURES_ENABLED: 'true' })).toThrow(/AUTH_FIXTURES_ENABLED/);
    }
    expect(loadConfig({ ...base, APP_ENV: 'test', AUTH_FIXTURES_ENABLED: 'true' }).authFixturesEnabled).toBe(true);
  });
  it('refuses rate-limit override outside performance and plain HTTP off loopback', () => {
    expect(() => loadConfig({ ...base, PERF_RATE_LIMIT_OVERRIDE: 'true' })).toThrow(/PERF_RATE_LIMIT_OVERRIDE/);
    expect(() => loadConfig({ ...base, PUBLIC_APP_ORIGIN: 'http://192.168.1.10:3000' })).toThrow(/HTTPS/);
    expect(loadConfig({ ...base, PUBLIC_APP_ORIGIN: 'https://console.example.test' }).session.secure).toBe(true);
  });
  it('requires distinct, long service tokens', () => {
    const t = 'y'.repeat(40);
    expect(() => loadConfig({ ...base, WORKER_SERVICE_TOKEN: t, SCHEDULER_SERVICE_TOKEN: t })).toThrow(/different/);
    expect(() => loadConfig({ ...base, WORKER_SERVICE_TOKEN: 'short' })).toThrow(/32/);
    expect(() => loadConfig({ ...base, REPORTS_ENABLED: 'true' })).toThrow(/WORKER_SERVICE_TOKEN/);
  });
});

describe('access policy (PRD §6.5)', () => {
  const config = loadConfig({ ...base, ADMIN_EMAILS: 'Boss@Example.test', VIEWER_EMAILS: 'reader@example.test' });
  const policy = new AccessPolicyService(config);
  it('normalizes emails and maps roles', () => {
    expect(policy.roleFor(' boss@example.TEST ')).toBe('ADMIN');
    expect(policy.roleFor('reader@example.test')).toBe('VIEWER');
    expect(policy.roleFor('stranger@example.test')).toBeNull();
  });
  it('derives permissions from role', () => {
    expect(AccessPolicyService.permissions('VIEWER')).toEqual({
      canWriteEmployees: false,
      canViewSalary: false,
      canGenerateReports: false,
      canViewIntegrations: false,
    });
    expect(AccessPolicyService.permissions('ADMIN').canViewSalary).toBe(true);
  });
});

describe('session timeouts (PRD §11.2, AC-31)', () => {
  const now = new Date('2026-10-01T03:00:00Z');
  it('caps the cookie at the absolute expiry', () => {
    expect(cookieMaxAge(30 * 60_000, '2026-10-01T03:10:00Z', now)).toBe(10 * 60_000);
    expect(cookieMaxAge(30 * 60_000, '2026-10-01T09:00:00Z', now)).toBe(30 * 60_000);
  });
  it('treats the absolute expiry instant as expired', () => {
    expect(isAbsolutelyExpired('2026-10-01T03:00:00Z', now)).toBe(true);
    expect(isAbsolutelyExpired('2026-10-01T03:00:01Z', now)).toBe(false);
  });
});
