'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import { Button } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { TextField } from '@/shared/components/ui/text-field';
import { completeCheckout } from '../api/checkout-api';
import {
  changeEstimate,
  checkoutContent,
  paymentError,
  type CheckoutCommand,
  type CompletedSale,
  type PaymentDraft,
  type PaymentMethod,
} from '../model/checkout';
import { posCartTotal } from '../model/pos-cart';
import type { PosCartLine, PosScope } from '../model/pos.types';
import {
  getCheckoutAttempt,
  setCheckoutAttempt,
  useCheckoutAttempt,
} from '../model/checkout-attempt';

export type CheckoutIssue = {
  message: string;
  code?: string;
  branchInventoryId?: string;
  sellingPrice?: string;
  quantity?: number;
};
export function PaymentConfirmation({
  open,
  attemptKey,
  request,
  scope,
  lines,
  onClose,
  onCompleted,
  onIssue,
  onUnsafeChange,
}: {
  open: boolean;
  attemptKey: string;
  request: AuthenticatedRequest;
  scope: PosScope;
  lines: PosCartLine[];
  onClose(): void;
  onCompleted(sale: CompletedSale): void;
  onIssue(issue: CheckoutIssue): void;
  onUnsafeChange(unsafe: boolean): void;
}) {
  const [initialAttempt] = useState(() => getCheckoutAttempt(attemptKey));
  const saved = initialAttempt?.command;
  const [draft, setDraft] = useState<PaymentDraft>({
    method: saved?.paymentMethod ?? 'CASH',
    tender: saved && 'cashTender' in saved ? saved.cashTender : '',
    reference:
      saved && 'paymentReference' in saved ? saved.paymentReference : '',
    received: Boolean(saved),
  });
  const [fieldError, setFieldError] = useState<string>();
  const [message, setMessage] = useState<string | undefined>(
    saved
      ? 'Recovering an unresolved checkout. Retry only this exact command; do not collect payment again or create another sale.'
      : undefined,
  );
  const retained = useCheckoutAttempt(attemptKey);
  const [pending, setPending] = useState(false);
  const [unknown, setUnknown] = useState(Boolean(initialAttempt));
  const busy = useRef(false);
  const uncertain = useRef(Boolean(initialAttempt));
  const command = useRef<CheckoutCommand | null>(
    initialAttempt?.command ?? null,
  );
  const mounted = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const total = posCartTotal(lines);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);
  function edit(next: PaymentDraft, immediate = false) {
    if (busy.current || uncertain.current) return;
    setDraft(next);
    setMessage(undefined);
    // A known rejected command may be replaced only when its content changes.
    window.clearTimeout(timer.current);
    const validate = () => setFieldError(paymentError(next, total));
    if (immediate) validate();
    else timer.current = window.setTimeout(validate, 300);
  }
  async function submit() {
    if (busy.current || getCheckoutAttempt(attemptKey)?.state === 'pending')
      return;
    window.clearTimeout(timer.current);
    let attempt = command.current;
    if (!uncertain.current) {
      try {
        const content = checkoutContent(lines, draft);
        const previous = attempt
          ? JSON.stringify(
              Object.fromEntries(
                Object.entries(attempt).filter(([key]) => key !== 'requestId'),
              ),
            )
          : null;
        if (JSON.stringify(content) !== previous)
          attempt = { ...content, requestId: crypto.randomUUID() };
        command.current = attempt;
      } catch (cause) {
        setFieldError(paymentError(draft, total));
        setMessage(
          cause instanceof Error ? cause.message : 'Review payment details.',
        );
        return;
      }
    }
    if (!attempt) return;
    busy.current = true;
    setPending(true);
    setMessage(undefined);
    onUnsafeChange(true);
    setCheckoutAttempt(attemptKey, {
      scope,
      lines,
      command: attempt,
      state: 'pending',
    });
    try {
      const sale = await completeCheckout(request, scope, attempt);
      if (!mounted.current) {
        setCheckoutAttempt(attemptKey, {
          scope,
          lines,
          command: attempt,
          state: 'completed',
          sale,
        });
        return;
      }
      setCheckoutAttempt(attemptKey, null);
      uncertain.current = false;
      onUnsafeChange(false);
      onCompleted(sale);
    } catch (cause) {
      const api = cause instanceof ApiError ? cause : null;
      const code = api?.details?.code;
      const knownConflict =
        api?.status === 409 &&
        [
          'PRICE_CHANGED',
          'INSUFFICIENT_STOCK',
          'PRODUCT_UNAVAILABLE',
          'CHECKOUT_RETRY',
        ].includes(code ?? '');
      const knownRejected =
        !uncertain.current &&
        (knownConflict ||
          (api && [400, 401, 403, 404, 429].includes(api.status)));
      if (!knownRejected) {
        setCheckoutAttempt(attemptKey, {
          scope,
          lines,
          command: attempt,
          state: 'unknown',
        });
        uncertain.current = true;
        if (!mounted.current) return;
        setUnknown(true);
        setMessage(
          'Completion is not confirmed. This exact command is locked. Retry the same checkout to retrieve its outcome; do not collect payment again or create another sale.',
        );
      } else {
        setCheckoutAttempt(attemptKey, null);
        if (!mounted.current) return;
        onUnsafeChange(false);
        setMessage(
          code === 'CHECKOUT_RETRY'
            ? 'Checkout rolled back due to a concurrent change. Retry this unchanged command, or return to review.'
            : api?.message,
        );
        if (code && code !== 'CHECKOUT_RETRY') {
          setDraft((current) => ({ ...current, received: false }));
          onIssue({ message: api!.message, ...api!.details });
          onClose();
        } else if (api && [401, 403, 404].includes(api.status)) {
          setDraft((current) => ({ ...current, received: false }));
          onIssue({ message: api.message, code: 'ACCESS_DENIED' });
          onClose();
        }
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  const requestPending = pending || retained?.state === 'pending';
  const locked = requestPending || unknown;
  function close() {
    if (busy.current || uncertain.current) return;
    setDraft((current) => ({ ...current, received: false }));
    onClose();
  }
  if (!open) return null;
  return (
    <FormDialog
      title="Confirm payment"
      description="Review the branch cart and confirm payment received. Completion records one sale and deducts stock atomically."
      pending={locked}
      onClose={close}
    >
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0" aria-label="Reviewed cart">
          <h3 className="font-semibold">Reviewed cart</h3>
          <ul className="mt-3 divide-y divide-hairline">
            {lines.map((line) => (
              <li
                key={line.product.branchInventoryId}
                className="break-words py-3 text-sm"
              >
                <p className="font-semibold">{line.product.name}</p>
                <p>
                  {line.product.merchantName} · {line.quantity} × PHP{' '}
                  {line.product.sellingPrice}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-semibold tabular-nums">
            Estimated total: PHP {total}
          </p>
          <p className="mt-2 text-xs text-muted">
            The server verifies current prices, eligibility and stock. A changed
            price requires another review.
          </p>
        </section>
        <form
          noValidate
          className="grid min-w-0 content-start gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset disabled={locked} className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold">
              Payment method
            </legend>
            <div className="flex flex-wrap gap-4">
              {(['CASH', 'GCASH', 'CARD'] as PaymentMethod[]).map((method) => (
                <label
                  key={method}
                  className="flex min-h-11 items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={method}
                    checked={draft.method === method}
                    onChange={() => {
                      setFieldError(undefined);
                      edit({
                        method,
                        tender: '',
                        reference: '',
                        received: false,
                      });
                    }}
                  />
                  {method === 'GCASH'
                    ? 'GCash (manual)'
                    : method === 'CARD'
                      ? 'Card (manual)'
                      : 'Cash'}
                </label>
              ))}
            </div>
          </fieldset>
          {draft.method === 'CASH' ? (
            <>
              <TextField
                label="Cash tender (PHP)"
                inputMode="decimal"
                value={draft.tender}
                disabled={locked}
                error={fieldError}
                onChange={(event) =>
                  edit({ ...draft, tender: event.target.value })
                }
                onBlur={() => edit(draft, true)}
                hint="Must cover the estimated total. Change is calculated by the server."
              />
              {changeEstimate(draft, total) !== null ? (
                <p className="text-sm tabular-nums">
                  Estimated change: PHP {changeEstimate(draft, total)}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-warning">
                Manually recorded and unverified. No provider authorization or
                payment processing occurs here.
              </p>
              <TextField
                label="Payment reference"
                value={draft.reference}
                disabled={locked}
                error={fieldError}
                onChange={(event) =>
                  edit({ ...draft, reference: event.target.value })
                }
                onBlur={() => edit(draft, true)}
                hint="2–100 characters. Record the received payment's reference."
              />
            </>
          )}
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={draft.received}
              disabled={locked}
              onChange={(event) =>
                edit({ ...draft, received: event.target.checked })
              }
            />
            <span>
              I confirm this payment was received
              {draft.method !== 'CASH' ? ' outside this system' : ''}.
            </span>
          </label>
          {message ? (
            <p role="alert" className="break-words text-sm text-danger">
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" disabled={locked} onClick={close}>
              Return to cart
            </Button>
            <Button
              type="submit"
              pending={requestPending}
              pendingLabel="Completing checkout…"
            >
              {unknown ? 'Retry same checkout' : 'Complete sale'}
            </Button>
          </div>
        </form>
      </div>
    </FormDialog>
  );
}
