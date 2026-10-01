import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import type { Request } from 'express';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Constant-time string comparison via SHA-256 digests (lengths may differ). */
export function safeEqual(a: string, b: string): boolean {
  const da = createHash('sha256').update(a).digest();
  const db = createHash('sha256').update(b).digest();
  return timingSafeEqual(da, db);
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
}

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
}

/**
 * Destroys the server-side session. `strict` (logout) propagates store errors so the caller
 * never reports success while the session row still exists; elsewhere a failure is tolerated
 * because the request is rejected anyway.
 */
export function destroySession(req: Request, { strict = false }: { strict?: boolean } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    req.session.destroy((err) => (err && strict ? reject(err) : resolve()));
  });
}

/** Absolute-timeout rule (PRD §11.2): idle refreshes do not extend the 8h cap. */
export function isAbsolutelyExpired(absoluteExpiresAt: string, now: Date): boolean {
  return new Date(absoluteExpiresAt).getTime() <= now.getTime();
}

/** Cookie lifetime = min(idle timeout, time left before the absolute cap). */
export function cookieMaxAge(idleMs: number, absoluteExpiresAt: string, now: Date): number {
  return Math.max(0, Math.min(idleMs, new Date(absoluteExpiresAt).getTime() - now.getTime()));
}
