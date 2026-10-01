// Manual report enqueue latency (PRD §15.2 ≤1,000 ms p95, excludes Gemini time).
// One active job is allowed system-wide, so each iteration enqueues and the runner's
// worker stub fails the job immediately through the internal API.
import { check } from 'k6';
import { BASE, http, summary, uuid, writeHeaders } from './common.js';

export const options = {
  scenarios: { enqueue: { executor: 'per-vu-iterations', vus: 1, iterations: 10, maxDuration: '2m' } },
  thresholds: { 'http_req_duration{kind:enqueue}': ['p(95)<1000'] },
};

export default function () {
  const r = http.post(`${BASE}/api/v1/reports`, '{}', { headers: writeHeaders({ 'Idempotency-Key': uuid() }), tags: { kind: 'enqueue', name: 'POST /reports' } });
  check(r, { 'enqueue 202': (x) => x.status === 202 });
  const auth = { headers: { Authorization: `Bearer ${__ENV.WORKER_TOKEN}`, 'Content-Type': 'application/json' }, tags: { kind: 'worker', name: 'internal worker' } };
  const job = http.post(`${BASE}/internal/v1/report-jobs/claim`, '{}', auth).json('data');
  if (job) http.post(`${BASE}/internal/v1/report-jobs/${job.reportId}/fail`, JSON.stringify({ leaseToken: job.leaseToken, errorCode: 'PROVIDER_AUTH_ERROR' }), auth);
}

export const handleSummary = summary('enqueue');
