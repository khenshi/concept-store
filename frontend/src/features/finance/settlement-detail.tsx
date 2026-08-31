'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RequestError } from '@/components/ui/request-error';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import {
  addAdjustment,
  getSettlement,
  recordPayout,
  removeAdjustment,
  settlementAction,
} from './settlement-api';
import { adjustmentSchema, payoutSchema } from './settlement.schemas';
import type { SettlementDetail, PayoutMethod } from './settlement.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The settlement action could not be completed.';
}

export function SettlementDetailPage({
  organizationId,
  settlementId,
}: {
  organizationId: string;
  settlementId: string;
}) {
  const { request } = useAuth();
  const { organization } = useOrganizationWorkspaceContext();
  const [settlement, setSettlement] = useState<SettlementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const load = useCallback(async () => {
    setError(null);
    try {
      setSettlement(await getSettlement(request, organizationId, settlementId));
    } catch (cause) {
      setError(message(cause));
    }
  }, [organizationId, request, settlementId]);
  useEffect(() => {
    let active = true;
    void getSettlement(request, organizationId, settlementId)
      .then((result) => {
        if (active) setSettlement(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(message(cause));
      });
    return () => {
      active = false;
    };
  }, [organizationId, request, settlementId]);

  async function action(
    kind: 'recalculate' | 'review' | 'return-to-draft' | 'approve',
  ) {
    const ok = await confirm({
      title: `${kind.replaceAll('-', ' ')} settlement?`,
      description:
        'This changes the settlement lifecycle and will be recorded against your account.',
      confirmLabel: 'Continue',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      setSettlement(
        await settlementAction(request, organizationId, settlementId, kind),
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = adjustmentSchema.safeParse({
      amount: form.get('amount'),
      reason: form.get('reason'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid adjustment.');
      return;
    }
    setBusy(true);
    try {
      setSettlement(
        await addAdjustment(request, organizationId, settlementId, parsed.data),
      );
      event.currentTarget.reset();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function payout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = payoutSchema.safeParse({
      method: form.get('method'),
      referenceNumber: form.get('referenceNumber'),
      note: form.get('note'),
      paidAt: form.get('paidAt'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid payout.');
      return;
    }
    setBusy(true);
    try {
      setSettlement(
        await recordPayout(request, organizationId, settlementId, {
          method: parsed.data.method as PayoutMethod,
          referenceNumber: parsed.data.referenceNumber || undefined,
          note: parsed.data.note || undefined,
          paidAt: new Date(parsed.data.paidAt).toISOString(),
        }),
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!settlement)
    return (
      <section className="mt-12">
        {error ? (
          <RequestError message={error} onRetry={() => void load()} />
        ) : (
          <p role="status">Loading settlement…</p>
        )}
      </section>
    );
  const owner = organization?.role === 'OWNER';
  return (
    <section className="mx-auto mt-8 w-full sm:mt-12">
      <Link
        className="text-sm font-bold text-emerald-700"
        href={`/app/organizations/${organizationId}/settlements`}
      >
        ← Settlement register
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
            {settlement.status}
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {settlement.merchant.name}
          </h1>
          <p className="mt-2 text-slate-500">
            {settlement.periodStart.slice(0, 10)} –{' '}
            {settlement.periodEnd.slice(0, 10)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {settlement.status === 'DRAFT' ? (
            <>
              <Action
                disabled={busy}
                onClick={() => void action('recalculate')}
              >
                Recalculate
              </Action>
              <Action
                primary
                disabled={busy}
                onClick={() => void action('review')}
              >
                Mark reviewed
              </Action>
            </>
          ) : null}
          {settlement.status === 'REVIEWED' ? (
            <>
              <Action
                disabled={busy}
                onClick={() => void action('return-to-draft')}
              >
                Return to draft
              </Action>
              {owner ? (
                <Action
                  primary
                  disabled={busy}
                  onClick={() => void action('approve')}
                >
                  Approve
                </Action>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {error ? (
        <RequestError
          className="mt-5"
          message={error}
          onRetry={() => void load()}
        />
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Gross sales', settlement.grossSales],
          ['Commission', `-${settlement.commissionAmount}`],
          ['Fixed rent', `-${settlement.fixedRentAmount}`],
          ['Adjustments', settlement.adjustmentTotal],
          ['Net payout', settlement.netPayout],
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
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Calculation terms">
          {settlement.terms.map((term) => (
            <div
              className="border-b border-slate-100 py-3 text-sm"
              key={term.id}
            >
              <strong>
                {term.segmentStart.slice(0, 10)} –{' '}
                {term.segmentEnd.slice(0, 10)}
              </strong>
              <p className="mt-1 text-slate-500">
                Gross {money.format(Number(term.grossSales))} · Commission{' '}
                {money.format(Number(term.commissionAmount))} · Rent{' '}
                {money.format(Number(term.fixedRentAmount))}
              </p>
            </div>
          ))}
        </Panel>
        <Panel title="Attributed sales">
          {settlement.saleItems.length ? (
            settlement.saleItems.map((item) => (
              <div
                className="flex justify-between gap-4 border-b border-slate-100 py-3 text-sm"
                key={item.saleItemId}
              >
                <span>
                  <strong>{item.saleItem.productName}</strong>
                  <br />
                  <span className="text-slate-500">
                    {item.saleItem.sale.saleNumber} · Qty{' '}
                    {item.saleItem.quantity}
                  </span>
                </span>
                <strong>{money.format(Number(item.grossAmount))}</strong>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No attributed sales.</p>
          )}
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Adjustments">
          {settlement.adjustments.map((item) => (
            <div
              className="flex items-start justify-between gap-3 border-b border-slate-100 py-3 text-sm"
              key={item.id}
            >
              <span>
                <strong>{money.format(Number(item.amount))}</strong>
                <br />
                <span className="text-slate-500">{item.reason}</span>
              </span>
              {settlement.status === 'DRAFT' ? (
                <button
                  className="font-bold text-red-600"
                  disabled={busy}
                  onClick={() =>
                    void removeAdjustment(
                      request,
                      organizationId,
                      settlementId,
                      item.id,
                    )
                      .then(setSettlement)
                      .catch((cause) => setError(message(cause)))
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          {settlement.status === 'DRAFT' ? (
            <form className="mt-4 grid gap-3" onSubmit={add}>
              <input
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                name="amount"
                placeholder="Signed amount, e.g. -500.00"
                required
              />
              <input
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                name="reason"
                placeholder="Reason"
                required
              />
              <Action primary disabled={busy}>
                Add adjustment
              </Action>
            </form>
          ) : null}
        </Panel>
        <Panel title="Payout">
          {settlement.payout ? (
            <div className="text-sm">
              <p className="text-2xl font-bold">
                {money.format(Number(settlement.payout.amount))}
              </p>
              <p className="mt-2 text-slate-500">
                {settlement.payout.method.replace('_', ' ')} ·{' '}
                {new Date(settlement.payout.paidAt).toLocaleString('en-PH')}
              </p>
              {settlement.payout.referenceNumber ? (
                <p className="mt-1">
                  Reference: {settlement.payout.referenceNumber}
                </p>
              ) : null}
            </div>
          ) : owner &&
            settlement.status === 'APPROVED' &&
            Number(settlement.netPayout) > 0 ? (
            <form className="grid gap-3" onSubmit={payout}>
              <select
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                name="method"
              >
                {['CASH', 'GCASH', 'BANK_TRANSFER', 'OTHER'].map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
              <input
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                name="referenceNumber"
                placeholder="Reference (required for non-cash)"
              />
              <input
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                name="paidAt"
                type="datetime-local"
                required
              />
              <textarea
                className="rounded-lg border border-slate-300 p-3"
                name="note"
                placeholder="Optional note"
              />
              <Action primary disabled={busy}>
                Record payout
              </Action>
            </form>
          ) : (
            <p className="text-sm text-slate-500">No payout recorded.</p>
          )}
        </Panel>
      </div>
      {confirmationDialog}
    </section>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Action({
  children,
  primary,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      className={`min-h-11 rounded-lg px-4 font-bold ${primary ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white text-slate-700'} disabled:opacity-60`}
      type={props.type ?? 'button'}
      {...props}
    >
      {children}
    </button>
  );
}
