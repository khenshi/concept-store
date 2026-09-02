'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RequestError } from '@/components/ui/request-error';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import {
  addFinanceEntry,
  closeLivePayable,
  listLivePayables,
  previewLivePayable,
  removeFinanceEntry,
} from './settlement-api';
import { financeEntrySchema } from './settlement.schemas';
import type {
  LiveMerchantPayable,
  SettlementPreview,
} from './settlement.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const readableDate = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeZone: 'Asia/Manila',
});

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The live payable could not be loaded.';
}

export function LivePayableDetailPage({
  organizationId,
  merchantId,
}: {
  organizationId: string;
  merchantId: string;
}) {
  const { request } = useAuth();
  const router = useRouter();
  const [payable, setPayable] = useState<LiveMerchantPayable | null>(null);
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [rentDeductionAmount, setRentDeductionAmount] = useState<
    string | undefined
  >();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await listLivePayables(request, organizationId, {
        merchantId,
        limit: 1,
      });
      setPayable(page.items[0] ?? null);
      const row = page.items[0];
      if (
        row &&
        row.financeStatus !== 'AGREEMENT_REQUIRED' &&
        !row.pendingSettlement
      ) {
        setPreview(
          await previewLivePayable(request, organizationId, merchantId),
        );
        setRentDeductionAmount(undefined);
      }
      if (!row) setError('This active merchant payable was not found.');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [merchantId, organizationId, request]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function settle() {
    if (!payable) return;
    const approved = await confirm({
      title: `Create settlement for ${payable.merchant.name}?`,
      description: `This snapshots ${money.format(Number(preview?.finalPayout ?? payable.amountDue))} through ${payable.asOf} for review and approval.`,
      confirmLabel: 'Create draft settlement',
    });
    if (!approved) return;
    setBusy(true);
    setError(null);
    try {
      const settlement = await closeLivePayable(
        request,
        organizationId,
        merchantId,
        rentDeductionAmount,
      );
      router.push(
        `/app/organizations/${organizationId}/settlements/${settlement.id}`,
      );
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  async function toggleRentDeduction(checked: boolean) {
    if (!preview) return;
    const outstanding = preview.receivables.reduce(
      (total, item) => total + Number(item.availableAmount),
      0,
    );
    const next = checked
      ? Math.min(outstanding, Number(preview.merchantPayable)).toFixed(2)
      : undefined;
    setBusy(true);
    setError(null);
    try {
      setPreview(
        await previewLivePayable(request, organizationId, merchantId, next),
      );
      setRentDeductionAmount(next);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = financeEntrySchema.safeParse({
      amount: form.get('amount'),
      reason: form.get('reason'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Review the finance entry.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setPayable(
        await addFinanceEntry(request, organizationId, merchantId, parsed.data),
      );
      event.currentTarget.reset();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(entryId: string) {
    setBusy(true);
    setError(null);
    try {
      setPayable(
        await removeFinanceEntry(request, organizationId, merchantId, entryId),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!payable)
    return (
      <section className="mt-12">
        {error ? (
          <RequestError message={error} onRetry={() => void load()} />
        ) : (
          <p role="status">Loading live payable…</p>
        )}
      </section>
    );

  return (
    <section className="mx-auto mt-8 w-full sm:mt-12">
      <Link
        className="text-sm font-bold text-emerald-700"
        href={`/app/organizations/${organizationId}/settlements`}
      >
        ← Live payables
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
            {payable.financeStatus.replaceAll('_', ' ')}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{payable.merchant.name}</h1>
          <p className="mt-2 text-slate-500">
            {payable.branches.map((branch) => branch.name).join(', ') ||
              'No branch activity'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {payable.periodStart
              ? `${payable.periodStart} – ${payable.asOf}`
              : 'A current agreement is required'}
            {payable.nextSettlementDeadline
              ? ` · Deadline ${payable.nextSettlementDeadline}`
              : ''}
          </p>
        </div>
        {payable.pendingSettlement ? (
          <Link
            className="rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white"
            href={`/app/organizations/${organizationId}/settlements/${payable.pendingSettlement.id}`}
          >
            Continue settlement
          </Link>
        ) : payable.financeStatus === 'AGREEMENT_REQUIRED' ? (
          <Link
            className="rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white"
            href={`/app/organizations/${organizationId}/merchants/${merchantId}/agreements`}
          >
            Set up agreement
          </Link>
        ) : (
          <button
            className="rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-60"
            disabled={busy || payable.financeStatus === 'NO_ACTIVITY'}
            onClick={() => void settle()}
            type="button"
          >
            {payable.financeStatus === 'NO_ACTIVITY'
              ? 'Nothing to settle'
              : 'Create settlement'}
          </button>
        )}
      </div>
      {error ? (
        <RequestError
          className="mt-5"
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      {payable.financeStatus === 'OVERDUE' ? (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">
            {money.format(Number(payable.overdueAmount))} was due on{' '}
            {payable.nextSettlementDeadline}.
          </p>
          {Number(payable.newActivityAmount) !== 0 ? (
            <p className="mt-1">
              {money.format(Number(payable.newActivityAmount))} in newer
              activity is included in the current total.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Gross sales', payable.grossSales],
          ['Refunds', `-${payable.refundTotal}`],
          ['Net sales', payable.netSales],
          ['Commission', `-${payable.commissionAmount}`],
          ['Outstanding rent', payable.rentOutstandingAmount],
          [
            'Selected rent offset',
            `-${preview?.receivableDeductionTotal ?? payable.fixedRentAmount}`,
          ],
          ['Adjustments', payable.adjustmentTotal],
          ['Amount due', payable.amountDue],
        ].map(([label, value]) => (
          <div
            className="rounded-xl border border-slate-200 bg-white p-5"
            key={label}
          >
            <p className="text-xs font-bold uppercase text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums">
              {money.format(Number(value))}
            </p>
          </div>
        ))}
      </div>

      {preview?.receivables.length ? (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-bold">Accumulated rent</h2>
              <p className="mt-1 text-sm text-slate-500">
                Outstanding rent is applied oldest-first only when you choose to
                deduct it from this settlement.
              </p>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold">
              <input
                checked={Boolean(rentDeductionAmount)}
                disabled={busy || Number(preview.merchantPayable) <= 0}
                onChange={(event) =>
                  void toggleRentDeduction(event.target.checked)
                }
                type="checkbox"
              />
              Deduct outstanding rent
            </label>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Total available:{' '}
            <strong>
              {money.format(
                preview.receivables.reduce(
                  (total, item) => total + Number(item.availableAmount),
                  0,
                ),
              )}
            </strong>
          </p>
          <div className="mt-4 divide-y divide-slate-100">
            {preview.receivables.map((receivable) => (
              <div
                className="flex items-center justify-between gap-4 py-3"
                key={receivable.id}
              >
                <span>
                  <span className="font-bold">
                    Rent for {receivable.sourcePeriod.slice(0, 7)}
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    Due {readableDate.format(new Date(receivable.dueDate))}
                  </span>
                </span>
                <strong>
                  {money.format(Number(receivable.availableAmount))}
                </strong>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-bold">
            <div>
              <span className="block">Rent deduction</span>
              <span className="mt-1 block text-sm font-normal text-slate-500">
                Applied to the oldest balance first
              </span>
            </div>
            <span>
              -{money.format(Number(preview.receivableDeductionTotal))}
            </span>
          </div>
          <div className="mt-3 flex justify-between font-bold">
            <span>Settlement payout</span>
            <span>{money.format(Number(preview.finalPayout))}</span>
          </div>
        </section>
      ) : null}

      {payable.financeStatus !== 'AGREEMENT_REQUIRED' &&
      !payable.pendingSettlement ? (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold">Record a payable adjustment</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use a signed amount and document why the live merchant payable needs
            to change. Rent payments belong in Rent receivables.
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={addEntry}
          >
            <label className="grid gap-1 text-sm font-bold">
              Amount
              <input
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                name="amount"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label className="grid min-w-64 flex-1 gap-1 text-sm font-bold">
              Reason
              <input
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                name="reason"
                required
              />
            </label>
            <button
              className="min-h-11 rounded-lg border border-slate-300 px-4 font-bold"
              disabled={busy}
              type="submit"
            >
              Save entry
            </button>
          </form>
        </section>
      ) : null}

      {payable.accountEntries.length ? (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold">Unsettled finance entries</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {payable.accountEntries.map((entry) => (
              <div
                className="flex items-center justify-between gap-4 py-3 text-sm"
                key={entry.id}
              >
                <p>
                  <strong>
                    Adjustment · {money.format(Number(entry.amount))}
                  </strong>
                  <span className="ml-2 text-slate-500">{entry.reason}</span>
                </p>
                {!payable.pendingSettlement ? (
                  <button
                    className="font-bold text-red-600"
                    disabled={busy}
                    onClick={() => void removeEntry(entry.id)}
                    type="button"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {confirmationDialog}
    </section>
  );
}
