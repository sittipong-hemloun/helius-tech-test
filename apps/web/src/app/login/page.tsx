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

const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR'];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, session, googleConfigured] = await Promise.all([searchParams, getServerSession(), getGoogleConfigured()]);
  if (session.status === 'ok') redirect('/employees');
  const message = error ? ERRORS[error] : undefined;

  return (
    <main className="ledger-lines min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-6xl content-center gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center">
        <section aria-labelledby="title">
          <h1 id="title" className="type-expanded text-[clamp(2.75rem,7.4vw,5.75rem)] font-black leading-[0.92] tracking-[-0.02em]">
            Employee
            <br />
            <span className="text-ledger">Console</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg text-ink-2">
            Find, add and update the people records from the staff spreadsheet. Admins manage records; viewers can search the
            list without salaries.
          </p>
          <ul aria-label="Departments in the register" className="mt-8 flex flex-wrap gap-2">
            {DEPARTMENTS.map((d) => (
              <li key={d} className="type-condensed rounded-t-md border border-b-0 border-rule-strong bg-sheet px-3 pb-1 pt-1.5 text-sm font-semibold text-ink-2">
                {d}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Sign in" className="rounded-[var(--radius-sheet)] border border-rule bg-sheet p-6 shadow-[0_24px_60px_-28px_rgb(27_42_34/0.35)] sm:p-8">
          <h2 className="type-wide text-xl font-bold">Sign in</h2>
          <p className="mt-1 text-ink-2">Use the Google account your administrator added to the access list.</p>

          {message ? (
            <Notice tone="error" title={message.title} className="mt-5">
              {message.body}
            </Notice>
          ) : null}

          {googleConfigured === false ? (
            <Notice tone="warning" title="Google sign-in isn't set up on this server yet." className="mt-5">
              Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and ADMIN_EMAILS to the environment, then restart the API.
            </Notice>
          ) : null}
          {googleConfigured === null ? (
            <Notice tone="error" title="The API is not responding." className="mt-5">
              Sign-in is unavailable until the API is ready. Reload this page in a moment.
            </Notice>
          ) : null}

          {googleConfigured ? (
            // A full-page navigation: the API sets the login state cookie and redirects to Google.
            <a
              href="/api/auth/google"
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-control)] border border-rule-strong bg-sheet px-4 font-semibold text-ink hover:bg-ledger-wash"
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
            <button type="button" disabled className="mt-6 h-12 w-full rounded-[var(--radius-control)] border border-rule bg-ground font-semibold text-ink-3">
              Sign in with Google
            </button>
          )}
          <p className="mt-4 text-sm text-ink-3">There is no password sign-in. Access is limited to allow-listed Google accounts.</p>
        </section>
      </div>
    </main>
  );
}
