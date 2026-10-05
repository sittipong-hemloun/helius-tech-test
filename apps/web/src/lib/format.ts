/** Display helpers. Business dates stay strings end-to-end; no Date object can shift them. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2023-01-15" → "15 Jan 2023" (dd MMM yyyy, Gregorian — PRD §8.1). */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Exact `#,##0.00` from a decimal string without floating point: "65000.00" → "65,000.00". */
export function formatSalary(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!m) return value;
  const integer = m[1].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${integer}.${(m[2] ?? '').padEnd(2, '0')}`;
}

export function statusLabel(isActive: boolean): 'Active' | 'In Active' {
  return isActive ? 'Active' : 'In Active';
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}
