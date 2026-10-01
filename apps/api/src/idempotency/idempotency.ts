import { createHash } from 'node:crypto';
import { Errors } from '../common/api-exception.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseIdempotencyKey(header: string | string[] | undefined): string {
  if (typeof header !== 'string' || !UUID.test(header.trim())) throw Errors.idempotencyKeyInvalid();
  return header.trim().toLowerCase();
}

/** Stable JSON (sorted keys) so equivalent normalized payloads hash identically. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function hashPayload(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
