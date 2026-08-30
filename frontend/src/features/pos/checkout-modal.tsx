'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SelectControl } from '@/components/ui/select-control';
import { checkoutPaymentSchema } from './pos.schemas';
import type { PaymentMethod, PosCartLine } from './pos.types';

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  GCASH: 'GCash',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other manual payment',
};

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

export interface CheckoutPayment {
  method: PaymentMethod;
  referenceNumber?: string;
}

export function CheckoutModal({
  lines,
  total,
  branchName,
  isSaving,
  requestError,
  onClose,
  onSubmit,
}: {
  lines: PosCartLine[];
  total: number;
  branchName: string;
  isSaving: boolean;
  requestError: string | null;
  onClose(): void;
  onSubmit(payment: CheckoutPayment): Promise<void>;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [referenceError, setReferenceError] = useState<string | null>(null);

  useEffect(() => headingRef.current?.focus(), []);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = checkoutPaymentSchema.safeParse({
      method,
      referenceNumber: data.get('referenceNumber'),
    });
    if (!parsed.success) {
      setReferenceError(
        parsed.error.issues.find((issue) => issue.path[0] === 'referenceNumber')
          ?.message ?? 'Review the payment details.',
      );
      return;
    }
    setReferenceError(null);
    await onSubmit({
      method: parsed.data.method,
      referenceNumber: parsed.data.referenceNumber || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
          Complete sale
        </p>
        <h2
          className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950"
          id="checkout-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Confirm payment
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {lines.reduce((sum, line) => sum + line.quantity, 0)} items at{' '}
          {branchName}. Inventory is deducted only after the backend accepts the
          sale.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-slate-600">Amount due</span>
            <strong className="text-xl text-slate-950">
              {money.format(total)}
            </strong>
          </div>
        </div>

        <form
          className="mt-6 grid gap-5"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="grid gap-2">
            <label
              className="text-sm font-bold text-slate-700"
              htmlFor="method"
            >
              Payment method
            </label>
            <SelectControl
              id="method"
              value={method}
              disabled={isSaving}
              onValueChange={(value) => {
                setMethod(value as PaymentMethod);
                setReferenceError(null);
              }}
            >
              {Object.entries(paymentLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectControl>
          </div>

          {method !== 'CASH' ? (
            <div className="grid gap-2">
              <label
                className="text-sm font-bold text-slate-700"
                htmlFor="referenceNumber"
              >
                Payment reference
              </label>
              <input
                className="min-h-12 rounded-[0.6rem] border border-slate-200 bg-white px-3.5 outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                id="referenceNumber"
                name="referenceNumber"
                maxLength={120}
                placeholder="Transaction or transfer reference"
                aria-invalid={Boolean(referenceError)}
                aria-describedby={
                  referenceError ? 'reference-error' : undefined
                }
              />
              {referenceError ? (
                <p className="text-sm text-red-600" id="reference-error">
                  {referenceError}
                </p>
              ) : null}
            </div>
          ) : (
            <input name="referenceNumber" type="hidden" value="" />
          )}

          {requestError ? (
            <p
              className="rounded-lg border border-red-600 p-3 text-sm text-red-600"
              role="alert"
            >
              {requestError}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              className="min-h-11 rounded-[0.6rem] border border-slate-200 bg-white px-4 font-bold text-slate-700"
              type="button"
              disabled={isSaving}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-5 font-bold text-white disabled:cursor-wait disabled:opacity-65"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Completing sale…' : `Confirm ${money.format(total)}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
