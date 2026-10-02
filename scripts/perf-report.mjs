#!/usr/bin/env node
// node scripts/perf-report.mjs baseline optimized
// Prints markdown tables (p50/p95 per request kind for every run, error rates, payload, Lighthouse)
// from tests/performance/results/<label>/ so docs/performance.md quotes raw results, not estimates.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/sh.mjs';

const labels = process.argv.slice(2);
if (!labels.length) {
  console.error('usage: perf-report.mjs <label> [label...]');
  process.exit(2);
}

const KINDS = [
  ['list', 'read', 300],
  ['filter', 'read', 300],
  ['detail', 'read', 300],
  ['search', 'read', 500],
  ['create', 'write', 500],
  ['update', 'write', 500],
  ['delete', 'write', 500],
];

const load = (label, file) => {
  const p = resolve(ROOT, 'tests/performance/results', label, file);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};
const fmt = (n) => (n === undefined || n === null ? '—' : n >= 100 ? n.toFixed(0) : n.toFixed(1));
const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : undefined;
};

for (const label of labels) {
  const summary = load(label, 'summary.json');
  if (!summary) {
    console.log(`\n_no results for ${label}_`);
    continue;
  }
  const runs = summary.runs.map((r) => r.run);
  console.log(`\n### ${label}\n`);
  console.log(`commit \`${summary.environment?.commit?.slice(0, 12)}\`${summary.environment?.dirty ? ' (+ uncommitted changes)' : ''}, ${summary.environment?.cpu}, ${summary.environment?.memoryGiB} GiB, ${summary.environment?.os}, Docker VM ${summary.environment?.dockerVm}\n`);
  console.log(`| Request | Target p95 | ${runs.map((r) => `Run ${r} p50 / p95 (ms)`).join(' | ')} | Median p95 | Target met |`);
  console.log(`| --- | --- | ${runs.map(() => '---').join(' | ')} | --- | --- |`);
  for (const [kind, scenario, target] of KINDS) {
    const vals = runs.map((r) => load(label, `${scenario}-${r}.json`)?.metrics?.[`http_req_duration{phase:steady,kind:${kind}}`]);
    const p95s = vals.map((v) => v?.['p(95)']);
    const med = median(p95s);
    console.log(`| ${kind} | ≤ ${target} | ${vals.map((v) => `${fmt(v?.med)} / ${fmt(v?.['p(95)'])}`).join(' | ')} | ${fmt(med)} | ${med !== undefined && med <= target ? 'yes' : 'no'} |`);
  }

  console.log('\n| Run | Read requests (rps) | Read failed rate | Write requests (rps) | Write failed rate | List payload max (bytes) |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const r of runs) {
    const read = load(label, `read-${r}.json`)?.metrics ?? {};
    const write = load(label, `write-${r}.json`)?.metrics ?? {};
    console.log(
      `| ${r} | ${read.http_reqs?.count ?? '—'} (${fmt(read.http_reqs?.rate)}) | ${((read['http_req_failed{phase:steady}']?.rate ?? 0) * 100).toFixed(2)} % | ${write.http_reqs?.count ?? '—'} (${fmt(write.http_reqs?.rate)}) | ${((write['http_req_failed{phase:steady}']?.rate ?? 0) * 100).toFixed(2)} % | ${read.list_payload_bytes?.max ?? '—'} |`,
    );
  }
  if (summary.lighthouse?.runs?.length) {
    console.log('\n| Lighthouse run | Performance | Accessibility | CLS | LCP (ms) | TBT (ms) |');
    console.log('| --- | --- | --- | --- | --- | --- |');
    summary.lighthouse.runs.forEach((s, i) => console.log(`| ${i + 1} | ${s.performance} | ${s.accessibility} | ${s.cls.toFixed(3)} | ${s.lcpMs} | ${s.tbtMs} |`));
    const m = summary.lighthouse.median;
    console.log(`| **median** | **${m.performance}** | **${m.accessibility}** | **${m.cls.toFixed(3)}** | **${m.lcpMs}** | |`);
  }
  if (summary.indexes) {
    console.log('\nIndexes on `employees`:\n');
    for (const i of summary.indexes) console.log(`- \`${i.indexname}\` (${i.size})`);
  }
}
