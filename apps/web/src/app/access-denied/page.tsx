import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from '@/lib/server-session';

export const metadata: Metadata = { title: 'Access denied' };
export const dynamic = 'force-dynamic';

const REASONS: Record<string, { title: string; body: string }> = {
  not_allowed: {
    title: "This account isn't on the access list.",
    body: 'Ask an Employee Console admin to add your email address, then sign in again.',
  },
  email_unverified: {
    title: 'Your email address is not verified.',
    body: 'Verify the address in your account, then sign in again.',
  },
  account_conflict: {
    title: 'This account has a conflicting role binding.',
    body: 'Sign in with your assigned account, or ask an admin to review the access list.',
  },
  role: {
    title: "Your role doesn't include this page.",
    body: 'Viewers can search employees and read reports. Ask an admin if you need to change records.',
  },
};

export default async function AccessDeniedPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const [{ reason }, session] = await Promise.all([searchParams, getServerSession()]);
  const copy = REASONS[reason ?? 'not_allowed'] ?? REASONS.not_allowed;
  const signedIn = session.status === 'ok';
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16">
      <p className="figures text-[0.8125rem] font-semibold text-stamp">Error 403</p>
      <h1 className="mt-1 text-[1.25rem] font-bold">{copy.title}</h1>
      <p className="mt-2 text-ink-2">{copy.body}</p>
      <div className="mt-5">
        <Link
          href={signedIn ? '/employees' : '/login'}
          className="inline-flex h-8 items-center rounded-[var(--radius-control)] bg-ledger px-3 font-medium text-white hover:bg-ledger-hover"
        >
          {signedIn ? 'Go to employees' : 'Back to sign in'}
        </Link>
      </div>
    </main>
  );
}
