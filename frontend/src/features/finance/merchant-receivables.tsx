'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import {
  adjustMerchantReceivable,
  listMerchantReceivables,
  recordReceivablePayment,
} from './settlement-api';
import type {
  MerchantReceivable,
  MerchantReceivableStatus,
  PayoutMethod,
} from './settlement.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

const statusLabel: Record<MerchantReceivableStatus, string> = {
  OPEN: 'Open',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};
const PAGE_SIZE = 20;

export function MerchantReceivables({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const [items, setItems] = useState<MerchantReceivable[]>([]);
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'payment' | 'adjustment'>('payment');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receivablesRequestId = useRef(0);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const load = useCallback(async () => {
    const requestId = ++receivablesRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listMerchantReceivables(request, organizationId, {
        status: status || undefined,
        offset,
        limit: PAGE_SIZE,
      });
      if (requestId === receivablesRequestId.current) {
        setItems(page.items);
        setTotal(page.total);
      }
    } catch (cause) {
      if (requestId === receivablesRequestId.current)
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Rent receivables could not be loaded.',
        );
    } finally {
      if (requestId === receivablesRequestId.current) setLoading(false);
    }
  }, [offset, organizationId, request, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (mode === 'payment') {
        const amount = String(form.get('amount') || '0');
        const approved = await confirm({
          title: 'Record this rent payment?',
          description: `This records ${money.format(Number(amount))}. Any remaining balance stays open for a later payment.`,
          confirmLabel: 'Record payment',
        });
        if (!approved) return;
        await recordReceivablePayment(request, organizationId, selected, {
          method: String(form.get('method')) as PayoutMethod,
          amount,
          paidAt: new Date().toISOString(),
          referenceNumber:
            String(form.get('referenceNumber') || '') || undefined,
          note: String(form.get('note') || '') || undefined,
          requestId: crypto.randomUUID(),
        });
      } else {
        await adjustMerchantReceivable(request, organizationId, selected, {
          amount: String(form.get('amount')),
          reason: String(form.get('reason')),
        });
      }
      setSelected(null);
      await load();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'The entry could not be recorded.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Rent receivables</h2>
          <p className="mt-1 text-sm text-slate-500">
            Fixed monthly rent owed to the store, kept separate from merchant
            payouts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm"
            onChange={(event) => {
              receivablesRequestId.current += 1;
              setStatus(event.target.value);
              setOffset(0);
            }}
            value={status}
          >
            <option value="">All statuses</option>
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {loading ? (
            <span
              className="text-sm font-semibold text-slate-500"
              role="status"
            >
              Updating…
            </span>
          ) : null}
        </div>
      </div>
      {error ? (
        <RequestError
          className="mt-4"
          message={error}
          onRetry={() => void load()}
        />
      ) : null}
      {loading ? <ListSkeleton label="Loading rent receivables" /> : null}
      <div className={`${loading ? 'sr-only' : ''} mt-5 overflow-x-auto`}>
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="p-3">Merchant</th>
              <th className="p-3">Period</th>
              <th className="p-3 text-right">Accrued</th>
              <th className="p-3 text-right">Collected</th>
              <th className="p-3 text-right">Outstanding</th>
              <th className="p-3">Due date</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="p-3 font-bold">{item.merchant.name}</td>
                <td className="p-3">{item.sourcePeriod.slice(0, 7)}</td>
                <td className="p-3 text-right tabular-nums">
                  {money.format(Number(item.accruedAmount))}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {money.format(Number(item.collectedAmount))}
                </td>
                <td className="p-3 text-right font-bold tabular-nums">
                  {money.format(Number(item.outstandingAmount))}
                </td>
                <td className="p-3">{item.dueDate}</td>
                <td className="p-3">{statusLabel[item.status]}</td>
                <td className="p-3 text-right">
                  {item.status !== 'PAID' ? (
                    <button
                      className="font-bold text-emerald-700"
                      onClick={() => setSelected(item.id)}
                      type="button"
                    >
                      Manage
                    </button>
                  ) : (
                    <span className="text-slate-400">Complete</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && !items.length ? (
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={8}>
                  No rent receivables match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-500">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}{' '}
            receivables
          </p>
          <div className="flex gap-2">
            <button
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-40"
              disabled={offset === 0 || loading}
              onClick={() =>
                setOffset((current) => Math.max(0, current - PAGE_SIZE))
              }
              type="button"
            >
              Previous
            </button>
            <button
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-40"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
      {selected ? (
        <form
          className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
          key={selected}
          onSubmit={submit}
        >
          <div className="flex gap-2">
            <button
              className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'payment' ? 'bg-emerald-700 text-white' : 'bg-white'}`}
              onClick={() => setMode('payment')}
              type="button"
            >
              Record payment
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'adjustment' ? 'bg-emerald-700 text-white' : 'bg-white'}`}
              onClick={() => setMode('adjustment')}
              type="button"
            >
              Adjust balance
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            {mode === 'payment' ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
                Available balance:{' '}
                {money.format(
                  Number(
                    items.find((item) => item.id === selected)
                      ?.outstandingAmount ?? 0,
                  ),
                )}
                <label className="ml-4 inline-flex items-center gap-2 font-normal">
                  Apply amount
                  <input
                    className="min-h-11 w-32 rounded-lg border border-slate-300 px-3 text-right"
                    defaultValue={
                      items.find((item) => item.id === selected)
                        ?.outstandingAmount ?? '0.00'
                    }
                    max={
                      items.find((item) => item.id === selected)
                        ?.outstandingAmount
                    }
                    min="0.01"
                    name="amount"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
              </div>
            ) : (
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
            )}
            {mode === 'payment' ? (
              <>
                <label className="grid gap-1 text-sm font-bold">
                  Method
                  <select
                    className="min-h-11 rounded-lg border border-slate-300 px-3"
                    name="method"
                  >
                    <option>CASH</option>
                    <option>GCASH</option>
                    <option>BANK_TRANSFER</option>
                    <option>OTHER</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Reference
                  <input
                    className="min-h-11 rounded-lg border border-slate-300 px-3"
                    name="referenceNumber"
                  />
                </label>
                <label className="grid min-w-56 flex-1 gap-1 text-sm font-bold">
                  Note
                  <input
                    className="min-h-11 rounded-lg border border-slate-300 px-3"
                    name="note"
                  />
                </label>
              </>
            ) : (
              <label className="grid min-w-64 flex-1 gap-1 text-sm font-bold">
                Documented reason
                <input
                  className="min-h-11 rounded-lg border border-slate-300 px-3"
                  name="reason"
                  required
                />
              </label>
            )}
            <button
              className="min-h-11 rounded-lg bg-emerald-700 px-4 font-bold text-white"
              disabled={busy}
              type="submit"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              className="min-h-11 px-3 font-bold text-slate-500"
              onClick={() => setSelected(null)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {confirmationDialog}
    </section>
  );
}
