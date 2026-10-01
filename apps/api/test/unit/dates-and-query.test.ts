import { describe, expect, it } from 'vitest';
import { businessDate, isRealIsoDate } from '../../src/common/dates.js';
import { escapeLike, pageSizeRule, qRule, sortByRule } from '../../src/employees/employee-query.js';
import { canonicalJson, hashPayload, parseIdempotencyKey } from '../../src/idempotency/idempotency.js';
import { parseIfMatch } from '../../src/employees/employees.controller.js';

describe('businessDate (Asia/Bangkok, PRD §9.4)', () => {
  it('uses the Bangkok calendar day regardless of host timezone', () => {
    expect(businessDate(new Date('2026-09-30T16:59:59Z'), 'Asia/Bangkok')).toBe('2026-09-30');
    expect(businessDate(new Date('2026-09-30T17:00:00Z'), 'Asia/Bangkok')).toBe('2026-10-01');
    expect(businessDate(new Date('2026-10-01T03:00:00Z'), 'Asia/Bangkok')).toBe('2026-10-01');
  });
  it('validates real calendar dates', () => {
    expect(isRealIsoDate('2024-02-29')).toBe(true);
    expect(isRealIsoDate('2023-02-29')).toBe(false);
  });
});

describe('list query rules (PRD §10.3)', () => {
  it('escapes LIKE metacharacters', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
  it('trims q and limits length; rejects repeated parameters', () => {
    expect(qRule('  john ')).toEqual({ ok: true, value: 'john' });
    expect(qRule('x'.repeat(101)).ok).toBe(false);
    expect(qRule(['a', 'b']).ok).toBe(false);
  });
  it('validates pageSize and sortBy whitelist', () => {
    expect(pageSizeRule('100').ok).toBe(true);
    expect(pageSizeRule('101').ok).toBe(false);
    expect(pageSizeRule('1.5').ok).toBe(false);
    expect(sortByRule('name;drop table').ok).toBe(false);
  });
});

describe('idempotency helpers (PRD §10.5)', () => {
  it('hashes equivalent payloads identically regardless of key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
  });
  it('requires a UUID key', () => {
    expect(parseIdempotencyKey('8B89D615-599F-44B9-8026-7E605C5D88B1')).toBe('8b89d615-599f-44b9-8026-7e605c5d88b1');
    expect(() => parseIdempotencyKey('not-a-uuid')).toThrow();
    expect(() => parseIdempotencyKey(undefined)).toThrow();
  });
});

describe('If-Match parsing (PRD §9.4)', () => {
  it('accepts a quoted version and rejects missing headers with 428', () => {
    expect(parseIfMatch('"3"')).toBe(3);
    expect(parseIfMatch('3')).toBe(3);
    expect(() => parseIfMatch(undefined)).toThrowError(expect.objectContaining({ code: 'PRECONDITION_REQUIRED' }));
    expect(() => parseIfMatch('"abc"')).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
