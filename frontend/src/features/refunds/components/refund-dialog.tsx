'use client';
import { useEffect, useRef, useState } from 'react';
import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import type { CompletedSale } from '@/features/pos/model/checkout';
import { ApiError } from '@/features/auth/api/auth-client';
import { Button } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
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

function RefundQuantityInput({
  id,
  label,
  value,
  disabled,
  error,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  error?: string;
  onChange(value: string): void;
  onBlur(): void;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="e.g. 2"
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className="min-h-11 w-full min-w-0 rounded-full bg-subtle px-3 py-2.5 text-left text-body tabular-nums text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

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
            quantity: saved ? String(saved.quantity) : '',
            restock: saved ? String(saved.restockQuantity) : '',
          },
        ];
      }),
    ),
    reason: initial?.command.reason ?? '',
    method: initial?.command.paymentMethod ?? sale.paymentMethod,
    reference: initial?.command.paymentReference ?? '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(
    initial
      ? 'An unresolved refund is locked. Retry this exact record; do not refund money again.'
      : null,
  );
  const [pending, setPending] = useState(false);
  const [unknown, setUnknown] = useState(initial?.state === 'unknown');
  const busy = useRef(false);
  const uncertain = useRef(Boolean(initial));
  const command = useRef<RefundCommand | null>(initial?.command ?? null);
  const inheritedPending = useRef(initial?.state === 'pending');
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
  useEffect(() => {
    if (!inheritedPending.current || retained) return;
    inheritedPending.current = false;
    void Promise.resolve().then(() => {
      if (!mounted.current) return;
      uncertain.current = false;
      command.current = null;
      onIssue(
        'The previous refund was rejected. Refresh and review remaining quantities before another record.',
        false,
      );
      onClose();
    });
  }, [retained, onIssue, onClose]);
  function edit(next: RefundDraft, immediate = false, shouldValidate = true) {
    if (busy.current || uncertain.current) return;
    setDraft(next);
    setMessage(null);
    window.clearTimeout(timer.current);
    if (!shouldValidate) return;
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
  const requestPending = pending || retained?.state === 'pending';
  const unresolved = unknown || retained?.state === 'unknown';
  const hasValidationErrors =
    Object.keys(refundErrors(draft, remaining)).length > 0;
  return (
    <FormDialog
      title="Return items and record refund"
      description="Record money already refunded manually. Restock only the original branch placement; zero restock does not change inventory."
      size="large"
      pending={locked}
      onClose={() => {
        if (!busy.current && !uncertain.current) onClose();
      }}
    >
      <form
        ref={form}
        noValidate
        className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)] lg:items-stretch"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <section
          aria-label="Original sale return lines"
          className="flex min-w-0 min-h-0 flex-col"
        >
          <div>
            <h3 className="font-semibold">Items to return</h3>
            <p className="mt-1 text-sm text-muted">
              Choose the returned and restocked quantity for each product.
            </p>
          </div>
          <div className="mt-4 min-w-0 overflow-hidden rounded-control border border-hairline">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <caption className="sr-only">
                Products and quantities available for return
              </caption>
              <thead className="table w-full table-fixed bg-subtle">
                <tr className="data-column-header">
                  <th scope="col" className="px-3 py-3 text-left">
                    Product
                  </th>
                  <th scope="col" className="w-32 px-3 py-3 text-left">
                    Returnable
                  </th>
                  <th scope="col" className="w-28 px-3 py-3 text-left">
                    Return
                  </th>
                  <th scope="col" className="w-28 px-3 py-3 text-left">
                    Restock
                  </th>
                </tr>
              </thead>
              <tbody className="block max-h-[min(48dvh,28rem)] overflow-y-auto overscroll-contain">
                {sale.items.map((item) => {
                  const left =
                    remaining.find((line) => line.saleItemId === item.id)
                      ?.remainingQuantity ?? 0;
                  const line = draft.lines[item.id];
                  const returnId = `refund-return-${item.id}`;
                  const restockId = `refund-restock-${item.id}`;
                  return (
                    <tr
                      key={item.id}
                      className="table w-full table-fixed border-t border-hairline"
                    >
                      <th
                        scope="row"
                        className="max-w-0 px-3 py-3 text-left align-top font-normal"
                      >
                        <p className="break-words font-semibold">
                          {item.productName}
                        </p>
                        <p className="mt-1 break-words text-xs text-muted">
                          {item.merchantName}
                        </p>
                      </th>
                      <td className="w-32 px-3 py-3 align-middle font-semibold tabular-nums">
                        {left}
                      </td>
                      <td className="w-28 px-3 py-3 align-top">
                        <RefundQuantityInput
                          id={returnId}
                          label={`Return units — ${item.productName}`}
                          value={line.quantity}
                          disabled={locked || left === 0}
                          error={errors[`${item.id}:quantity`]}
                          onChange={(value) =>
                            edit({
                              ...draft,
                              lines: {
                                ...draft.lines,
                                [item.id]: { ...line, quantity: value },
                              },
                            })
                          }
                          onBlur={() => edit(draft, true)}
                        />
                      </td>
                      <td className="w-28 px-3 py-3 align-top">
                        <RefundQuantityInput
                          id={restockId}
                          label={`Restock units — ${item.productName}`}
                          value={line.restock}
                          disabled={locked || left === 0}
                          error={errors[`${item.id}:restock`]}
                          onChange={(value) =>
                            edit({
                              ...draft,
                              lines: {
                                ...draft.lines,
                                [item.id]: { ...line, restock: value },
                              },
                            })
                          }
                          onBlur={() => edit(draft, true)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {errors.items ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {errors.items}
            </p>
          ) : null}
        </section>
        <section
          aria-label="Refund details"
          className="flex min-w-0 min-h-0 flex-col gap-5 lg:border-l lg:border-hairline lg:pl-6"
        >
          <div>
            <h3 className="font-semibold">Refund details</h3>
            <p className="mt-1 text-sm text-muted">
              Record the manual payment and reason for this return.
            </p>
          </div>
          <div className="grid min-w-0 gap-5">
            <TextField
              label="Refund reason"
              placeholder="e.g. Customer changed their mind"
              value={draft.reason}
              disabled={locked}
              error={errors.reason}
              onChange={(event) =>
                edit({ ...draft, reason: event.target.value })
              }
              onBlur={() => edit(draft, true)}
            />
            <fieldset disabled={locked} className="grid min-w-0 gap-3">
              <legend className="text-label font-semibold">
                Refund method
              </legend>
              <div className="flex flex-wrap gap-2">
                {(['CASH', 'GCASH', 'CARD'] as const).map((method) => (
                  <label
                    key={method}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm transition-colors hover:bg-selected focus-within:bg-selected"
                  >
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="refund-method"
                      checked={draft.method === method}
                      onChange={() => {
                        setErrors((current) => {
                          const next = { ...current };
                          delete next.reference;
                          return next;
                        });
                        edit(
                          {
                            ...draft,
                            method,
                            reference: '',
                          },
                          false,
                          false,
                        );
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="grid size-5 shrink-0 place-items-center rounded-full border border-control-border bg-surface text-transparent transition-colors peer-checked:border-action peer-checked:bg-action peer-checked:text-action-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-focus peer-disabled:bg-subtle peer-disabled:opacity-60"
                    >
                      <span className="size-2 rounded-full bg-current" />
                    </span>
                    {method === 'CASH'
                      ? 'Cash'
                      : method === 'GCASH'
                        ? 'GCash'
                        : 'Card'}
                  </label>
                ))}
              </div>
            </fieldset>
            <TextField
              label="Refund reference"
              placeholder="e.g. GCASH-20261020-001"
              value={draft.reference}
              disabled={locked || draft.method === 'CASH'}
              error={draft.method === 'CASH' ? undefined : errors.reference}
              hint="Required for GCash or Card; not used for Cash."
              onChange={(event) =>
                edit({ ...draft, reference: event.target.value })
              }
              onBlur={() => edit(draft, true)}
            />
          </div>
          <div className="rounded-control bg-subtle p-4">
            <p className="text-label font-semibold text-muted">
              Estimated refund
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              PHP {refundEstimate(sale, draft)}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted">
              Based on original saved prices. Restocked units return to the
              original branch placement.
            </p>
          </div>
          {message ? (
            <p role="alert" className="break-words text-sm text-danger">
              {message}
            </p>
          ) : null}
          <ModalActionRow className="mt-auto">
            <Button variant="quiet" disabled={locked} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              pending={requestPending}
              disabled={requestPending || (!unresolved && hasValidationErrors)}
              pendingLabel="Recording refund…"
            >
              {unresolved ? 'Retry same refund' : 'Record refund'}
            </Button>
          </ModalActionRow>
        </section>
      </form>
    </FormDialog>
  );
}
