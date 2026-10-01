// Shared k6 helpers. BASE_URL, COOKIE and CSRF come from the perf runner (test-only session).
import http from 'k6/http';

export const BASE = __ENV.BASE_URL || 'http://host.docker.internal:3201';
export const STEADY = __ENV.STEADY || '3m';
export const WARMUP = __ENV.WARMUP || '30s';

export function headers(extra = {}) {
  return { Cookie: __ENV.COOKIE, Accept: 'application/json', ...extra };
}

export function writeHeaders(extra = {}) {
  return headers({ 'Content-Type': 'application/json', 'X-CSRF-Token': __ENV.CSRF, ...extra });
}

export function uuid() {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i += 1) s += h[Math.floor(Math.random() * 16)];
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

/** Writes summary JSON with p50/p90/p95/p99 per tag so runs can be compared offline. */
export function summary(name) {
  return (data) => {
    const pick = {};
    for (const [metric, value] of Object.entries(data.metrics)) {
      if (value.type === 'trend' || value.type === 'rate' || value.type === 'counter') pick[metric] = value.values;
    }
    const out = { scenario: name, startedAt: __ENV.STARTED_AT, label: __ENV.LABEL, state: data.state, metrics: pick };
    return { [`/results/${__ENV.LABEL || name}.json`]: JSON.stringify(out, null, 2), stdout: `${name}: done\n` };
  };
}

export { http };
