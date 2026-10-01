import { cn } from './ui/cn';

/** Status shown as text plus a filled/hollow mark, so it never relies on colour alone. */
export function StatusBadge({ isActive, className }: { isActive: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.8125rem] font-medium leading-5',
        isActive ? 'border-ledger/30 bg-ledger-wash text-ledger-deep' : 'border-dashed border-ink-3 bg-sheet text-ink-2',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('size-2 rounded-full', isActive ? 'bg-ledger' : 'border border-ink-3 bg-transparent')}
      />
      {isActive ? 'Active' : 'In Active'}
    </span>
  );
}
