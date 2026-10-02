import { cn } from './ui/cn';

/** Status as plain text plus a mark: solid dot for Active, hollow ring for In Active. Never colour alone. */
export function StatusBadge({ isActive, className }: { isActive: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', isActive ? 'text-ledger-deep' : 'text-ink-2', className)}>
      <span
        aria-hidden
        className={cn('size-2 shrink-0 rounded-full', isActive ? 'bg-cman-emerald' : 'border-[1.5px] border-ink-3 bg-transparent')}
      />
      {isActive ? 'Active' : 'In Active'}
    </span>
  );
}
