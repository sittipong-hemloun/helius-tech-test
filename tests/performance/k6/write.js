// Write scenario (PRD §15.2): 10 VUs create → update (If-Match) → delete, separate from reads.
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE, http, STEADY, summary, uuid, WARMUP, writeHeaders } from './common.js';

const unexpected = new Counter('unexpected_responses');

export const options = {
  scenarios: {
    warmup: { executor: 'constant-vus', vus: 10, duration: WARMUP, tags: { phase: 'warmup' } },
    steady: { executor: 'constant-vus', vus: 10, duration: STEADY, startTime: WARMUP, tags: { phase: 'steady' } },
  },
  thresholds: {
    'http_req_duration{phase:steady,kind:create}': ['p(95)<500'],
    'http_req_duration{phase:steady,kind:update}': ['p(95)<500'],
    'http_req_duration{phase:steady,kind:delete}': ['p(95)<500'],
    'http_req_failed{phase:steady}': ['rate<0.01'],
  },
};

export default function () {
  const body = JSON.stringify({ name: `Perf Writer ${uuid().slice(0, 8)}`, departmentId: 'sales', salary: '42000.00', joinDate: '2026-01-15', isActive: true });
  const created = http.post(`${BASE}/api/v1/employees`, body, { headers: writeHeaders({ 'Idempotency-Key': uuid() }), tags: { kind: 'create', name: 'POST /employees' } });
  if (!check(created, { 'create 201': (r) => r.status === 201 })) {
    unexpected.add(1);
    return;
  }
  const id = created.json('data.id');
  const updated = http.patch(`${BASE}/api/v1/employees/${id}`, JSON.stringify({ salary: '43000.50', isActive: false }), {
    headers: writeHeaders({ 'If-Match': '"1"' }),
    tags: { kind: 'update', name: 'PATCH /employees/:id' },
  });
  if (!check(updated, { 'update 200': (r) => r.status === 200 })) unexpected.add(1);
  const deleted = http.del(`${BASE}/api/v1/employees/${id}`, null, { headers: writeHeaders({ 'If-Match': '"2"' }), tags: { kind: 'delete', name: 'DELETE /employees/:id' } });
  if (!check(deleted, { 'delete 204': (r) => r.status === 204 })) unexpected.add(1);
}

export const handleSummary = summary('write');
