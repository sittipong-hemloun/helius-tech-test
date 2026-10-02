'use client';

import { FilePlus2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/app-shell';
import { Notice } from '@/components/notice';
import { ReportStatusBadge } from '@/components/report-status';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, describeError } from '@/lib/api';
import { formatTimestamp } from '@/lib/format';
import { useGenerateReport, useReports } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { GuardedLink } from '@/lib/unsaved-changes';

export function ReportsView() {
  const { session } = useSession();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const reports = useReports(page);
  const generate = useGenerateReport();
  const keyRef = useRef<string>(crypto.randomUUID());
  const [notice, setNotice] = useState<{ title: string; detail?: string; reportId?: string } | null>(null);

  const onGenerate = () => {
    setNotice(null);
    generate.mutate(keyRef.current, {
      onSuccess: (res) => {
        keyRef.current = crypto.randomUUID();
        toast.success('Report queued.');
        router.push(`/reports/${res.data.id}`);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.outcomeUnknown) {
          setNotice({
            title: "We couldn't confirm the request.",
            detail: `Select Generate report again; the retry will not create a second report.${err.requestId ? ` Request ID ${err.requestId}.` : ''}`,
          });
          return;
        }
        keyRef.current = crypto.randomUUID();
        if (err instanceof ApiError && err.code === 'REPORT_IN_PROGRESS') {
          setNotice({ title: 'A report is already being generated.', reportId: err.body?.currentReportId ?? undefined });
        } else if (err instanceof ApiError && err.code === 'AI_NOT_CONFIGURED') {
          setNotice({ title: "AI reports aren't configured on this server yet.", detail: 'Employee records still work normally. See Integrations for the worker status.' });
        } else if (err instanceof ApiError && err.code === 'REPORT_QUOTA_EXCEEDED') {
          setNotice({ title: 'The hourly limit of 10 manual reports was reached.', detail: 'Try again later.' });
        } else {
          setNotice(describeError(err));
        }
      },
    });
  };

  const rows = reports.data?.data;
  const meta = reports.data?.meta;

  return (
    <>
      <PageHeader
        title="Reports"
        meta="Workforce Snapshot: headcount by status and department, summarised in Thai by AI. Salaries and names are never sent."
        actions={
          session.permissions.canGenerateReports ? (
            <Button onClick={onGenerate} disabled={generate.isPending}>
              <FilePlus2 aria-hidden />
              {generate.isPending ? 'Queuing…' : 'Generate report'}
            </Button>
          ) : null
        }
      />

      {notice ? (
        <Notice
          tone="warning"
          title={notice.title}
          className="mb-5"
          action={
            notice.reportId ? (
              <GuardedLink href={`/reports/${notice.reportId}`} className="font-medium text-ledger underline underline-offset-4">
                Open the current report
              </GuardedLink>
            ) : undefined
          }
        >
          {notice.detail}
        </Notice>
      ) : null}

      {reports.isError && !rows ? (
        <Notice tone="error" title={describeError(reports.error).title} action={<Button variant="secondary" size="sm" onClick={() => void reports.refetch()}>Try again</Button>} />
      ) : rows && rows.length === 0 ? (
        <div className="rounded-[var(--radius-sheet)] border border-dashed border-rule-strong bg-sheet px-6 py-12 text-center">
          <p className="type-wide text-lg font-semibold">No reports yet.</p>
          <p className="mt-1 text-ink-2">
            {session.permissions.canGenerateReports ? 'Generate the first Workforce Snapshot to see it here.' : 'Reports appear here once an admin generates one.'}
          </p>
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-[var(--radius-sheet)] border border-rule bg-sheet">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <caption className="sr-only">Reports, newest first</caption>
            <thead>
              <tr className="border-b border-rule-strong">
                {['Snapshot taken', 'Status', 'Source', 'Employees', 'Completed'].map((h) => (
                  <th key={h} scope="col" className="type-condensed px-4 py-2.5 text-[0.875rem] font-semibold text-ink-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="greenbar">
              {rows === undefined
                ? Array.from({ length: 3 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }, (__, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-28" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((r) => (
                    <tr key={r.id}>
                      <td className="figures px-4 py-2.5">
                        <GuardedLink href={`/reports/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                          {formatTimestamp(r.snapshotCapturedAt)}
                        </GuardedLink>
                      </td>
                      <td className="px-4 py-2.5">
                        <ReportStatusBadge status={r.status as never} />
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{r.source === 'SCHEDULED' ? 'Daily schedule' : 'Manual'}</td>
                      <td className="figures px-4 py-2.5">{r.totalEmployees}</td>
                      <td className="figures px-4 py-2.5 text-ink-2">{formatTimestamp(r.completedAt)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
      {meta && meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Newer
          </Button>
          <span className="figures text-sm text-ink-2">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            Older
          </Button>
        </div>
      ) : null}
      <p className="mt-6 text-sm text-ink-3">Times are shown in Asia/Bangkok.</p>
    </>
  );
}
