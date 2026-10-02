import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from './cn';

interface FormCellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  readOnly?: boolean;
}

/**
 * One cell of a joined `.form-grid`, like a box on a printed personnel form: label at the top,
 * control below, and hint or error inside the same box. Errors carry an icon and text (never colour alone).
 */
export function FormCell({ id, label, hint, error, children, className, readOnly }: FormCellProps) {
  return (
    <div className={cn('form-cell px-3 pb-2 pt-1.5', className)} data-invalid={error ? 'true' : undefined} data-readonly={readOnly ? 'true' : undefined}>
      <label htmlFor={id} className="block text-[0.75rem] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-0.5 flex items-start gap-1.5 text-[0.8125rem] font-medium text-stamp" role="alert">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-0.5 text-[0.75rem] text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const cellInputClass =
  'block w-full bg-transparent py-0.5 text-[0.9375rem] text-ink outline-none placeholder:text-ink-3 disabled:text-ink-2';
