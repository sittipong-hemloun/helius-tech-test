import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Loads the repository-root `.env` (from src/ or dist/). Variables that are already set (tests, shell) win. */
export function loadEnv(): void {
  const file = resolve(import.meta.dirname, '../../../.env');
  if (existsSync(file)) process.loadEnvFile(file);
}
