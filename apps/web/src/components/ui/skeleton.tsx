import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse rounded bg-bar-strong/70', className)} />;
}
