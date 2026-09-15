'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { buttonStyles } from '@/shared/components/ui/button';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { updateInventoryThreshold } from '../api/inventory-api';
import { thresholdInputSchema } from '../model/inventory.schemas';
import type {
  BranchInventory,
  InventoryDetailScope,
} from '../model/inventory.types';

export function InventoryThresholdForm({
  scope,
  inventory,
  onSaved,
  onPendingChange,
  onAccessLost,
}: {
  scope: InventoryDetailScope;
  inventory: BranchInventory;
  onSaved(): void;
  onPendingChange(pending: boolean): void;
  onAccessLost?(): void;
}) {
  const { request } = useAuth();
  const [threshold, setThreshold] = useState(
    String(inventory.lowStockThreshold),
  );
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function validate(value: string, immediate = false) {
    window.clearTimeout(timer.current);
    const run = () => {
      const result = thresholdInputSchema.safeParse({
        lowStockThreshold: value,
      });
      setFieldError(
        result.success ? undefined : result.error.issues[0]?.message,
      );
    };
    if (immediate) run();
    else timer.current = window.setTimeout(run, 300);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    window.clearTimeout(timer.current);
    const parsed = thresholdInputSchema.safeParse({
      lowStockThreshold: threshold,
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      focusFirstInvalidField(event.currentTarget);
      return;
    }
    setPending(true);
    onPendingChange(true);
    setError(null);
    setFieldError(undefined);
    try {
      await updateInventoryThreshold(
        request,
        scope,
        parsed.data.lowStockThreshold,
      );
      onSaved();
    } catch (cause) {
      if (cause instanceof ApiError && [403, 404].includes(cause.status))
        onAccessLost?.();
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'The low-stock threshold could not be saved. Please try again.',
      );
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  }
  return (
    <form className="grid gap-4 p-6" noValidate onSubmit={submit}>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <TextField
        label="Low-stock threshold"
        name="lowStockThreshold"
        required
        inputMode="numeric"
        value={threshold}
        disabled={pending}
        error={fieldError}
        onChange={(event) => {
          setThreshold(event.target.value);
          validate(event.target.value);
        }}
        onBlur={() => validate(threshold, true)}
        hint="Warn at or below this stock level. Use 0 to disable low-stock warnings."
      />
      <button
        className={buttonStyles({ variant: 'primary', className: 'w-fit' })}
        type="submit"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? 'Saving…' : 'Save threshold'}
      </button>
    </form>
  );
}
