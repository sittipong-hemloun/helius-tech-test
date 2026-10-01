import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { Notice } from '@/components/notice';
import { getServerSession } from '@/lib/server-session';
import { SessionProvider } from '@/lib/session';
import { UnsavedChangesProvider } from '@/lib/unsaved-changes';

export const dynamic = 'force-dynamic';

/** Every console page renders only after the API confirmed the session and role. */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const result = await getServerSession();
  if (result.status === 'anonymous') redirect('/login');
  if (result.status === 'unavailable') {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Notice tone="error" title="Employee Console can't reach its API right now.">
          The database or API service is not ready. Reload in a moment; if it keeps failing, run <code>pnpm run doctor</code>.
        </Notice>
      </main>
    );
  }
  return (
    <SessionProvider session={result.session}>
      <UnsavedChangesProvider>
        <AppShell>{children}</AppShell>
      </UnsavedChangesProvider>
    </SessionProvider>
  );
}
