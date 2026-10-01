/**
 * Salary input handling (PRD §9.3 "Salary UI"): users may type commas; we strip them,
 * validate without rounding, and send the canonical decimal string the API expects.
 */
export type SalaryParse = { ok: true; canonical: string } | { ok: false; message: string };

export const SALARY_MESSAGES = {
  required: 'Salary is required.',
  scale: 'Salary must have at most 2 decimal places.',
  negative: 'Salary cannot be negative.',
  format: 'Use digits and an optional decimal point, for example 65000.00.',
  range: 'Salary must be at most 9,999,999,999.99.',
};

export function parseSalaryInput(raw: string): SalaryParse {
  const s = raw.trim().replace(/,/g, '');
  if (s === '') return { ok: false, message: SALARY_MESSAGES.required };
  if (s.startsWith('-')) return { ok: false, message: SALARY_MESSAGES.negative };
  if (/^\d+\.\d{3,}$/.test(s)) return { ok: false, message: SALARY_MESSAGES.scale };
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return { ok: false, message: SALARY_MESSAGES.format };
  const integer = m[1].replace(/^0+(?=\d)/, '');
  if (integer.length > 10) return { ok: false, message: SALARY_MESSAGES.range };
  return { ok: true, canonical: `${integer}.${(m[2] ?? '').padEnd(2, '0')}` };
}

/** Value shown after blur: "65000" → "65,000.00"; invalid input is left untouched. */
export function formatSalaryInput(raw: string): string {
  const parsed = parseSalaryInput(raw);
  if (!parsed.ok) return raw;
  const [i, f] = parsed.canonical.split('.');
  return `${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${f}`;
}

/** Value shown while editing: commas removed so the caret math stays simple. */
export function unformatSalaryInput(raw: string): string {
  return raw.replace(/,/g, '');
}
