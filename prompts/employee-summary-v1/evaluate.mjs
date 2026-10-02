#!/usr/bin/env node
// Runs the 5 fixtures through the same prompt/schema/validator as the n8n worker (PRD §12.6).
//   GEMINI_API_KEY=... node prompts/employee-summary-v1/evaluate.mjs [--model=gemini-3.8-flash]
// Writes results/<timestamp>-<model>.json (inputs, raw outputs, checks, pass/fail).
// This is the API path; the Google AI Studio session is recorded separately in ai-studio.md.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMPTY_TEMPLATE, checkNarrative, geminiRequest, interpretGemini } from './validate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const model = process.argv.find((a) => a.startsWith('--model='))?.split('=')[1] ?? process.env.GEMINI_MODEL ?? 'gemini-flash-lite-latest';
const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('GEMINI_API_KEY is not set; nothing was sent. (Fixtures with 0 employees never call the model.)');
  process.exit(2);
}
const system = readFileSync(resolve(here, 'system-prompt.txt'), 'utf8').trim();
const schema = JSON.parse(readFileSync(resolve(here, 'response-schema.json'), 'utf8'));
const results = [];

for (const file of readdirSync(resolve(here, 'fixtures')).sort()) {
  const fx = JSON.parse(readFileSync(resolve(here, 'fixtures', file), 'utf8'));
  const started = Date.now();
  if (fx.snapshot.totalEmployees === 0) {
    const check = checkNarrative(EMPTY_TEMPLATE, fx.snapshot);
    results.push({ fixture: file, generator: 'TEMPLATE', calledModel: false, output: EMPTY_TEMPLATE, checks: check.errors, pass: check.ok });
    continue;
  }
  let status = 0;
  let body = null;
  let transport = null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(geminiRequest(system, schema, fx.snapshot)),
      signal: AbortSignal.timeout(30_000),
    });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch (err) {
    transport = String(err?.message ?? err);
  }
  const r = interpretGemini(status, body, fx.snapshot, transport);
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? null;
  results.push({
    fixture: file,
    generator: 'GEMINI',
    calledModel: true,
    httpStatus: status,
    latencyMs: Date.now() - started,
    modelVersion: body?.modelVersion ?? null,
    usage: body?.usageMetadata ?? null,
    rawText: text,
    output: r.ok ? r.narrative : null,
    errorCode: r.ok ? null : r.errorCode,
    checks: r.detail ?? [],
    pass: r.ok,
  });
}

mkdirSync(resolve(here, 'results'), { recursive: true });
const out = resolve(here, 'results', `${new Date().toISOString().replace(/[:.]/g, '-')}-${model}.json`);
writeFileSync(out, `${JSON.stringify({ model, promptVersion: 'employee-summary-v1', ranAt: new Date().toISOString(), results }, null, 2)}\n`);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.fixture}  ${r.generator}${r.errorCode ? `  ${r.errorCode}` : ''}${r.checks?.length ? `  ${r.checks.join(',')}` : ''}`);
console.log(`saved ${out.replace(`${process.cwd()}/`, '')}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
