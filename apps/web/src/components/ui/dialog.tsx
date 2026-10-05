'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { Trash2, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}

/** Confirmation for destructive actions (delete, discard): warning icon and a danger confirm button. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  pending,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[var(--radius-sheet)] border border-rule-strong bg-sheet shadow-[0_16px_40px_-12px_rgb(28_28_28/0.4)]">
          <RadixDialog.Title className="flex items-center gap-2 border-b border-rule px-5 py-3 text-[0.9375rem] font-bold">
            <TriangleAlert aria-hidden className="size-4 shrink-0 text-stamp" />
            {title}
          </RadixDialog.Title>
          <RadixDialog.Description asChild>
            <div className="px-5 py-4 text-ink-2">{children}</div>
          </RadixDialog.Description>
          <div className="flex flex-col-reverse gap-2 border-t border-rule bg-head px-5 py-3 sm:flex-row sm:justify-end">
            <RadixDialog.Close asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </RadixDialog.Close>
            <Button variant="danger" onClick={onConfirm} disabled={pending}>
              <Trash2 aria-hidden />
              {pending ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
