#!/usr/bin/env node
// Checks one model output (e.g. copied from Google AI Studio) against the fixture it was produced from.
//   node prompts/employee-summary-v1/check-output.mjs 03-all-active '{"headline":"…","bullets":["…","…","…"]}'
//   node prompts/employee-summary-v1/check-output.mjs 03-all-active output.json
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkNarrative } from './validate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [fixtureName, output] = process.argv.slice(2);
if (!fixtureName || !output) {
  console.error('usage: check-output.mjs <fixture name, e.g. 01-seed> <json string | path to json file>');
  process.exit(2);
}
const fixtureFile = resolve(here, 'fixtures', fixtureName.endsWith('.json') ? fixtureName : `${fixtureName}.json`);
if (!existsSync(fixtureFile)) {
  console.error(`fixture not found: ${fixtureFile}`);
  process.exit(2);
}
const { snapshot } = JSON.parse(readFileSync(fixtureFile, 'utf8'));
const narrative = JSON.parse(existsSync(output) ? readFileSync(output, 'utf8') : output);
const result = checkNarrative(narrative, snapshot);
console.log(JSON.stringify({ fixture: fixtureName, ...result }, null, 2));
process.exit(result.ok ? 0 : 1);
