import 'server-only';
import type { SessionData } from '@employee-console/api-client';
import { headers } from 'next/headers';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

export type ServerSession = { status: 'ok'; session: SessionData } | { status: 'anonymous' } | { status: 'unavailable' };

/** Server-side session check before rendering protected pages (no flash of restricted data). */
export async function getServerSession(): Promise<ServerSession> {
  // Forward the browser's Cookie header byte-for-byte (signed session cookie).
  const cookieHeader = (await headers()).get('cookie');
  if (!cookieHeader) return { status: 'anonymous' };
  try {
    const res = await fetch(`${API}/api/auth/session`, {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403) return { status: 'anonymous' };
    if (!res.ok) return { status: 'unavailable' };
    const body = (await res.json()) as { data: SessionData };
    return { status: 'ok', session: body.data };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function getGoogleConfigured(): Promise<boolean | null> {
  try {
    const res = await fetch(`${API}/api/auth/providers`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { google: { configured: boolean } } };
    return body.data.google.configured;
  } catch {
    return null;
  }
}
