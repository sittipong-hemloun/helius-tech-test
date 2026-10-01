import { describe, expect, it } from 'vitest';
import { EMPTY_DATASET_NARRATIVE, isRetryable, narrativeRule, nextRetryDelayMs } from '../../src/reports/report-rules.js';

describe('retry policy (PRD §12.3, AC-41/42)', () => {
  it('backs off 30s then 60s and stops after 3 attempts', () => {
    expect(nextRetryDelayMs(1, 3, [30_000, 60_000])).toBe(30_000);
    expect(nextRetryDelayMs(2, 3, [30_000, 60_000])).toBe(60_000);
    expect(nextRetryDelayMs(3, 3, [30_000, 60_000])).toBeNull();
  });
  it('classifies provider errors', () => {
    for (const c of ['PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'INVALID_MODEL_OUTPUT']) expect(isRetryable(c)).toBe(true);
    for (const c of ['PROVIDER_AUTH_ERROR', 'MODEL_UNAVAILABLE', 'INVALID_SNAPSHOT', 'CONTENT_REJECTED']) expect(isRetryable(c)).toBe(false);
  });
});

describe('narrative contract (PRD §12.5)', () => {
  const valid = {
    headline: 'ภาพรวมพนักงานจากข้อมูลปัจจุบัน',
    bullets: ['มีพนักงานทั้งหมด 5 รายการ', 'Engineering มี 2 รายการ', 'In Active อยู่ใน Engineering'],
  };
  it('accepts headline + 3–5 plain bullets', () => {
    expect(narrativeRule(valid).ok).toBe(true);
    expect(narrativeRule(EMPTY_DATASET_NARRATIVE).ok).toBe(true);
  });
  it('rejects extra keys, wrong counts, long text, HTML and Markdown', () => {
    expect(narrativeRule({ ...valid, salary: 1 }).ok).toBe(false);
    expect(narrativeRule({ ...valid, bullets: valid.bullets.slice(0, 2) }).ok).toBe(false);
    expect(narrativeRule({ ...valid, bullets: [...valid.bullets, 'a', 'b', 'c'] }).ok).toBe(false);
    expect(narrativeRule({ ...valid, headline: 'ก'.repeat(121) }).ok).toBe(false);
    expect(narrativeRule({ ...valid, headline: '<b>hi</b>' }).ok).toBe(false);
    expect(narrativeRule({ ...valid, bullets: ['**bold** text', 'b', 'c'] }).ok).toBe(false);
    expect(narrativeRule({ ...valid, bullets: ['line\nbreak', 'b', 'c'] }).ok).toBe(false);
  });
});
