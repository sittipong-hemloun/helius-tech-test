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
 * A printed-form cell: the label sits inside the box, the control fills it, and errors
 * appear underneath with an icon and text (never colour alone — PRD §8.1).
 */
export function FormCell({ id, label, hint, error, children, className, readOnly }: FormCellProps) {
  return (
    <div className={className}>
      <div className={cn('form-cell px-3 pt-2 pb-1.5', readOnly && 'bg-ground')} data-invalid={error ? 'true' : undefined}>
        <label htmlFor={id} className="block text-[0.78rem] font-medium text-ink-2">
          {label}
        </label>
        {children}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-stamp" role="alert">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const cellInputClass =
  'block w-full bg-transparent pb-0.5 pt-0.5 text-base text-ink outline-none placeholder:text-ink-3 disabled:text-ink-2';
