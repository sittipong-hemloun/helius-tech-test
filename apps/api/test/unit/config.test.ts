import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/app-config.js';
import { trustProxySetting } from '../../src/bootstrap.js';

const base = {
  APP_ENV: 'local',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  PUBLIC_APP_ORIGIN: 'http://localhost:3000',
};

describe('configuration validation (PRD §13.2)', () => {
  it('loads PRD defaults', () => {
    const c = loadConfig(base);
    expect(c.rateLimits).toMatchObject({ enabled: true, readPerWindow: 300, writePerWindow: 60 });
    expect(c.idempotencyTtlMs).toBe(24 * 3_600_000);
  });
  it('refuses plain HTTP off loopback', () => {
    expect(() => loadConfig({ ...base, PUBLIC_APP_ORIGIN: 'http://192.168.1.10:3000' })).toThrow(/HTTPS/);
    expect(loadConfig({ ...base, PUBLIC_APP_ORIGIN: 'https://console.example.test' }).publicAppOrigin).toBe('https://console.example.test');
  });
  it('allows disabling rate limits only in test', () => {
    expect(() => loadConfig({ ...base, RATE_LIMIT_ENABLED: 'false' })).toThrow(/RATE_LIMIT_ENABLED/);
    expect(() => loadConfig({ ...base, APP_ENV: 'staging', RATE_LIMIT_ENABLED: 'false' })).toThrow(/RATE_LIMIT_ENABLED/);
    expect(loadConfig({ ...base, APP_ENV: 'test', RATE_LIMIT_ENABLED: 'false' }).rateLimits.enabled).toBe(false);
  });
});

describe('trust proxy policy (PRD §11.4)', () => {
  const trust = trustProxySetting('private-1hop') as (addr: string, hop: number) => boolean;
  it('trusts only the immediate private/loopback proxy', () => {
    expect(trust('127.0.0.1', 0)).toBe(true);
    expect(trust('::1', 0)).toBe(true);
    expect(trust('172.20.0.3', 0)).toBe(true);
    expect(trust('::ffff:192.168.65.1', 0)).toBe(true);
    expect(trust('203.0.113.5', 0)).toBe(false);
    expect(trust('10.0.0.2', 1)).toBe(false); // never a second hop from X-Forwarded-For
  });
  it('passes explicit values through', () => {
    expect(trustProxySetting('loopback')).toBe('loopback');
  });
});
