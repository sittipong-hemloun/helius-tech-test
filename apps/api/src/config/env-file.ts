import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

/**
 * Loads variables for local processes and CLI scripts.
 * ENV_FILE wins when set; otherwise the repository root `.env` is used.
 * Values already present in process.env are never overridden (containers/CI inject them).
 */
export function loadEnvFile(): string | null {
  const candidates = [process.env.ENV_FILE, resolve(import.meta.dirname, '../../../../.env')].filter(
    (p): p is string => Boolean(p),
  );
  for (const file of candidates) {
    if (existsSync(file)) {
      config({ path: file, quiet: true, override: false });
      return file;
    }
  }
  return null;
}
