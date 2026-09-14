'use client';
import { useEffect, useRef, useState } from 'react';
import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import type { CompletedSale } from '@/features/pos/model/checkout';
import { ApiError } from '@/features/auth/api/auth-client';
import { Button } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { completeRefund, type RefundScope } from '../api/refund-api';
import {
  refundErrors,
  refundEstimate,
  type RefundDraft,
} from '../model/refund-draft';
import {
  getRefundAttempt,
  setRefundAttempt,
  useRefundAttempt,
} from '../model/refund-attempt';
import type { RefundCommand, RemainingItem } from '../model/refund.schemas';
export function RefundDialog({
  request,
  scope,
  sale,
  remaining,
  attemptKey,
  onClose,
  onCompleted,
  onIssue,
}: {
  request: AuthenticatedRequest;
  scope: RefundScope;
  sale: CompletedSale;
  remaining: RemainingItem[];
  attemptKey: string;
  onClose(): void;
  onCompleted(): void;
  onIssue(message: string, denied: boolean): void;
}) {
  const retained = useRefundAttempt(attemptKey);
  const [initial] = useState(() => getRefundAttempt(attemptKey));
  const [draft, setDraft] = useState<RefundDraft>(() => ({
    lines: Object.fromEntries(
      sale.items.map((item) => {
        const saved = initial?.command.items.find(
          (line) => line.saleItemId === item.id,
        );
        return [
          item.id,
          {
            quantity: String(saved?.quantity ?? 0),
            restock: String(saved?.restockQuantity ?? 0),
          },
        ];
      }),
    ),
    reason: initial?.command.reason ?? '',
    method: initial?.command.paymentMethod ?? sale.paymentMethod,
    reference: initial?.command.paymentReference ?? '',
    confirmed: Boolean(initial),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(
    initial
      ? 'An unresolved refund is locked. Retry this exact record; do not refund money again.'
      : null,
  );
  const [pending, setPending] = useState(initial?.state === 'pending');
  const [unknown, setUnknown] = useState(initial?.state === 'unknown');
  const busy = useRef(initial?.state === 'pending');
  const uncertain = useRef(Boolean(initial));
  const command = useRef<RefundCommand | null>(initial?.command ?? null);
  const mounted = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);
  function edit(next: RefundDraft, immediate = false) {
    if (busy.current || uncertain.current) return;
    setDraft(next);
    setMessage(null);
    window.clearTimeout(timer.current);
    const run = () => setErrors(refundErrors(next, remaining));
    if (immediate) run();
    else timer.current = window.setTimeout(run, 300);
  }
  async function submit() {
    if (busy.current || getRefundAttempt(attemptKey)?.state === 'pending')
      return;
    window.clearTimeout(timer.current);
    let submitted = command.current;
    if (!uncertain.current) {
      const invalid = refundErrors(draft, remaining);
      setErrors(invalid);
      if (Object.keys(invalid).length) {
        if (form.current) focusFirstInvalidField(form.current);
        return;
      }
      const content = {
        reason: draft.reason.trim(),
        paymentMethod: draft.method,
        ...(draft.method === 'CASH'
          ? {}
          : { paymentReference: draft.reference.trim() }),
        refundConfirmed: true as const,
        items: Object.entries(draft.lines)
          .filter(([, line]) => Number(line.quantity) > 0)
          .map(([saleItemId, line]) => ({
            saleItemId,
            quantity: Number(line.quantity),
            restockQuantity: Number(line.restock),
          }))
          .sort((a, b) => a.saleItemId.localeCompare(b.saleItemId)),
      };
      const previous = submitted
        ? { ...submitted, requestId: undefined }
        : null;
      if (
        JSON.stringify({ ...content, requestId: undefined }) !==
        JSON.stringify(previous)
      )
        submitted = { ...content, requestId: crypto.randomUUID() };
      command.current = submitted;
    }
    if (!submitted) return;
    busy.current = true;
    setPending(true);
    setMessage(null);
    setRefundAttempt(attemptKey, {
      scope,
      command: submitted,
      state: 'pending',
    });
    try {
      const refund = await completeRefund(request, scope, sale, submitted);
      setRefundAttempt(attemptKey, {
        scope,
        command: submitted,
        state: 'completed',
        refund,
      });
      uncertain.current = false;
      if (mounted.current) onCompleted();
    } catch (cause) {
      const api = cause instanceof ApiError ? cause : null;
      const known =
        !uncertain.current &&
        api &&
        ([400, 401, 403, 404, 429].includes(api.status) ||
          (api.status === 409 &&
            ['RETURN_QUANTITY_EXCEEDED', 'STOCK_OVERFLOW'].includes(
              api.details?.code ?? '',
            )));
      if (known) {
        setRefundAttempt(attemptKey, null);
        if (!mounted.current) return;
        if ([401, 403, 404].includes(api.status) || api.status === 409) {
          onIssue(
            `${api.message} Refresh and review remaining quantities before another record.`,
            [401, 403, 404].includes(api.status),
          );
          onClose();
        } else setMessage(api.message);
      } else {
        uncertain.current = true;
        setRefundAttempt(attemptKey, {
          scope,
          command: submitted,
          state: 'unknown',
        });
        if (!mounted.current) return;
        setUnknown(true);
        setMessage(
          api?.details?.code === 'REFUND_RETRY'
            ? 'The database rolled back a concurrent conflict. Retry this unchanged refund record; do not issue money again.'
            : 'Completion is not confirmed. The exact command is locked. Retry the same refund to retrieve its outcome; do not refund money again. If access changed, refresh access.',
        );
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  const locked =
    pending ||
    unknown ||
    retained?.state === 'pending' ||
    retained?.state === 'unknown';
  return (
    <FormDialog
      title="Return items and record refund"
      description="Record money already refunded manually. Restock only the original branch placement; zero restock does not change inventory."
      pending={locked}
      onClose={() => {
        if (!busy.current && !uncertain.current) onClose();
      }}
    >
      <form
        ref={form}
        noValidate
        className="mt-6 grid min-w-0 gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <section aria-label="Original sale return lines" className="min-w-0">
          <ul className="divide-y divide-hairline">
            {sale.items.map((item) => {
              const left =
                remaining.find((line) => line.saleItemId === item.id)
                  ?.remainingQuantity ?? 0;
              const line = draft.lines[item.id];
              return (
                <li
                  key={item.id}
                  className="grid min-w-0 gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <div className="min-w-0 break-words">
                    <h3 className="font-semibold">{item.productName}</h3>
                    <p className="text-sm text-muted">
                      {item.merchantName} · SKU {item.sku ?? 'not set'} ·
                      Barcode {item.barcode ?? 'not set'}
                    </p>
                    <p className="mt-2 text-sm tabular-nums">
                      Saved unit price: PHP {item.unitPrice} · Remaining: {left}
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <TextField
                      label={`Return units — ${item.productName}`}
                      inputMode="numeric"
                      value={line.quantity}
                      disabled={locked || left === 0}
                      error={errors[`${item.id}:quantity`]}
                      onChange={(event) =>
                        edit({
                          ...draft,
                          lines: {
                            ...draft.lines,
                            [item.id]: {
                              ...line,
                              quantity: event.target.value,
                            },
                          },
                        })
                      }
                      onBlur={() => edit(draft, true)}
                    />
                    <TextField
                      label={`Restock units — ${item.productName}`}
                      inputMode="numeric"
                      value={line.restock}
                      disabled={locked || left === 0}
                      error={errors[`${item.id}:restock`]}
                      onChange={(event) =>
                        edit({
                          ...draft,
                          lines: {
                            ...draft.lines,
                            [item.id]: { ...line, restock: event.target.value },
                          },
                        })
                      }
                      onBlur={() => edit(draft, true)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {errors.items ? (
            <p role="alert" className="text-sm text-danger">
              {errors.items}
            </p>
          ) : null}
          <p className="mt-4 font-semibold tabular-nums">
            Estimated refund: PHP {refundEstimate(sale, draft)}
          </p>
          <p className="mt-2 text-sm text-muted">
            Amounts use original saved prices, not today’s prices. Non-restocked
            units do not enter sellable inventory.
          </p>
        </section>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <TextField
            label="Refund reason"
            value={draft.reason}
            disabled={locked}
            error={errors.reason}
            onChange={(event) => edit({ ...draft, reason: event.target.value })}
            onBlur={() => edit(draft, true)}
          />
          <fieldset disabled={locked} className="grid min-w-0 gap-2">
            <legend className="mb-2 text-sm font-semibold">
              Actual refund method
            </legend>
            <div className="flex flex-wrap gap-3">
              {(['CASH', 'GCASH', 'CARD'] as const).map((method) => (
                <label
                  key={method}
                  className="flex min-h-11 items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="refund-method"
                    checked={draft.method === method}
                    onChange={() =>
                      edit({
                        ...draft,
                        method,
                        reference: '',
                        confirmed: false,
                      })
                    }
                  />
                  {method === 'CASH'
                    ? 'Cash'
                    : method === 'GCASH'
                      ? 'GCash (manual)'
                      : 'Card (manual)'}
                </label>
              ))}
            </div>
          </fieldset>
          {draft.method !== 'CASH' ? (
            <TextField
              label="Refund reference"
              value={draft.reference}
              disabled={locked}
              error={errors.reference}
              hint="Manual, unverified reference. No provider processing occurs."
              onChange={(event) =>
                edit({ ...draft, reference: event.target.value })
              }
              onBlur={() => edit(draft, true)}
            />
          ) : null}
        </div>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.confirmed}
            disabled={locked}
            aria-invalid={Boolean(errors.confirmed)}
            aria-describedby={
              errors.confirmed ? 'refund-confirmation-error' : undefined
            }
            onChange={(event) =>
              edit({ ...draft, confirmed: event.target.checked })
            }
          />
          <span>I confirm this money was refunded outside this system.</span>
        </label>
        {errors.confirmed ? (
          <p id="refund-confirmation-error" className="text-sm text-danger">
            {errors.confirmed}
          </p>
        ) : null}
        {message ? (
          <p role="alert" className="break-words text-sm text-danger">
            {message}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={locked} onClick={onClose}>
            Cancel return
          </Button>
          <Button
            type="submit"
            pending={pending || retained?.state === 'pending'}
            pendingLabel="Recording refund…"
          >
            {unknown ? 'Retry same refund' : 'Record refund'}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
