'use client';

import { buttonStyles } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';

export function InventoryMovementReasonDialog({
  reason,
  onClose,
}: {
  reason: string;
  onClose(): void;
}) {
  return (
    <FormDialog
      title="Movement reason"
      description="The reason recorded for this stock movement."
      onClose={onClose}
    >
      <div className="mt-6 rounded-control bg-subtle px-4 py-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">
          {reason}
        </p>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          className={buttonStyles({ variant: 'secondary' })}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </FormDialog>
  );
}
