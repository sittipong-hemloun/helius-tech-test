'use client';

import { toast } from 'sonner';
import { ApiError, describeError } from '@/lib/api';
import { useDeleteEmployee } from '@/lib/queries';
import { ConfirmDialog } from '@/components/ui/dialog';

interface Target {
  id: number;
  name: string;
  version: number;
}

/** Hard delete after explicit confirmation (PRD §8.4, D-06). */
export function DeleteEmployeeDialog({ target, onClose, onDeleted }: { target: Target | null; onClose: () => void; onDeleted: () => void }) {
  const del = useDeleteEmployee();
  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Delete employee?"
      confirmLabel="Delete employee"
      tone="danger"
      pending={del.isPending}
      onConfirm={() => {
        if (!target) return;
        del.mutate(
          { id: target.id, version: target.version },
          {
            onSuccess: () => {
              toast.success('Employee deleted.', { description: `${target.name} (ID ${target.id})` });
              onDeleted();
            },
            onError: (err) => {
              if (err instanceof ApiError && err.status === 404) {
                toast.info('This employee was already deleted.');
                onDeleted();
                return;
              }
              if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
                toast.error('This employee was changed by another user. Reload the latest version before deleting.');
                onClose();
                return;
              }
              const { title, detail } = describeError(err);
              toast.error(title, { description: detail });
            },
          },
        );
      }}
    >
      {target ? (
        <p>
          <strong className="font-semibold text-ink">{target.name}</strong> (ID {target.id}) will be removed permanently. This action cannot be undone.
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
