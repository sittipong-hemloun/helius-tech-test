import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './ui/cn';

const tones = {
  info: { box: 'border-rule bg-sheet text-ink', Icon: Info },
  warning: { box: 'border-amber/40 bg-amber-wash text-ink', Icon: TriangleAlert },
  error: { box: 'border-stamp/40 bg-stamp-wash text-ink', Icon: CircleAlert },
} as const;

export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof tones;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-[var(--radius-control)] border p-4', box, className)}>
      <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', tone === 'error' ? 'text-stamp' : tone === 'warning' ? 'text-amber' : 'text-ledger')} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children ? <div className="mt-1 text-sm text-ink-2">{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
