// Read scenario (PRD §15.1/15.2): 20 VUs, 30s warmup + 3 min steady on 10k employees.
// Mix: list default, Department+Status filter, detail, name search (≥3 chars).
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE, headers, http, STEADY, summary, WARMUP } from './common.js';

const payload = new Trend('list_payload_bytes');

export const options = {
  discardResponseBodies: false,
  scenarios: {
    warmup: { executor: 'constant-vus', vus: 20, duration: WARMUP, tags: { phase: 'warmup' } },
    steady: { executor: 'constant-vus', vus: 20, duration: STEADY, startTime: WARMUP, tags: { phase: 'steady' } },
  },
  thresholds: {
    'http_req_duration{phase:steady,kind:list}': ['p(95)<300'],
    'http_req_duration{phase:steady,kind:filter}': ['p(95)<300'],
    'http_req_duration{phase:steady,kind:detail}': ['p(95)<300'],
    'http_req_duration{phase:steady,kind:search}': ['p(95)<500'],
    'http_req_failed{phase:steady}': ['rate<0.01'],
    list_payload_bytes: ['max<102400'],
  },
};

const SEARCH = ['searchwell', 'arin', 'thongdee', 'pim boon'];
const DEPTS = ['engineering', 'marketing', 'sales', 'hr'];
const STATUS = ['active', 'inactive'];

export default function () {
  const h = { headers: headers() };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const page = 1 + Math.floor(Math.random() * 25);

  const list = http.get(`${BASE}/api/v1/employees?page=${page}&pageSize=20`, { ...h, tags: { kind: 'list' } });
  check(list, { 'list 200': (r) => r.status === 200 });
  payload.add(list.body ? list.body.length : 0);

  const filter = http.get(`${BASE}/api/v1/employees?departmentId=${pick(DEPTS)}&status=${pick(STATUS)}&page=${1 + Math.floor(Math.random() * 5)}&pageSize=20&sortBy=name`, {
    ...h,
    tags: { kind: 'filter' },
  });
  check(filter, { 'filter 200': (r) => r.status === 200 });

  const detail = http.get(`${BASE}/api/v1/employees/${1 + Math.floor(Math.random() * 10000)}`, { ...h, tags: { kind: 'detail' } });
  check(detail, { 'detail 200': (r) => r.status === 200 });

  const search = http.get(`${BASE}/api/v1/employees?q=${encodeURIComponent(pick(SEARCH))}&pageSize=20`, { ...h, tags: { kind: 'search' } });
  check(search, { 'search 200': (r) => r.status === 200 });
}

export const handleSummary = summary('read');
