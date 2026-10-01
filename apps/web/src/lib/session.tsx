'use client';

import type { SessionData } from '@employee-console/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { api, setCsrfToken, setUnauthorizedHandler } from './api';

interface SessionContextValue {
  session: SessionData;
  /** Prefix for every query key so cached data never crosses users or roles (PRD §10.4). */
  scope: readonly [string, string];
  logout: () => Promise<void>;
  refresh: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function goToLogin(reason?: string) {
  window.location.assign(reason ? `/login?error=${encodeURIComponent(reason)}` : '/login');
}

export function SessionProvider({ session, children }: { session: SessionData; children: ReactNode }) {
  const queryClient = useQueryClient();
  setCsrfToken(session.csrfToken);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Session ended (idle/absolute timeout or logout elsewhere): drop personal data first.
      queryClient.clear();
      setCsrfToken(null);
      goToLogin('session_expired');
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      queryClient.clear();
      setCsrfToken(null);
      goToLogin();
    }
  }, [queryClient]);

  // A 403 while the UI believes it has the role means the allowlist changed: reload the session.
  const refresh = useCallback(() => window.location.reload(), []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, scope: [session.user.id, session.user.role] as const, logout, refresh }),
    [session, logout, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
