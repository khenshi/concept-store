'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { buttonStyles } from '@/shared/components/ui/button';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { updateInventoryPrice } from '../api/inventory-api';
import { priceInputSchema } from '../model/inventory.schemas';
import type {
  BranchInventory,
  InventoryDetailScope,
} from '../model/inventory.types';

export function InventoryPriceForm({
  scope,
  inventory,
  onSaved,
  onPendingChange,
  onAccessLost,
  onCancel,
}: {
  scope: InventoryDetailScope;
  inventory: BranchInventory;
  onSaved(): void;
  onPendingChange(pending: boolean): void;
  onAccessLost?(): void;
  onCancel?(): void;
}) {
  const { request } = useAuth();
  const [price, setPrice] = useState(inventory.sellingPrice);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const parsedInput = priceInputSchema.safeParse({ sellingPrice: price });
  const canSave =
    parsedInput.success &&
    Number(parsedInput.data.sellingPrice) !== Number(inventory.sellingPrice);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function validate(value: string, immediate = false) {
    window.clearTimeout(timer.current);
    const run = () => {
      const result = priceInputSchema.safeParse({ sellingPrice: value });
      setFieldError(
        result.success ? undefined : result.error.issues[0]?.message,
      );
    };
    if (immediate) run();
    else timer.current = window.setTimeout(run, 300);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canSave) return;
    window.clearTimeout(timer.current);
    const parsed = priceInputSchema.safeParse({ sellingPrice: price });
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
      await updateInventoryPrice(request, scope, parsed.data.sellingPrice);
      onSaved();
    } catch (cause) {
      if (cause instanceof ApiError && [403, 404].includes(cause.status))
        onAccessLost?.();
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'The branch price could not be saved. Please try again.',
      );
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  }
  return (
    <form className="grid gap-4 p-6" noValidate onSubmit={submit}>
      <TextField
        label="Selling price (PHP)"
        name="sellingPrice"
        placeholder="e.g. 299.00"
        required
        inputMode="decimal"
        value={price}
        disabled={pending}
        error={fieldError}
        onChange={(event) => {
          const value = event.target.value;
          if (!/^(?:\d{1,10}(?:\.\d{0,2})?)?$/.test(value)) return;
          setPrice(value);
          validate(value);
        }}
        onBlur={() => validate(price, true)}
        hint="This changes only this branch’s price, not stock or other branches."
      />
      <ModalActionRow
        feedback={
          error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null
        }
      >
        {onCancel ? (
          <button
            className={buttonStyles({ variant: 'quiet' })}
            type="button"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
        <button
          className={buttonStyles({ variant: 'primary' })}
          type="submit"
          disabled={pending || !canSave}
          aria-busy={pending}
        >
          {pending ? 'Saving…' : 'Save branch price'}
        </button>
      </ModalActionRow>
    </form>
  );
}
