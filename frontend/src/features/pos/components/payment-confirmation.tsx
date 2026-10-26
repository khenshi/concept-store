'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import { Button } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { TextField } from '@/shared/components/ui/text-field';
import { completeCheckout } from '../api/checkout-api';
import {
  changeEstimate,
  checkoutContent,
  paymentError,
  type CheckoutCommand,
  type CompletedSale,
  type PaymentDraft,
} from '../model/checkout';
import { useBranchPaymentAccounts } from '../model/use-branch-payment-accounts';
import { SelectControl } from '@/shared/components/ui/select-control';
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
const cashTenderInputPattern = /^(?:|\d{1,22}(?:\.\d{0,2})?)$/;
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
  const {
    accounts,
    error: accountsError,
    refresh: refreshAccounts,
  } = useBranchPaymentAccounts(
    request,
    scope.organizationId,
    scope.branchId,
    'SALE',
    false,
    open,
  );
  const initializedAccount = useRef(accounts !== null);
  const [initialAttempt] = useState(() => getCheckoutAttempt(attemptKey));
  const saved = initialAttempt?.command;
  const [draft, setDraft] = useState<PaymentDraft>({
    account: accounts?.find((account) => account.systemKey === 'CASH') ?? null,
    tender: saved?.cashTender ?? '',
    reference: saved?.paymentReference ?? '',
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
  const availableAccount = accounts?.find(
    (account) => account.id === draft.account?.id,
  );
  const currentDraft = { ...draft, account: availableAccount ?? null };
  useEffect(() => {
    if (uncertain.current || busy.current || accounts === null) return;
    if (!initializedAccount.current) {
      initializedAccount.current = true;
      void Promise.resolve().then(() =>
        setDraft((current) => ({
          ...current,
          account:
            accounts.find((account) => account.systemKey === 'CASH') ?? null,
        })),
      );
      return;
    }
    if (
      draft.account &&
      !accounts.some((account) => account.id === draft.account?.id)
    ) {
      void Promise.resolve().then(() =>
        setDraft((current) => ({
          ...current,
          account: null,
          tender: '',
          reference: '',
        })),
      );
    }
  }, [accounts, draft.account]);
  const total = posCartTotal(lines);
  const estimatedChange = changeEstimate(currentDraft, total);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);
  function edit(next: PaymentDraft, immediate = false, shouldValidate = true) {
    if (busy.current || uncertain.current) return;
    setDraft(next);
    setMessage(undefined);
    // A known rejected command may be replaced only when its content changes.
    window.clearTimeout(timer.current);
    if (!shouldValidate) return;
    const validate = () =>
      setFieldError(
        paymentError(
          {
            ...next,
            account:
              accounts?.find((account) => account.id === next.account?.id) ??
              null,
          },
          total,
        ),
      );
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
        const content = checkoutContent(lines, currentDraft);
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
        setFieldError(paymentError(currentDraft, total));
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
          'PAYMENT_ACCOUNT_UNAVAILABLE',
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
        if (code === 'PAYMENT_ACCOUNT_UNAVAILABLE') refreshAccounts();
        if (!mounted.current) return;
        onUnsafeChange(false);
        setMessage(
          code === 'CHECKOUT_RETRY'
            ? 'Checkout rolled back due to a concurrent change. Retry this unchanged command, or return to review.'
            : api?.message,
        );
        if (code && code !== 'CHECKOUT_RETRY') {
          onIssue({ message: api!.message, ...api!.details });
          onClose();
        } else if (api && [401, 403, 404].includes(api.status)) {
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
  const paymentValidationError = paymentError(currentDraft, total);
  function close() {
    if (busy.current || uncertain.current) return;
    onClose();
  }
  if (!open) return null;
  return (
    <FormDialog
      title="Confirm payment"
      description="Review the branch cart and payment details. Completion records one sale and deducts stock atomically."
      pending={locked}
      onClose={close}
    >
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0" aria-label="Reviewed cart">
          <h3 className="font-semibold">Reviewed cart</h3>
          <ul className="mt-3 max-h-64 overflow-y-auto overscroll-contain divide-y divide-hairline pr-2">
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
          <div className="grid gap-2">
            <label
              htmlFor="checkout-payment-account"
              className="text-sm font-semibold"
            >
              Payment account
            </label>
            <SelectControl
              id="checkout-payment-account"
              value={availableAccount?.id ?? ''}
              disabled={locked || accounts === null}
              onValueChange={(id) => {
                setFieldError(undefined);
                edit(
                  {
                    account:
                      accounts?.find((account) => account.id === id) ?? null,
                    tender: '',
                    reference: '',
                  },
                  false,
                  false,
                );
              }}
            >
              <option value="">
                {accounts === null
                  ? 'Loading payment accounts…'
                  : 'Choose payment account'}
              </option>
              {(accounts ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectControl>
            {locked && saved ? (
              <p className="text-xs text-muted">
                Locked account:{' '}
                {draft.account?.id === saved.paymentAccountId
                  ? (draft.account.name ?? 'Previously selected account')
                  : 'Previously selected account'}
              </p>
            ) : null}
            {accountsError ? (
              <div role="alert">
                <p>{accountsError}</p>
                <Button variant="quiet" onClick={refreshAccounts}>
                  Retry accounts
                </Button>
              </div>
            ) : null}
          </div>
          {availableAccount?.systemKey === 'CASH' ? (
            <>
              <TextField
                label="Cash tender (PHP)"
                inputMode="decimal"
                icon="money"
                maxLength={25}
                placeholder="e.g. 500.00"
                value={draft.tender}
                disabled={locked || !availableAccount}
                error={fieldError}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!cashTenderInputPattern.test(value)) return;
                  edit({ ...draft, tender: value });
                }}
                onBlur={() => edit(draft, true)}
                hint="Must cover the total. Change is shown below."
              />
              <p className="text-sm tabular-nums">
                Estimated change:{' '}
                {estimatedChange === null ? '—' : `PHP ${estimatedChange}`}
              </p>
            </>
          ) : (
            <>
              <TextField
                label="Account reference"
                icon="pencil"
                maxLength={100}
                placeholder="e.g. GCASH-20261020-001"
                value={draft.reference}
                disabled={locked}
                error={fieldError}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value.length > 100) return;
                  edit({ ...draft, reference: value });
                }}
                onBlur={() => edit(draft, true)}
                hint={
                  availableAccount?.requiresReference
                    ? 'Required: use 2–100 characters.'
                    : 'Optional: use 2–100 characters if supplied.'
                }
              />
            </>
          )}
          {message ? (
            <p role="alert" className="break-words text-sm text-danger">
              {message}
            </p>
          ) : null}
          <ModalActionRow>
            <Button variant="quiet" disabled={locked} onClick={close}>
              Return to cart
            </Button>
            <Button
              type="submit"
              pending={requestPending}
              disabled={
                requestPending || (!unknown && Boolean(paymentValidationError))
              }
              pendingLabel="Completing checkout…"
            >
              {unknown ? 'Retry same checkout' : 'Complete sale'}
            </Button>
          </ModalActionRow>
        </form>
      </div>
    </FormDialog>
  );
}
