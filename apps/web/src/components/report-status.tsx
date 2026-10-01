import type { ReportStatus } from '@employee-console/api-client';
import { CircleCheck, CircleDashed, CircleX, Loader2 } from 'lucide-react';
import { cn } from './ui/cn';

const STATUS: Record<ReportStatus, { label: string; className: string; Icon: typeof CircleCheck }> = {
  QUEUED: { label: 'Queued', className: 'border-rule-strong text-ink-2', Icon: CircleDashed },
  RUNNING: { label: 'Running', className: 'border-amber/40 bg-amber-wash text-amber', Icon: Loader2 },
  SUCCEEDED: { label: 'Ready', className: 'border-ledger/30 bg-ledger-wash text-ledger-deep', Icon: CircleCheck },
  FAILED: { label: 'Failed', className: 'border-stamp/40 bg-stamp-wash text-stamp', Icon: CircleX },
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const { label, className, Icon } = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.8125rem] font-medium', className)}>
      <Icon aria-hidden className={cn('size-3.5', status === 'RUNNING' && 'animate-spin')} />
      {label}
    </span>
  );
}

/** Plain-language failure reasons; provider messages are never shown (PRD §12.5). */
export const REPORT_ERRORS: Record<string, string> = {
  PROVIDER_TIMEOUT: 'The AI provider did not answer in time.',
  PROVIDER_RATE_LIMIT: 'The AI provider rate limit was reached.',
  PROVIDER_UNAVAILABLE: 'The AI provider was unavailable.',
  INVALID_MODEL_OUTPUT: 'The AI answer did not match the required format.',
  PROVIDER_AUTH_ERROR: 'The AI provider rejected the credentials configured in n8n.',
  MODEL_UNAVAILABLE: 'The configured AI model is not available to this account.',
  INVALID_SNAPSHOT: 'The snapshot was rejected as invalid.',
  CONTENT_REJECTED: 'The AI provider declined to answer.',
  REPORT_DEADLINE_EXCEEDED: 'No worker finished the report within 10 minutes.',
  WORKER_LEASE_EXPIRED: 'The report worker stopped responding.',
};
