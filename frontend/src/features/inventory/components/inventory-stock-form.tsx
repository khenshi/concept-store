'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { buttonStyles } from '@/shared/components/ui/button';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import {
  adjustmentInputSchema,
  receiptInputSchema,
} from '../model/inventory.schemas';
import { adjustStock, receiveStock } from '../api/inventory-api';
import type {
  BranchInventory,
  InventoryDetailScope,
} from '../model/inventory.types';

export function InventoryStockForm({
  scope,
  inventory,
  mode,
  onSaved,
  onPendingChange,
  onAccessLost,
}: {
  scope: InventoryDetailScope;
  inventory: BranchInventory;
  mode: 'receipt' | 'adjustment';
  onSaved(): void;
  onPendingChange(pending: boolean): void;
  onAccessLost?(): void;
}) {
  const { request } = useAuth();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<
    Partial<Record<'quantity' | 'reason', string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const command = useRef<{ fingerprint: string; requestId: string } | null>(
    null,
  );
  const timers = useRef<Partial<Record<'quantity' | 'reason', number>>>({});
  useEffect(
    () => () => {
      Object.values(timers.current).forEach(window.clearTimeout);
    },
    [],
  );
  const parse = (amount: string, why: string) =>
    mode === 'receipt'
      ? receiptInputSchema.safeParse({ quantity: amount, reason: why })
      : adjustmentInputSchema.safeParse({
          quantityChange: amount,
          reason: why,
        });
  function validate(
    field: 'quantity' | 'reason',
    amount: string,
    why: string,
    immediate = false,
  ) {
    window.clearTimeout(timers.current[field]);
    const run = () => {
      const result = parse(amount, why);
      const key =
        field === 'quantity' && mode === 'adjustment'
          ? 'quantityChange'
          : field;
      setErrors((current) => ({
        ...current,
        [field]: result.success
          ? undefined
          : result.error.issues.find((issue) => issue.path[0] === key)?.message,
      }));
    };
    if (immediate) run();
    else timers.current[field] = window.setTimeout(run, 300);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    Object.values(timers.current).forEach(window.clearTimeout);
    const receipt = receiptInputSchema.safeParse({ quantity, reason });
    const adjustment = adjustmentInputSchema.safeParse({
      quantityChange: quantity,
      reason,
    });
    const parsed = mode === 'receipt' ? receipt : adjustment;
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path[0] === 'quantityChange' ? 'quantity' : issue.path[0],
            issue.message,
          ]),
        ),
      );
      focusFirstInvalidField(event.currentTarget);
      return;
    }
    const delta =
      mode === 'receipt' && receipt.success
        ? receipt.data.quantity
        : adjustment.success
          ? adjustment.data.quantityChange
          : 0;
    const normalizedReason = parsed.data.reason;
    const estimated = inventory.quantity + delta;
    // Do not reject based on a possibly stale estimate. The backend owns balance checks.
    lock.current = true;
    setPending(true);
    onPendingChange(true);
    setError(null);
    setErrors({});
    try {
      if (
        mode === 'adjustment' &&
        !(await confirm({
          title: `Adjust stock by ${delta > 0 ? '+' : ''}${delta.toLocaleString()} units?`,
          description: `Current displayed stock: ${inventory.quantity.toLocaleString()}. Estimated result: ${estimated.toLocaleString()} units. Reason: ${normalizedReason}. The server checks current stock and rejects negative or overflowing balances. This affects only this branch.`,
          confirmLabel: 'Apply adjustment',
          tone: delta < 0 ? 'danger' : 'primary',
        }))
      )
        return;
      const fingerprint = JSON.stringify([mode, delta, normalizedReason]);
      if (command.current?.fingerprint !== fingerprint)
        command.current = { fingerprint, requestId: crypto.randomUUID() };
      const requestId = command.current.requestId;
      if (mode === 'receipt')
        await receiveStock(request, scope, {
          quantity: delta,
          reason: normalizedReason,
          requestId,
        });
      else
        await adjustStock(request, scope, {
          quantityChange: delta,
          reason: normalizedReason,
          requestId,
        });
      command.current = null;
      setQuantity('');
      setReason('');
      onSaved();
    } catch (cause) {
      if (cause instanceof ApiError && [403, 404].includes(cause.status))
        onAccessLost?.();
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'The stock command could not be confirmed.',
      );
    } finally {
      lock.current = false;
      setPending(false);
      onPendingChange(false);
    }
  }
  const active =
    inventory.product.status === 'ACTIVE' &&
    inventory.product.merchant.status === 'ACTIVE';
  const unavailable = mode === 'receipt' && !active;
  const reasonSuggestions =
    mode === 'receipt'
      ? ['Supplier delivery', 'Opening stock', 'Counted stock received']
      : ['Stock count correction', 'Damaged stock', 'Data entry correction'];
  const updateReason = (value: string) => {
    command.current = null;
    setReason(value);
    validate('reason', quantity, value);
  };
  return (
    <>
      <form className="grid gap-4 p-6" noValidate onSubmit={submit}>
        {unavailable ? (
          <p className="text-sm text-muted">
            Receiving requires an active product and merchant. Corrective
            adjustments remain available.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error} Retry unchanged to reuse the request ID; changing the form
            starts a new command.
          </p>
        ) : null}
        <TextField
          label={mode === 'receipt' ? 'Units to receive' : 'Quantity change'}
          name="quantity"
          required
          inputMode={mode === 'receipt' ? 'numeric' : 'text'}
          value={quantity}
          error={errors.quantity}
          disabled={pending || unavailable}
          onChange={(event) => {
            const value = event.target.value;
            command.current = null;
            setQuantity(value);
            validate('quantity', value, reason);
          }}
          onBlur={() => validate('quantity', quantity, reason, true)}
          hint={
            mode === 'receipt'
              ? 'Positive whole units. This does not deduct stock from another branch.'
              : 'A signed whole-unit delta, for example +5 or -2; never a replacement total.'
          }
        />
        <fieldset className="grid min-w-0 gap-2 border-0 p-0">
          <legend className="text-label font-semibold text-ink">
            Common reasons
          </legend>
          <div className="flex flex-wrap gap-2">
            {reasonSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className={buttonStyles({
                  variant: reason === suggestion ? 'primary' : 'secondary',
                  className: 'min-h-9 px-3 py-1.5 text-xs',
                })}
                disabled={pending || unavailable}
                aria-pressed={reason === suggestion}
                onClick={() => updateReason(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted">
            Choose a common reason or enter a specific reason below. It is kept
            in the immutable stock history.
          </p>
        </fieldset>
        <TextField
          label="Reason"
          name="reason"
          value={reason}
          maxLength={500}
          error={errors.reason}
          disabled={pending || unavailable}
          onChange={(event) => {
            updateReason(event.target.value);
          }}
          onBlur={() => validate('reason', quantity, reason, true)}
          required
        />
        <button
          type="submit"
          className={buttonStyles({ variant: 'primary', className: 'w-fit' })}
          disabled={pending || unavailable}
          aria-busy={pending}
        >
          {pending
            ? 'Processing…'
            : mode === 'receipt'
              ? 'Receive stock'
              : 'Review adjustment'}
        </button>
      </form>
      {confirmationDialog}
    </>
  );
}
