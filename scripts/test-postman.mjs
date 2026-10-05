#!/usr/bin/env node
// pnpm test:postman — Newman runs tests/postman/employee-console.postman_collection.json against a
// production build of the API (APP_ENV=test) on an isolated, freshly seeded database (PRD USR-04, AC-53).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import newman from 'newman';
import { apiEnv, dropDatabase, freshDatabase, startProcess, waitHttp } from './lib/test-env.mjs';
import { portInUse, ROOT, run } from './lib/sh.mjs';

const API_PORT = Number(process.env.POSTMAN_API_PORT ?? 3031);
const ORIGIN = 'http://localhost:3030'; // PUBLIC_APP_ORIGIN; Newman sends no Origin header
const BASE_URL = `http://127.0.0.1:${API_PORT}`; // straight to the API — the Next.js proxy is not needed
const DB = `employee_console_test_postman_${process.pid}`;
const COLLECTION = resolve(ROOT, 'tests/postman/employee-console.postman_collection.json');
const ENVIRONMENT = resolve(ROOT, 'tests/postman/test.postman_environment.json');
const JUNIT = resolve(ROOT, 'test-results/newman-junit.xml');

if (await portInUse(API_PORT)) {
  console.error(`✖ port ${API_PORT} is already in use; stop that process or set POSTMAN_API_PORT`);
  process.exit(1);
}

if (!process.env.POSTMAN_SKIP_BUILD) run('pnpm', ['--filter', '@employee-console/api', 'run', 'build']);

function runNewman(options) {
  return new Promise((done, fail) => newman.run(options, (err, summary) => (err ? fail(err) : done(summary))));
}

let status = 1;
let api;
try {
  const url = await freshDatabase(DB);
  const env = apiEnv({ databaseUrl: url, port: API_PORT, origin: ORIGIN });
  api = startProcess('node', ['dist/main.js'], { cwd: resolve(ROOT, 'apps/api'), env, logFile: resolve(ROOT, '.tmp/postman-api.log') });
  await waitHttp(`${BASE_URL}/api/health/ready`, 'api');
  mkdirSync(resolve(ROOT, 'test-results'), { recursive: true });

  const summary = await runNewman({
    collection: COLLECTION,
    environment: ENVIRONMENT,
    envVar: [{ key: 'baseUrl', value: BASE_URL }],
    reporters: ['cli', 'junit'],
    reporter: { junit: { export: JUNIT } },
    timeoutRequest: 15_000,
  });

  const { failures, error, stats } = summary.run;
  status = error || failures.length > 0 ? 1 : 0;
  console.log(`\nJUnit report: ${JUNIT}`);
  console.log(`${stats.requests.total} requests, ${stats.assertions.total} assertions, ${failures.length} failure(s)`);
  if (status !== 0) console.error(api.dump().slice(-3000));
} catch (err) {
  console.error(err);
  if (api) console.error(api.dump().slice(-3000));
} finally {
  if (api && api.exitCode === null) {
    const exited = new Promise((done) => api.once('exit', done));
    api.kill('SIGTERM');
    await Promise.race([exited, new Promise((done) => setTimeout(done, 5000))]);
  }
  await dropDatabase(DB);
}
process.exit(status);
