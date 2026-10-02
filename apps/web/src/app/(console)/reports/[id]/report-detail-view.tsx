'use client';

import { PageBar, pageTitleClass } from '@/components/app-shell';
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
    <article aria-busy={!r}>
      <PageBar back={{ href: '/reports', label: 'Reports' }} actions={r ? <ReportStatusBadge status={r.status as never} /> : null}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className={pageTitleClass}>Workforce Snapshot</h1>
          <p className="figures text-[0.8125rem] text-ink-2">
            {r ? `Snapshot taken ${formatTimestamp(r.snapshotCapturedAt)} (Asia/Bangkok)` : <Skeleton className="h-4 w-64" />}
          </p>
        </div>
      </PageBar>

      <div className="max-w-4xl">
        {query.isError && r ? (
          <Notice tone="warning" title="Couldn't refresh this report. Showing the last loaded status." className="mb-4"
            action={<Button variant="secondary" size="sm" onClick={() => void query.refetch()}>Try again</Button>}>
            {describeError(query.error).detail}
          </Notice>
        ) : null}

        {/* Deterministic numbers from PostgreSQL are the primary content (PRD §12.1); the totals row closes the sheet. */}
        <section aria-labelledby="numbers" className="overflow-hidden rounded-[var(--radius-sheet)] border border-rule bg-sheet">
          <h2 id="numbers" className="border-b border-rule px-3 py-2 text-[0.8125rem] font-semibold">
            Headcount from the database
          </h2>
          <table className="register w-full text-left text-[0.8125rem]">
            <caption className="sr-only">Employees by department</caption>
            <thead>
              <tr>
                {['Department', 'Total', 'Active', 'In Active'].map((h, i) => (
                  <th key={h} scope="col" className={`whitespace-nowrap px-3 py-1.5 font-semibold text-ink ${i > 0 ? 'w-28 text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="greenbar">
              {s
                ? s.departments.map((d) => (
                    <tr key={d.id}>
                      <th scope="row" className="px-3 py-1.5 font-medium">
                        {d.name}
                      </th>
                      <td className="figures px-3 py-1.5 text-right">{d.total}</td>
                      <td className="figures px-3 py-1.5 text-right">{d.active}</td>
                      <td className="figures px-3 py-1.5 text-right">{d.inactive}</td>
                    </tr>
                  ))
                : Array.from({ length: 4 }, (_, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2" colSpan={4}>
                        <Skeleton className="h-3.5 w-full" />
                      </td>
                    </tr>
                  ))}
            </tbody>
            {s ? (
              <tfoot>
                <tr className="bg-head font-bold text-navy [&>*]:border-t-2 [&>*]:border-t-rule-strong">
                  <th scope="row" className="px-3 py-2">
                    All employees
                  </th>
                  <td className="figures px-3 py-2 text-right">{s.totalEmployees}</td>
                  <td className="figures px-3 py-2 text-right">{s.activeEmployees}</td>
                  <td className="figures px-3 py-2 text-right">{s.inactiveEmployees}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </section>

        <section aria-labelledby="summary" className="mt-4 overflow-hidden rounded-[var(--radius-sheet)] border border-rule bg-sheet">
          <h2 id="summary" className="flex items-start gap-2 border-b border-rule px-3 py-2 text-[0.8125rem] font-semibold">
            {r?.generatedBy === 'TEMPLATE'
              ? `Template summary (no employees, AI not called) — based on snapshot at ${formatTimestamp(r.snapshotCapturedAt)}`
              : `AI-generated summary — based on snapshot at ${r ? formatTimestamp(r.snapshotCapturedAt) : '…'}`}
          </h2>
          <div className="px-3 pb-3">
            {r?.status === 'SUCCEEDED' && r.narrative ? (
              // Rendered as plain text; React escapes it, no HTML from the model is ever interpreted.
              <div lang="th" className="mt-3">
                <p className="text-lg font-semibold leading-snug">{r.narrative.headline}</p>
                <ul className="mt-3 max-w-[72ch] list-disc space-y-1.5 pl-5 text-[1rem] leading-relaxed marker:text-ledger">
                  {r.narrative.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                <p className="mt-4 text-[0.8125rem] text-ink-2">
                  {r.generatedBy === 'GEMINI' ? `Written by ${r.model} with prompt ${r.promptVersion}` : 'Written from a fixed template'}, completed{' '}
                  {formatTimestamp(r.completedAt)}. The numbers above come from the database and are the source of truth.
                </p>
              </div>
            ) : r?.status === 'FAILED' ? (
              <Notice bare tone="error" title="The summary could not be generated." className="mt-2">
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
          </div>
        </section>
      </div>
    </article>
  );
}
