import { CircleAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

const tones = {
  warning: { box: 'border-amber/40 bg-amber-wash', icon: 'text-amber', Icon: TriangleAlert },
  error: { box: 'border-stamp/35 bg-stamp-wash', icon: 'text-stamp', Icon: CircleAlert },
} as const;

/**
 * Icon + title + optional detail and action. `bare` drops the box for use inside a panel
 * that already has its own border (no cards inside cards).
 */
export function Notice({
  tone,
  title,
  children,
  action,
  className,
  bare,
}: {
  tone: keyof typeof tones;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  const { box, icon, Icon } = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 text-ink', bare ? 'py-1' : cn('rounded-[var(--radius-control)] border p-4', box), className)}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', icon)} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-1 text-sm text-ink-2">{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
