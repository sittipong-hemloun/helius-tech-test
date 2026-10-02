import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ArrowRight, Eye, ShieldCheck } from 'lucide-react';
import { Notice } from '@/components/notice';
import { getServerSession } from '@/lib/server-session';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, { title: string; body: string }> = {
  session_expired: {
    title: 'Your session ended.',
    body: 'Sessions end after 30 minutes without activity or 8 hours in total. Sign in again.',
  },
  login_failed: {
    title: 'Sign-in failed.',
    body: 'Please select a role again to sign in.',
  },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, session] = await Promise.all([searchParams, getServerSession()]);
  if (session.status === 'ok') redirect('/employees');
  const message = error ? ERRORS[error] ?? { title: 'Sign-in error', body: error } : undefined;

  return (
    <div className="min-h-dvh bg-ground">
      <header className="flex h-11 items-center gap-2.5 bg-ledger px-4 text-white sm:px-6">
        <span className="text-[0.9375rem] font-bold tracking-tight">Chememan</span>
        <span aria-hidden className="h-4 w-px bg-white/40" />
        <span className="text-[0.875rem] text-white/85">Employee Console</span>
      </header>
      <main className="flex justify-center px-4 pb-12 pt-[10vh]">
        <section
          aria-labelledby="sign-in-title"
          className="w-full max-w-[26rem] overflow-hidden rounded-[var(--radius-sheet)] border border-rule-strong/70 bg-sheet shadow-sm"
        >
          <div className="border-b border-rule px-5 py-4">
            <h1 id="sign-in-title" className="text-[1.125rem] font-bold text-ink">
              Sign in
            </h1>
            <p className="mt-1 text-[0.875rem] text-ink-2">
              Select your role to access the Employee Console.
            </p>
          </div>

          <div className="space-y-3 px-5 py-5">
            {message ? (
              <Notice tone="error" title={message.title} className="mb-4">
                {message.body}
              </Notice>
            ) : null}

            {/* Admin sign-in */}
            <a
              href="/api/auth/login?role=ADMIN"
              className="group flex items-center justify-between gap-3 rounded-[var(--radius-sheet)] border border-ledger bg-ledger/5 p-4 transition-colors hover:bg-ledger/10 hover:border-ledger"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-ledger text-white">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <span className="text-[0.9375rem] font-semibold text-ledger group-hover:underline">
                    Sign in as Admin
                  </span>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                    Full management access: CRUD employees, view salaries, generate AI workforce reports.
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-ledger transition-transform group-hover:translate-x-0.5" />
            </a>

            {/* Viewer sign-in */}
            <a
              href="/api/auth/login?role=VIEWER"
              className="group flex items-center justify-between gap-3 rounded-[var(--radius-sheet)] border border-rule-strong bg-ground/50 p-4 transition-colors hover:bg-ground hover:border-ink-3"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-rule bg-surface text-ink-2">
                  <Eye className="size-4" />
                </div>
                <div>
                  <span className="text-[0.9375rem] font-semibold text-ink group-hover:underline">
                    Sign in as Viewer
                  </span>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                    Read-only search and listing. Salary information is masked; changes are disabled.
                  </p>
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          <footer className="border-t border-rule bg-head px-5 py-3 text-[0.8125rem] text-ink-2">
            Local role-based authentication. No external account or internet connection required.
          </footer>
        </section>
      </main>
    </div>
  );
}
