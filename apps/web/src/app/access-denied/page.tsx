import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from '@/lib/server-session';

export const metadata: Metadata = { title: 'Access denied' };
export const dynamic = 'force-dynamic';

const REASONS: Record<string, { title: string; body: string }> = {
  not_allowed: {
    title: "This Google account isn't on the access list.",
    body: 'Ask an Employee Console admin to add your email address, then sign in again.',
  },
  email_unverified: {
    title: 'Your Google email address is not verified.',
    body: 'Verify the address in your Google account, then sign in again.',
  },
  account_conflict: {
    title: 'This email is already linked to a different Google account.',
    body: 'Sign in with the Google account that was used before, or ask an admin to review the access list.',
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
      <p className="type-expanded text-[4rem] font-black leading-none text-stamp">403</p>
      <h1 className="type-wide mt-4 text-2xl font-bold">{copy.title}</h1>
      <p className="mt-2 text-ink-2">{copy.body}</p>
      <div className="mt-8">
        <Link
          href={signedIn ? '/employees' : '/login'}
          className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-ledger px-4 font-medium text-white hover:bg-ledger-deep"
        >
          {signedIn ? 'Go to employees' : 'Back to sign in'}
        </Link>
      </div>
    </main>
  );
}
