'use client';

import { ArrowLeft, Sparkles } from 'lucide-react';
import { Notice } from '@/components/notice';
import { REPORT_ERRORS, ReportStatusBadge } from '@/components/report-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, describeError } from '@/lib/api';
import { formatTimestamp } from '@/lib/format';
import { useReport } from '@/lib/queries';
import { GuardedLink } from '@/lib/unsaved-changes';

export function ReportDetailView({ id }: { id: string }) {
  const query = useReport(id);
  const r = query.data;

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <Notice tone="warning" title="This report doesn't exist." action={<GuardedLink href="/reports" className="font-medium text-ledger underline underline-offset-4">Back to reports</GuardedLink>} />
    );
  }
  if (query.isError && !r) {
    return <Notice tone="error" title={describeError(query.error).title} action={<Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Try again</Button>} />;
  }

  const s = r?.snapshot;
  return (
    <article className="max-w-4xl" aria-busy={!r}>
      <GuardedLink href="/reports" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Reports
      </GuardedLink>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="type-expanded text-[2rem] font-extrabold leading-none sm:text-[2.5rem]">Workforce Snapshot</h1>
          <p className="figures mt-2 text-ink-2">{r ? `Snapshot taken ${formatTimestamp(r.snapshotCapturedAt)} (Asia/Bangkok)` : <Skeleton className="h-4 w-64" />}</p>
        </div>
        {r ? <ReportStatusBadge status={r.status as never} /> : null}
      </div>

      {/* Deterministic numbers from PostgreSQL are the primary content (PRD §12.1). */}
      <section aria-labelledby="numbers" className="overflow-hidden rounded-[var(--radius-sheet)] border border-rule bg-sheet">
        <h2 id="numbers" className="sr-only">Headcount from the database</h2>
        <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
          {[
            ['Employees', s?.totalEmployees],
            ['Active', s?.activeEmployees],
            ['In Active', s?.inactiveEmployees],
          ].map(([label, value]) => (
            <div key={label as string} className="px-5 py-4">
              <p className="text-sm text-ink-3">{label}</p>
              <p className="figures type-expanded mt-1 text-3xl font-black">{value ?? <Skeleton className="h-8 w-12" />}</p>
            </div>
          ))}
        </div>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Employees by department</caption>
          <thead>
            <tr className="border-b border-rule">
              {['Department', 'Total', 'Active', 'In Active'].map((h, i) => (
                <th key={h} scope="col" className={`type-condensed px-5 py-2.5 text-[0.875rem] font-semibold text-ink-2 ${i > 0 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="greenbar">
            {s
              ? s.departments.map((d) => (
                  <tr key={d.id}>
                    <th scope="row" className="px-5 py-2.5 font-medium">
                      {d.name}
                    </th>
                    <td className="figures px-5 py-2.5 text-right">{d.total}</td>
                    <td className="figures px-5 py-2.5 text-right">{d.active}</td>
                    <td className="figures px-5 py-2.5 text-right">{d.inactive}</td>
                  </tr>
                ))
              : Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3" colSpan={4}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="summary" className="mt-6 rounded-[var(--radius-sheet)] border border-rule bg-sheet px-5 py-5 sm:px-6">
        <h2 id="summary" className="flex items-center gap-2 text-sm font-medium text-ink-2">
          <Sparkles aria-hidden className="size-4 text-ledger" />
          {r?.generatedBy === 'TEMPLATE'
            ? `Template summary (no employees, AI not called) — based on snapshot at ${formatTimestamp(r.snapshotCapturedAt)}`
            : `AI-generated summary — based on snapshot at ${r ? formatTimestamp(r.snapshotCapturedAt) : '…'}`}
        </h2>
        {r?.status === 'SUCCEEDED' && r.narrative ? (
          // Rendered as plain text; React escapes it, no HTML from the model is ever interpreted.
          <div lang="th" className="mt-3">
            <p className="text-lg font-semibold leading-snug">{r.narrative.headline}</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
              {r.narrative.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-3">
              {r.generatedBy === 'GEMINI' ? `Written by ${r.model} with prompt ${r.promptVersion}` : 'Written from a fixed template'}, completed{' '}
              {formatTimestamp(r.completedAt)}. The numbers above come from the database and are the source of truth.
            </p>
          </div>
        ) : r?.status === 'FAILED' ? (
          <Notice tone="error" title="The summary could not be generated." className="mt-3">
            {REPORT_ERRORS[r.errorCode ?? ''] ?? 'The report failed.'} ({r.errorCode}) The headcount above is still accurate. Generate a new report to try again.
          </Notice>
        ) : r ? (
          <p className="mt-3 text-ink-2" role="status">
            {r.status === 'QUEUED'
              ? r.attempts > 0
                ? `Waiting to retry (attempt ${r.attempts + 1} of 3).`
                : 'Queued — waiting for the report worker to pick it up.'
              : `Writing the summary (attempt ${r.attempts} of 3)…`}{' '}
            This page updates every 2 seconds.
          </p>
        ) : (
          <Skeleton className="mt-3 h-5 w-2/3" />
        )}
      </section>
    </article>
  );
}
