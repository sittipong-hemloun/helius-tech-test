#!/usr/bin/env node
// pnpm perf:run --label=baseline|optimized [--runs=3] [--steady=3m] [--warmup=30s] [--skip-build] [--no-lighthouse]
//                [--without-perf-indexes]  same build, but drop the tuning indexes (apples-to-apples baseline)
// Reproducible benchmark (PRD §15): production builds, APP_ENV=performance, 10k synthetic employees
// (seed 42), one API instance with a 10-connection pool, k6 in Docker, Lighthouse desktop × 3.
// Results: tests/performance/results/<label>/ (raw k6 summaries, EXPLAIN plans, environment, Lighthouse).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';
import pg from 'pg';
import { apiEnv, freshDatabase, startProcess, waitHttp } from './lib/test-env.mjs';
import { capture, info, ok, ROOT, run, warn } from './lib/sh.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const has = (name) => process.argv.includes(`--${name}`);
const LABEL = arg('label', 'run');
const RUNS = Number(arg('runs', 3));
const STEADY = arg('steady', '3m');
const WARMUP = arg('warmup', '30s');
const K6 = 'grafana/k6:2.3.0';
const API_PORT = 3201;
const WEB_PORT = 3200;
const DB = 'employee_console_perf';
const outDir = resolve(ROOT, 'tests/performance/results', LABEL);
mkdirSync(outDir, { recursive: true });

// ---- database + data
const url = await freshDatabase(DB, 'performance', { seed: false });
const PERF_INDEXES = ['employees_name_trgm_idx', 'employees_department_id_is_active_idx'];
if (has('without-perf-indexes')) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  for (const idx of PERF_INDEXES) await c.query(`DROP INDEX IF EXISTS "${idx}"`);
  await c.end();
  info(`dropped tuning indexes for this run: ${PERF_INDEXES.join(', ')}`);
}
const env = apiEnv({
  databaseUrl: url,
  port: API_PORT,
  origin: `http://localhost:${WEB_PORT}`,
  appEnv: 'performance',
  extra: { PERF_RATE_LIMIT_OVERRIDE: 'true', DB_POOL_MAX: '10', LOG_LEVEL: 'error' },
});
run('pnpm', ['--filter', '@employee-console/api', 'run', 'perf:seed', '--count=10000', '--seed=42'], { env });

// ---- builds
if (!has('skip-build')) {
  run('pnpm', ['--filter', '@employee-console/api', 'run', 'build']);
  run('pnpm', ['--filter', '@employee-console/web', 'run', 'build'], { env: { ...process.env, API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`, NEXT_TELEMETRY_DISABLED: '1' } });
}
const standalone = resolve(ROOT, 'apps/web/.next/standalone/apps/web');
cpSync(resolve(ROOT, 'apps/web/.next/static'), resolve(standalone, '.next/static'), { recursive: true });

const api = startProcess('node', ['dist/main.js'], { cwd: resolve(ROOT, 'apps/api'), env, logFile: resolve(outDir, 'api.log') });
const web = startProcess('node', ['server.js'], {
  cwd: standalone,
  env: { ...process.env, PORT: String(WEB_PORT), HOSTNAME: '127.0.0.1', API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`, NODE_ENV: 'production' },
  logFile: resolve(outDir, 'web.log'),
});

const summary = { label: LABEL, startedAt: new Date().toISOString(), runs: [] };
try {
  await waitHttp(`http://127.0.0.1:${API_PORT}/api/health/ready`, 'api');
  await waitHttp(`http://127.0.0.1:${WEB_PORT}/employees`, 'web');

  // ---- environment record
  const dockerInfo = capture('docker', ['info', '--format', '{{.NCPU}} cpus, {{.MemTotal}} bytes, {{.OperatingSystem}}']);
  summary.environment = {
    commit: capture('git', ['rev-parse', 'HEAD']),
    tuningIndexesDropped: has('without-perf-indexes'),
    dirty: Boolean(capture('git', ['status', '--porcelain', '--untracked-files=no'])),
    migrations: readdirSync(resolve(ROOT, 'apps/api/prisma/migrations')).filter((d) => !d.endsWith('.toml')),
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: `${os.cpus()[0]?.model} × ${os.cpus().length}`,
    memoryGiB: Math.round(os.totalmem() / 2 ** 30),
    node: process.versions.node,
    dockerVm: dockerInfo,
    postgres: capture('docker', ['compose', 'exec', '-T', 'postgres', 'postgres', '--version']),
    apiPool: 10,
    apiInstances: 1,
    k6: K6,
    rateLimitOverride: 'PERF_RATE_LIMIT_OVERRIDE=true (performance env only)',
    target: `API direct http://host.docker.internal:${API_PORT} from the k6 container (API bound to 127.0.0.1; Docker Desktop routes host-gateway to host loopback)`,
  };

  // ---- query plans
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const plans = {
    'list default (page 1)': `SELECT e.id FROM employees e JOIN departments d ON d.id = e.department_id ORDER BY e.id ASC LIMIT 20 OFFSET 0`,
    'count all': `SELECT count(*)::int FROM employees e`,
    'filter dept+status sorted by name': `SELECT e.id FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.department_id = 'sales' AND e.is_active = false ORDER BY lower(e.name) COLLATE "C" ASC, e.id ASC LIMIT 20 OFFSET 0`,
    'count dept+status': `SELECT count(*)::int FROM employees e WHERE e.department_id = 'sales' AND e.is_active = false`,
    'search contains "searchwell"': `SELECT e.id FROM employees e JOIN departments d ON d.id = e.department_id WHERE lower(e.name) LIKE lower('%searchwell%') ESCAPE '\\' ORDER BY e.id ASC LIMIT 20`,
    'count search "searchwell"': `SELECT count(*)::int FROM employees e WHERE lower(e.name) LIKE lower('%searchwell%') ESCAPE '\\'`,
    'search short "ar"': `SELECT e.id FROM employees e WHERE lower(e.name) LIKE lower('%ar%') ESCAPE '\\' ORDER BY e.id LIMIT 20`,
  };
  let planText = '';
  for (const [name, sql] of Object.entries(plans)) {
    const r = await client.query(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) ${sql}`);
    planText += `-- ${name}\n${sql}\n${r.rows.map((x) => x['QUERY PLAN']).join('\n')}\n\n`;
  }
  const indexes = await client.query(`SELECT indexname, indexdef, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size FROM pg_indexes WHERE tablename = 'employees' ORDER BY 1`);
  summary.indexes = indexes.rows;
  writeFileSync(resolve(outDir, 'explain.txt'), planText);
  ok('EXPLAIN ANALYZE plans saved');

  // ---- k6
  const k6 = (script, label, extraEnv = {}) => {
    const envArgs = Object.entries({
      BASE_URL: `http://host.docker.internal:${API_PORT}`,
      LABEL: label,
      STEADY,
      WARMUP,
      STARTED_AT: new Date().toISOString(),
      ...extraEnv,
    }).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    const status = run(
      'docker',
      ['run', '--rm', '--add-host=host.docker.internal:host-gateway', '-v', `${resolve(ROOT, 'tests/performance/k6')}:/scripts:ro`, '-v', `${outDir}:/results`, ...envArgs, K6, 'run', '--quiet', `/scripts/${script}`],
      { allowFailure: true },
    );
    const file = resolve(outDir, `${label}.json`);
    return { status, result: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null };
  };

  for (let i = 1; i <= RUNS; i += 1) {
    info(`run ${i}/${RUNS}: read scenario (20 VUs, ${WARMUP} warmup + ${STEADY})`);
    const read = k6('read.js', `read-${i}`);
    info(`run ${i}/${RUNS}: write scenario (10 VUs)`);
    const write = k6('write.js', `write-${i}`);
    summary.runs.push({ run: i, readThresholdsPassed: read.status === 0, writeThresholdsPassed: write.status === 0 });
  }
  await client.end();

  // ---- Lighthouse (desktop, production build, median of 3)
  if (!has('no-lighthouse')) {
    const chrome =
      process.env.CHROME_PATH ??
      ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
    if (!chrome) warn('Chrome not found: set CHROME_PATH to run Lighthouse');
    else {
      const scores = [];
      for (let i = 1; i <= 3; i += 1) {
        const file = resolve(outDir, `lighthouse-${i}.json`);
        try {
          execFileSync(
            'pnpm',
            [
              'exec',
              'lighthouse',
              `http://localhost:${WEB_PORT}/employees`,
              '--preset=desktop',
              '--only-categories=performance,accessibility',
              '--output=json',
              `--output-path=${file}`,
              '--chrome-flags=--headless=new --no-first-run --no-default-browser-check',
              '--quiet',
            ],
            { cwd: ROOT, env: { ...process.env, CHROME_PATH: chrome }, stdio: 'inherit' },
          );
          const lh = JSON.parse(readFileSync(file, 'utf8'));
          scores.push({
            performance: Math.round(lh.categories.performance.score * 100),
            accessibility: Math.round(lh.categories.accessibility.score * 100),
            cls: lh.audits['cumulative-layout-shift'].numericValue,
            lcpMs: Math.round(lh.audits['largest-contentful-paint'].numericValue),
            tbtMs: Math.round(lh.audits['total-blocking-time'].numericValue),
          });
        } catch (err) {
          warn(`lighthouse run ${i} failed: ${err.message}`);
        }
      }
      const median = (k) => [...scores.map((s) => s[k])].sort((a, b) => a - b)[Math.floor(scores.length / 2)];
      summary.lighthouse = { runs: scores, median: scores.length ? { performance: median('performance'), accessibility: median('accessibility'), cls: median('cls'), lcpMs: median('lcpMs') } : null };
    }
  }
} finally {
  api.kill('SIGTERM');
  web.kill('SIGTERM');
  summary.finishedAt = new Date().toISOString();
  writeFileSync(resolve(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  ok(`results in tests/performance/results/${LABEL}/`);
}
