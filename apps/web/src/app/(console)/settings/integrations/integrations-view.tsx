'use client';

import { CircleCheck, CircleMinus, CircleX } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/app-shell';
import { Notice } from '@/components/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { describeError } from '@/lib/api';
import { formatTimestamp } from '@/lib/format';
import { useIntegrations, useReadiness } from '@/lib/queries';
import { useSession } from '@/lib/session';

type State = 'ok' | 'off' | 'bad';

function Row({ label, state, value, note }: { label: string; state: State | null; value: ReactNode; note?: string }) {
  const Icon = state === 'ok' ? CircleCheck : state === 'bad' ? CircleX : CircleMinus;
  return (
    <div className="grid sm:grid-cols-[13rem_minmax(0,1fr)]">
      <dt className="bg-head px-3 py-2 text-[0.8125rem] font-medium text-ink-2">{label}</dt>
      <dd className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          {state ? <Icon aria-hidden className={`size-4 ${state === 'ok' ? 'text-ledger' : state === 'bad' ? 'text-stamp' : 'text-ink-3'}`} /> : null}
          {value}
        </span>
        {note ? <p className="mt-0.5 text-[0.8125rem] text-ink-2">{note}</p> : null}
      </dd>
    </div>
  );
}

/** Read-only presence of configuration (never values). "Configured" is not a live test (PRD §13.4). */
export function IntegrationsView() {
  const { session } = useSession();
  const status = useIntegrations();
  const ready = useReadiness();

  if (!session.permissions.canViewIntegrations) {
    return <Notice tone="error" title="Integrations are visible to admins only." />;
  }
  const s = status.data;

  return (
    <>
      <PageHeader title="Integrations" meta="Configuration status for this server. Secrets are never shown here." />
      {status.isError ? <Notice tone="error" title={describeError(status.error).title} className="mb-4" /> : null}
      <dl className="max-w-3xl divide-y divide-rule overflow-hidden rounded-[var(--radius-sheet)] border border-rule bg-sheet">
        <Row label="Core API and database" state={ready.data === undefined ? null : ready.data ? 'ok' : 'bad'} value={ready.data === undefined ? <Skeleton className="h-4 w-24" /> : ready.data ? 'Ready' : 'Not ready'} />
        <Row
          label="Google sign-in"
          state={s ? (s.google.configured ? 'ok' : 'off') : null}
          value={s ? (s.google.configured ? 'Configured' : 'Not configured') : <Skeleton className="h-4 w-24" />}
          note="Configured means the client ID and secret are present; it does not prove a live sign-in."
        />
        <Row
          label="AI reports"
          state={s ? (s.reports.enabled ? 'ok' : 'off') : null}
          value={s ? (s.reports.enabled ? 'Enabled' : 'Disabled (REPORTS_ENABLED=false)') : <Skeleton className="h-4 w-24" />}
        />
        <Row label="Gemini model" state={null} value={s ? <code className="text-[0.9rem]">{s.reports.model}</code> : <Skeleton className="h-4 w-40" />} />
        <Row
          label="Report worker (n8n)"
          state={s ? (s.reports.workerAvailable ? 'ok' : 'bad') : null}
          value={s ? (s.reports.workerAvailable ? 'Available' : 'Unavailable') : <Skeleton className="h-4 w-24" />}
          note={s ? (s.reports.workerLastSeenAt ? `Last seen ${formatTimestamp(s.reports.workerLastSeenAt)} (Asia/Bangkok). Unavailable after 60 seconds of silence.` : 'The worker has not checked in yet.') : undefined}
        />
        <Row label="Build" state={null} value={s ? <span className="figures">Version {s.build.appVersion}, commit {s.build.commitSha.slice(0, 12)}</span> : <Skeleton className="h-4 w-32" />} />
      </dl>
    </>
  );
}
