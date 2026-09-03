'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
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

export function MerchantReceivables({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const [items, setItems] = useState<MerchantReceivable[]>([]);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'payment' | 'adjustment'>('payment');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receivablesRequestId = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++receivablesRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listMerchantReceivables(request, organizationId, {
        status: status || undefined,
      });
      if (requestId === receivablesRequestId.current) setItems(page.items);
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
  }, [organizationId, request, status]);

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
        await recordReceivablePayment(request, organizationId, selected, {
          amount: String(form.get('amount')),
          method: String(form.get('method')) as PayoutMethod,
          paidAt: new Date().toISOString(),
          referenceNumber:
            String(form.get('referenceNumber') || '') || undefined,
          note: String(form.get('note') || '') || undefined,
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
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="p-3">Merchant</th>
              <th className="p-3">Period</th>
              <th className="p-3 text-right">Original</th>
              <th className="p-3 text-right">Remaining</th>
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
                  {money.format(Number(item.originalAmount))}
                </td>
                <td className="p-3 text-right font-bold tabular-nums">
                  {money.format(Number(item.remainingAmount))}
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
                <td className="p-8 text-center text-slate-500" colSpan={7}>
                  No rent receivables match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {selected ? (
        <form
          className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
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
    </section>
  );
}
