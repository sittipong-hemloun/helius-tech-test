import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Notice } from '@/components/notice';
import { getGoogleConfigured, getServerSession } from '@/lib/server-session';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, { title: string; body: string }> = {
  google_cancelled: { title: 'Sign-in was cancelled.', body: 'Choose your Google account again to continue.' },
  login_expired: { title: 'The sign-in link expired.', body: 'Sign-in requests last 10 minutes. Start again.' },
  login_failed: { title: 'Google sign-in could not be verified.', body: 'Start sign-in again. If it keeps failing, check the server clock and Google client settings.' },
  provider_unavailable: { title: 'Google could not be reached.', body: 'Check the network connection, then try again.' },
  session_expired: { title: 'Your session ended.', body: 'Sessions end after 30 minutes without activity or 8 hours in total. Sign in again.' },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, session, googleConfigured] = await Promise.all([searchParams, getServerSession(), getGoogleConfigured()]);
  if (session.status === 'ok') redirect('/employees');
  const message = error ? ERRORS[error] : undefined;

  return (
    <div className="min-h-dvh">
      <header className="flex h-11 items-center gap-2.5 bg-ledger px-4 text-white sm:px-6">
        <span className="text-[0.9375rem] font-bold tracking-tight">Chememan</span>
        <span aria-hidden className="h-4 w-px bg-white/40" />
        <span className="text-[0.875rem] text-white/85">Employee Console</span>
      </header>
      <main className="flex justify-center px-4 pb-12 pt-[12vh]">
        <section aria-labelledby="sign-in-title" className="w-full max-w-[25rem] overflow-hidden rounded-[var(--radius-sheet)] border border-rule-strong/70 bg-sheet">
          <h1 id="sign-in-title" className="border-b border-rule px-5 py-3 text-[0.9375rem] font-bold">
            Sign in
          </h1>
          <div className="px-5 py-4">
            <p className="text-ink-2">Use the Google account your administrator added to the access list.</p>

            {message ? (
              <Notice tone="error" title={message.title} className="mt-4">
                {message.body}
              </Notice>
            ) : null}

            {googleConfigured === false ? (
              <Notice tone="warning" title="Google sign-in isn't set up on this server yet." className="mt-4">
                Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and ADMIN_EMAILS to the environment, then restart the API.
              </Notice>
            ) : null}
            {googleConfigured === null ? (
              <Notice tone="error" title="The API is not responding." className="mt-4">
                Sign-in is unavailable until the API is ready. Reload this page in a moment.
              </Notice>
            ) : null}

            {googleConfigured ? (
              // A full-page navigation: the API sets the login state cookie and redirects to Google.
              <a
                href="/api/auth/google"
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-3 rounded-[var(--radius-control)] border border-rule-strong bg-sheet px-4 font-semibold text-ink hover:bg-bar"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="size-5">
                  <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
                  <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z" />
                  <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
                </svg>
                Sign in with Google
              </a>
            ) : (
              <button type="button" disabled className="mt-4 h-9 w-full rounded-[var(--radius-control)] border border-rule bg-ground font-semibold text-ink-3">
                Sign in with Google
              </button>
            )}
          </div>
          <p className="border-t border-rule bg-head px-5 py-2.5 text-[0.8125rem] text-ink-2">
            No password sign-in. Admins manage employee records; viewers search the list and read reports, without salaries.
          </p>
        </section>
      </main>
    </div>
  );
}
