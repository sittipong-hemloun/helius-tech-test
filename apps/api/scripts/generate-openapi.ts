// pnpm openapi:generate — writes packages/api-client/openapi.json from the Nest decorators.
// Runs without a database (providers connect lazily) and with placeholder, non-secret config.
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument, createApp } from '../src/bootstrap.js';
import { JsonLogger } from '../src/common/json-logger.js';
import { loadConfig } from '../src/config/app-config.js';

const config = loadConfig({
  APP_ENV: 'local',
  DATABASE_URL: 'postgresql://openapi:openapi@127.0.0.1:1/openapi',
  SESSION_SECRET: 'openapi-generation-only-not-a-real-secret-value',
  SESSION_COOKIE_NAME: 'employee_console.local.sid',
  APP_VERSION: process.env.APP_VERSION ?? '1.0.0',
});
const app = await createApp(config, { swagger: false, logger: new JsonLogger('local', 'error') });
const document = buildOpenApiDocument(app, config);

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

// Compiled to .tmp/scripts before running (tsc emits decorator metadata; tsx/esbuild does not).
const out = resolve(process.cwd(), '../../packages/api-client/openapi.json');
writeFileSync(out, `${JSON.stringify(sortKeys(document), null, 2)}\n`);
console.log(`OpenAPI written to ${out} (${Object.keys(document.paths).length} paths)`);
await app.close();
