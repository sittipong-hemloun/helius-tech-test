import { randomBytes } from 'node:crypto';
import signature from 'cookie-signature';
import type { AppConfig } from '../config/app-config.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { randomToken } from '../auth/session-helpers.js';
import { databasePurpose } from '../seed/seed-original.js';

/**
 * Test-only session issuer (PRD §11.5). Writes a real row into the PostgreSQL session
 * store and returns the signed cookie the API expects. There is deliberately no HTTP
 * route for this: it runs only from the CLI/test harness and refuses unless
 * APP_ENV is test/performance, AUTH_FIXTURES_ENABLED=true and the database is marked
 * with the same purpose.
 */
export class FixtureRefused extends Error {}

export interface FixtureSession {
  cookieName: string;
  cookieValue: string;
  cookieHeader: string;
  csrfToken: string;
  userId: string;
  email: string;
  role: 'ADMIN' | 'VIEWER';
  expiresAt: string;
}

export async function assertFixturesAllowed(prisma: PrismaClient, config: AppConfig): Promise<void> {
  if (config.appEnv !== 'test' && config.appEnv !== 'performance') {
    throw new FixtureRefused(`session fixtures are disabled for APP_ENV=${config.appEnv}`);
  }
  if (!config.authFixturesEnabled) throw new FixtureRefused('AUTH_FIXTURES_ENABLED is not true');
  const purpose = await databasePurpose(prisma);
  if (purpose !== config.appEnv) {
    throw new FixtureRefused(`database purpose is "${purpose ?? 'unmarked'}", expected "${config.appEnv}"`);
  }
}

export async function createFixtureSession(
  prisma: PrismaClient,
  config: AppConfig,
  opts: { email: string; displayName?: string; now?: Date; idleMs?: number; absoluteMs?: number },
): Promise<FixtureSession> {
  await assertFixturesAllowed(prisma, config);
  const email = opts.email.trim().toLowerCase();
  const role = config.access.adminEmails.has(email) ? 'ADMIN' : config.access.viewerEmails.has(email) ? 'VIEWER' : null;
  if (!role) throw new FixtureRefused(`${email} is not in ADMIN_EMAILS or VIEWER_EMAILS for this environment`);

  const now = opts.now ?? new Date();
  const idleMs = opts.idleMs ?? config.session.idleTimeoutMs;
  const absoluteMs = opts.absoluteMs ?? config.session.absoluteTimeoutMs;
  const displayName = opts.displayName ?? (role === 'ADMIN' ? 'Test Admin' : 'Test Viewer');

  const user = await prisma.user.upsert({
    where: { googleSub: `fixture:${email}` },
    create: { googleSub: `fixture:${email}`, email, displayName, role, isEnabled: true, lastLoginAt: now },
    update: { role, isEnabled: true, lastLoginAt: now },
  });

  const sid = randomBytes(24).toString('base64url');
  const csrfToken = randomToken();
  // The session store compares `expire` with the real wall clock, so idle expiry is
  // anchored to real time; auth timestamps (absolute cap) follow `opts.now`.
  const expires = new Date(Date.now() + idleMs);
  const sess = {
    cookie: {
      originalMaxAge: idleMs,
      expires: expires.toISOString(),
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: config.session.secure,
    },
    auth: {
      userId: user.id,
      email,
      displayName,
      authenticatedAt: now.toISOString(),
      absoluteExpiresAt: new Date(now.getTime() + absoluteMs).toISOString(),
    },
    csrfToken,
  };
  await prisma.$executeRaw`
    INSERT INTO sessions (sid, sess, expire) VALUES (${sid}, ${JSON.stringify(sess)}::json, ${expires.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  const cookieValue = encodeURIComponent(`s:${signature.sign(sid, config.session.secret)}`);
  return {
    cookieName: config.session.cookieName,
    cookieValue,
    cookieHeader: `${config.session.cookieName}=${cookieValue}`,
    csrfToken,
    userId: user.id,
    email,
    role,
    expiresAt: expires.toISOString(),
  };
}
