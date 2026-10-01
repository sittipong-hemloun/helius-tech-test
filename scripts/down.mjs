#!/usr/bin/env node
// pnpm down — stop every Employee Console container (dev, tools, staging). Volumes are kept.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, run } from './lib/sh.mjs';

run('docker', ['compose', '--profile', 'automation', '--profile', 'ci', '--profile', 'ai-workspace', 'down'], { allowFailure: true });
const stagingEnv = resolve(ROOT, '.env.staging');
if (existsSync(stagingEnv)) {
  run('docker', ['compose', '-f', 'compose.staging.yaml', '--env-file', stagingEnv, 'down'], {
    allowFailure: true,
    env: { ...process.env, IMAGE_TAG: process.env.IMAGE_TAG ?? 'none' },
  });
}
console.log('Stopped. Data volumes were not removed.');
