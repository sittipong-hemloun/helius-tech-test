import { fail, ok, type RuleResult } from '../validation/rule.js';

/** Worker error codes the backend accepts (PRD §12.5). Free-text provider errors are never stored. */
export const RETRYABLE_ERROR_CODES = ['PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'INVALID_MODEL_OUTPUT'] as const;
export const TERMINAL_ERROR_CODES = ['PROVIDER_AUTH_ERROR', 'MODEL_UNAVAILABLE', 'INVALID_SNAPSHOT', 'CONTENT_REJECTED'] as const;
export const WORKER_ERROR_CODES = [...RETRYABLE_ERROR_CODES, ...TERMINAL_ERROR_CODES] as const;
export type WorkerErrorCode = (typeof WORKER_ERROR_CODES)[number];

export const SYSTEM_ERROR_CODES = {
  deadline: 'REPORT_DEADLINE_EXCEEDED',
  leaseExpired: 'WORKER_LEASE_EXPIRED',
} as const;

export function isRetryable(code: string): boolean {
  return (RETRYABLE_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Retry policy: max 3 attempts including the first; backoff 30s after attempt 1,
 * 60s after attempt 2 (PRD §12.3). Returns null when the job must fail.
 */
export function nextRetryDelayMs(attemptsSoFar: number, maxAttempts: number, backoffMs: readonly number[]): number | null {
  if (attemptsSoFar >= maxAttempts) return null;
  return backoffMs[Math.min(attemptsSoFar - 1, backoffMs.length - 1)] ?? backoffMs.at(-1) ?? 0;
}

export interface Narrative {
  headline: string;
  bullets: string[];
}

const CONTROL = /[\p{Cc}\u2028\u2029]/u;
const HTML_TAG = /<\/?[a-z!][^>]*>/i;
const MARKDOWN = /(^\s*[#>*-]\s)|(\*\*)|(```)|(\[[^\]]*\]\([^)]*\))/;

function textRule(value: unknown, field: string, max: number): RuleResult<string> {
  if (typeof value !== 'string') return fail('NARRATIVE_INVALID', `${field} must be a string.`);
  const s = value.trim();
  if (s.length === 0) return fail('NARRATIVE_INVALID', `${field} cannot be empty.`);
  if ([...s].length > max) return fail('NARRATIVE_TOO_LONG', `${field} must be at most ${max} characters.`);
  if (CONTROL.test(s)) return fail('NARRATIVE_INVALID', `${field} cannot contain control characters or line breaks.`);
  if (HTML_TAG.test(s) || MARKDOWN.test(s)) return fail('NARRATIVE_FORMAT_INVALID', `${field} must be plain text without HTML or Markdown.`);
  return ok(s);
}

/** Structure/length check for the model output; numbers are checked separately against the snapshot. */
export function narrativeRule(value: unknown): RuleResult<Narrative> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail('NARRATIVE_INVALID', 'narrative must be an object.');
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'bullets' || keys[1] !== 'headline') {
    return fail('NARRATIVE_INVALID', 'narrative must contain exactly headline and bullets.');
  }
  const v = value as { headline: unknown; bullets: unknown };
  const headline = textRule(v.headline, 'headline', 120);
  if (!headline.ok) return headline;
  if (!Array.isArray(v.bullets) || v.bullets.length < 3 || v.bullets.length > 5) {
    return fail('NARRATIVE_INVALID', 'bullets must contain 3 to 5 items.');
  }
  const bullets: string[] = [];
  for (const [i, b] of v.bullets.entries()) {
    const r = textRule(b, `bullets[${i}]`, 240);
    if (!r.ok) return r;
    bullets.push(r.value);
  }
  return ok({ headline: headline.value, bullets });
}

/** Thai template used when the snapshot has no employees (PRD §12.5 empty dataset). */
export const EMPTY_DATASET_NARRATIVE: Narrative = {
  headline: 'ยังไม่มีข้อมูลพนักงานสำหรับรายงานนี้',
  bullets: [
    'ไม่มีรายการพนักงานในข้อมูล ณ เวลาที่ถ่าย snapshot',
    'ยังไม่มีข้อมูลแผนกที่มีพนักงานให้สรุป',
    'เพิ่มข้อมูลพนักงานก่อน แล้วจึงออกรายงานใหม่',
  ],
};
