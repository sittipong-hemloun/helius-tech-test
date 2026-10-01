#!/usr/bin/env node
// Generates the two n8n workflow exports from the single source of truth in
// prompts/employee-summary-v1 (system prompt, response schema, validator), so the
// workflow can never drift from the prompt that was evaluated.
//   node workflows/n8n/build.mjs
// Exports contain credential *references* only (ids/names) — never secret values.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREDENTIALS } from './credentials.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const promptDir = resolve(here, '../../prompts/employee-summary-v1');
const SYSTEM_PROMPT = readFileSync(resolve(promptDir, 'system-prompt.txt'), 'utf8').trim();
const SCHEMA = JSON.parse(readFileSync(resolve(promptDir, 'response-schema.json'), 'utf8'));
const VALIDATOR = readFileSync(resolve(promptDir, 'validate.mjs'), 'utf8').replace(/^export /gm, '');
const VERSION = 'employee-summary-v1/workflow-1';


let n = 0;
const pos = (x, y) => [x, y];
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

function http(name, { url, credential, body, position, timeout = 10000, full = false, continueOnError = false }) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    ...(continueOnError ? { onError: 'continueRegularOutput' } : {}),
    retryOnFail: false,
    parameters: {
      method: 'POST',
      url,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: body,
      options: {
        timeout,
        ...(full ? { response: { response: { fullResponse: true, neverError: true } } } : {}),
      },
    },
    credentials: { httpHeaderAuth: credential },
  };
}

function ifNode(name, expression, position) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position,
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: id(), leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    },
  };
}

function code(name, jsCode, position) {
  return { id: id(), name, type: 'n8n-nodes-base.code', typeVersion: 2, position, parameters: { mode: 'runOnceForEachItem', jsCode } };
}

const sticky = (content, position, width = 420, height = 260) => ({
  id: id(),
  name: `Note ${n}`,
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position,
  parameters: { content, width, height },
});

const API = '={{ $env.INTERNAL_API_URL }}';

/** Lets an operator run the workflow on demand (UI "Execute workflow" or `n8n execute --id=...`). */
const onDemand = (position) => ({
  id: id(),
  name: 'Run on demand',
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  typeVersion: 1.1,
  position,
  parameters: { inputSource: 'passthrough' },
});

// ---------------------------------------------------------------- worker
const prepareJob = `// Builds the Gemini request from the claimed snapshot (aggregate counts only).
const SYSTEM_PROMPT = ${JSON.stringify(SYSTEM_PROMPT)};
const SCHEMA = ${JSON.stringify(SCHEMA)};
${VALIDATOR}
const job = $json.data;
const base = { reportId: job.reportId, leaseToken: job.leaseToken, model: job.model, promptVersion: job.promptVersion, attempt: job.attempt };
if (job.snapshot.totalEmployees === 0) {
  // Empty dataset: no model call; fixed Thai template (PRD §12.5).
  return { json: { ...base, mode: 'template', complete: { leaseToken: job.leaseToken, generatedBy: 'TEMPLATE', model: null, promptVersion: job.promptVersion, narrative: EMPTY_TEMPLATE } } };
}
return { json: { ...base, mode: 'gemini', snapshot: job.snapshot, request: geminiRequest(SYSTEM_PROMPT, SCHEMA, job.snapshot) } };`;

const interpret = `// Classifies the provider result into complete/fail; provider text is never forwarded.
${VALIDATOR}
const prep = $('Prepare job').item.json;
const res = $json;
const transport = res.error ? String(res.error.message ?? res.error.description ?? res.error) : null;
const r = interpretGemini(res.statusCode ?? 0, res.body, prep.snapshot, transport);
if (r.ok) {
  return { json: { action: 'complete', reportId: prep.reportId, complete: { leaseToken: prep.leaseToken, generatedBy: 'GEMINI', model: prep.model, promptVersion: prep.promptVersion, narrative: r.narrative } } };
}
return { json: { action: 'fail', reportId: prep.reportId, checks: r.detail ?? [], fail: { leaseToken: prep.leaseToken, errorCode: r.errorCode } } };`;

const rejected = `// The API rejected the result (400): report it as invalid model output.
const prep = $('Prepare job').item.json;
return { json: { reportId: prep.reportId, fail: { leaseToken: prep.leaseToken, errorCode: 'INVALID_MODEL_OUTPUT' } } };`;

n = 0;
const W = {
  trigger: {
    id: id(),
    name: 'Every 15 seconds',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: pos(0, 300),
    parameters: { rule: { interval: [{ field: 'seconds', secondsInterval: 15 }] } },
  },
  manual: onDemand(pos(0, 460)),
  claim: http('Claim job', { url: `${API}/report-jobs/claim`, credential: CREDENTIALS.worker, body: '{}', position: pos(220, 300) }),
  claimed: ifNode('Job claimed?', '={{ $json.data !== null && $json.data !== undefined }}', pos(440, 300)),
  prepare: code('Prepare job', prepareJob, pos(660, 200)),
  empty: ifNode('Empty snapshot?', "={{ $json.mode === 'template' }}", pos(880, 200)),
  gemini: http('Call Gemini', {
    url: '={{ $env.GEMINI_API_BASE }}/models/{{ $json.model }}:generateContent',
    credential: CREDENTIALS.gemini,
    body: '={{ JSON.stringify($json.request) }}',
    position: pos(1100, 300),
    timeout: 30000,
    full: true,
    continueOnError: true,
  }),
  interpret: code('Interpret response', interpret, pos(1320, 300)),
  ok: ifNode('Model output OK?', "={{ $json.action === 'complete' }}", pos(1540, 300)),
  complete: http('Complete job', {
    url: `${API}/report-jobs/{{ $json.reportId }}/complete`,
    credential: CREDENTIALS.worker,
    body: '={{ JSON.stringify($json.complete) }}',
    position: pos(1760, 120),
    full: true,
  }),
  rejectedIf: ifNode('Rejected by API?', '={{ $json.statusCode === 400 }}', pos(1980, 120)),
  rejected: code('Mark invalid output', rejected, pos(2200, 120)),
  fail: http('Fail job', {
    url: `${API}/report-jobs/{{ $json.reportId }}/fail`,
    credential: CREDENTIALS.worker,
    body: '={{ JSON.stringify($json.fail) }}',
    position: pos(2420, 400),
    full: true,
  }),
};

const worker = {
  id: 'ecReportWorker01',
  name: 'employee-report-worker',
  active: false,
  nodes: [
    ...Object.values(W),
    sticky(
      `## Employee Console report worker (${VERSION})\nClaims one job every 15 s from the API (lease 120 s), calls Gemini with structured output, validates the JSON and the numbers against the snapshot, then completes or fails the job. Retries/backoff/deadline are owned by the API state machine — n8n node retries stay off.\n\nCredentials to bind after import: **${CREDENTIALS.worker.name}** (Header Auth: Authorization = Bearer <WORKER_SERVICE_TOKEN>) and **${CREDENTIALS.gemini.name}** (Header Auth: x-goog-api-key = <GEMINI_API_KEY>).`,
      pos(0, -60),
      620,
      240,
    ),
  ],
  connections: {
    'Every 15 seconds': { main: [[{ node: 'Claim job', type: 'main', index: 0 }]] },
    'Run on demand': { main: [[{ node: 'Claim job', type: 'main', index: 0 }]] },
    'Claim job': { main: [[{ node: 'Job claimed?', type: 'main', index: 0 }]] },
    'Job claimed?': { main: [[{ node: 'Prepare job', type: 'main', index: 0 }], []] },
    'Prepare job': { main: [[{ node: 'Empty snapshot?', type: 'main', index: 0 }]] },
    'Empty snapshot?': {
      main: [[{ node: 'Complete job', type: 'main', index: 0 }], [{ node: 'Call Gemini', type: 'main', index: 0 }]],
    },
    'Call Gemini': { main: [[{ node: 'Interpret response', type: 'main', index: 0 }]] },
    'Interpret response': { main: [[{ node: 'Model output OK?', type: 'main', index: 0 }]] },
    'Model output OK?': {
      main: [[{ node: 'Complete job', type: 'main', index: 0 }], [{ node: 'Fail job', type: 'main', index: 0 }]],
    },
    'Complete job': { main: [[{ node: 'Rejected by API?', type: 'main', index: 0 }]] },
    'Rejected by API?': { main: [[{ node: 'Mark invalid output', type: 'main', index: 0 }], []] },
    'Mark invalid output': { main: [[{ node: 'Fail job', type: 'main', index: 0 }]] },
  },
  settings: {
    executionOrder: 'v1',
    timezone: 'Asia/Bangkok',
    // Polling every 15 s: keep failures for debugging, skip storing every successful empty poll.
    saveDataSuccessExecution: 'none',
    saveDataErrorExecution: 'all',
    saveManualExecutions: true,
    executionTimeout: 110,
  },
  pinData: {},
  meta: { templateCredsSetupCompleted: false, employeeConsole: VERSION },
  tags: [],
};

// ---------------------------------------------------------------- daily
n = 100;
const D = {
  trigger: {
    id: id(),
    name: 'Daily 09:00 Bangkok',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: pos(0, 300),
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 9 * * *' }] } },
  },
  manual: onDemand(pos(0, 460)),
  request: http('Request scheduled report', { url: `${API}/reports/scheduled`, credential: CREDENTIALS.scheduler, body: '{}', position: pos(240, 300), full: true }),
  conflict: ifNode('Another report active?', '={{ $json.statusCode === 409 }}', pos(480, 300)),
  wait: { id: id(), name: 'Wait 60 seconds', type: 'n8n-nodes-base.wait', typeVersion: 1.1, position: pos(720, 200), parameters: { amount: 60, unit: 'seconds' }, webhookId: '6c3e0f3a-1d7e-4bd6-9a59-0d5c3c7b0a11' },
  retry: http('Retry once', { url: `${API}/reports/scheduled`, credential: CREDENTIALS.scheduler, body: '{}', position: pos(960, 200), full: true }),
  done: { id: id(), name: 'Done', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: pos(1200, 300), parameters: {} },
};

const daily = {
  id: 'ecReportDaily001',
  name: 'employee-report-daily',
  active: false,
  nodes: [
    ...Object.values(D),
    sticky(
      `## Daily Workforce Snapshot (${VERSION})\n09:00 Asia/Bangkok. The API decides the business day and keeps one scheduled report per day (200 = already exists, 202 = queued). If another report is active (409) it retries once after 60 s, then stops. Missed days are not back-filled.\n\nCredential: **${CREDENTIALS.scheduler.name}** (Authorization = Bearer <SCHEDULER_SERVICE_TOKEN>).`,
      pos(0, -40),
      560,
      220,
    ),
  ],
  connections: {
    'Daily 09:00 Bangkok': { main: [[{ node: 'Request scheduled report', type: 'main', index: 0 }]] },
    'Run on demand': { main: [[{ node: 'Request scheduled report', type: 'main', index: 0 }]] },
    'Request scheduled report': { main: [[{ node: 'Another report active?', type: 'main', index: 0 }]] },
    'Another report active?': { main: [[{ node: 'Wait 60 seconds', type: 'main', index: 0 }], [{ node: 'Done', type: 'main', index: 0 }]] },
    'Wait 60 seconds': { main: [[{ node: 'Retry once', type: 'main', index: 0 }]] },
    'Retry once': { main: [[{ node: 'Done', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1', timezone: 'Asia/Bangkok', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' },
  pinData: {},
  meta: { employeeConsole: VERSION },
  tags: [],
};

writeFileSync(resolve(here, 'employee-report-worker.json'), `${JSON.stringify(worker, null, 2)}\n`);
writeFileSync(resolve(here, 'employee-report-daily.json'), `${JSON.stringify(daily, null, 2)}\n`);
console.log('wrote workflows/n8n/employee-report-worker.json and employee-report-daily.json');
