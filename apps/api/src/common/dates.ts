/**
 * Date-only helpers. Business dates (Join Date, Last Updated Date) are
 * plain `YYYY-MM-DD` strings end-to-end so no browser/server timezone can shift them.
 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DATE_MIN = '1900-01-01';
export const DATE_MAX = '2100-12-31';

/** Calendar date of `instant` in `timeZone`, e.g. businessDate(now, 'Asia/Bangkok') → '2026-10-01'. */
export function businessDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** True only for a real calendar day written as YYYY-MM-DD (rejects 2026-02-30). */
export function isRealIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function isIsoDateShape(value: string): boolean {
  return ISO_DATE.test(value);
}

/** Lexicographic compare works for zero-padded ISO dates. */
export function isDateInRange(value: string, min = DATE_MIN, max = DATE_MAX): boolean {
  return value >= min && value <= max;
}
