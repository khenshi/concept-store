'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import {
  addFinanceEntry,
  closeLivePayable,
  listSettlements,
  listLivePayables,
  removeFinanceEntry,
} from './settlement-api';
import type {
  SettlementMetrics,
  LiveMerchantPayable,
  SettlementPage,
  SettlementStatus,
} from './settlement.types';
import { financeEntrySchema } from './settlement.schemas';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const labels: Record<SettlementStatus, string> = {
  DRAFT: 'Draft',
  REVIEWED: 'Reviewed',
  APPROVED: 'Approved',
  PAID: 'Paid',
};

function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'Merchant finance data could not be loaded.';
}

export function SettlementList({ organizationId }: { organizationId: string }) {
  const { request } = useAuth();
  const {
    organization,
    merchants,
    merchantsStatus,
    loadMerchants,
    branches,
    branchesStatus,
    loadBranches,
  } = useOrganizationWorkspaceContext();
  const [page, setPage] = useState<SettlementPage | null>(null);
  const [status, setStatus] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [metrics, setMetrics] = useState<SettlementMetrics | null>(null);
  const [payables, setPayables] = useState<LiveMerchantPayable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [closingMerchantId, setClosingMerchantId] = useState<string | null>(
    null,
  );
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters = {
      merchantId: merchantId || undefined,
      branchId: branchId || undefined,
      status: (status || undefined) as SettlementStatus | undefined,
      periodFrom: periodFrom || undefined,
      periodTo: periodTo || undefined,
      limit: 100,
    };
    const [historyResult, liveResult] = await Promise.allSettled([
      listSettlements(request, organizationId, filters),
      listLivePayables(request, organizationId, {
        merchantId: merchantId || undefined,
        branchId: branchId || undefined,
      }),
    ]);
    if (historyResult.status === 'fulfilled') setPage(historyResult.value);
    if (liveResult.status === 'fulfilled') {
      setMetrics(payableMetrics(liveResult.value));
      setPayables(liveResult.value);
    }
    const failed = [historyResult, liveResult].find(
      (result) => result.status === 'rejected',
    );
    if (failed?.status === 'rejected') setError(message(failed.reason));
    setLoading(false);
  }, [
    branchId,
    merchantId,
    organizationId,
    periodFrom,
    periodTo,
    request,
    status,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  useEffect(() => {
    if (merchantsStatus === 'idle') void loadMerchants().catch(() => undefined);
  }, [loadMerchants, merchantsStatus]);
  useEffect(() => {
    if (branchesStatus === 'idle') void loadBranches().catch(() => undefined);
  }, [branchesStatus, loadBranches]);

  async function close(merchantId: string) {
    const payable = payables.find((item) => item.merchant.id === merchantId);
    if (
      !payable ||
      !(await confirm({
        title: `Create settlement for ${payable.merchant.name}?`,
        description: `This will snapshot ${money.format(Number(payable.amountDue))} through ${payable.asOf}. Review the resulting draft before approving it.`,
        confirmLabel: 'Create draft settlement',
      }))
    )
      return;
    setClosingMerchantId(merchantId);
    setError(null);
    try {
      await closeLivePayable(request, organizationId, merchantId);
      await load();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setClosingMerchantId(null);
    }
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = financeEntrySchema.safeParse({
      type: form.get('type'),
      amount: form.get('amount'),
      reason: form.get('reason'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid adjustment.');
      return;
    }
    setError(null);
    try {
      await addFinanceEntry(
        request,
        organizationId,
        String(form.get('merchantId')),
        parsed.data,
      );
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(message(cause));
    }
  }

  async function removeEntry(merchantId: string, entryId: string) {
    setError(null);
    try {
      await removeFinanceEntry(request, organizationId, merchantId, entryId);
      await load();
    } catch (cause) {
      setError(message(cause));
    }
  }

  if (!organization)
    return (
      <p className="mt-12" role="status">
        Loading settlements…
      </p>
    );
  return (
    <section className="mx-auto mt-8 w-full sm:mt-12">
      <OrganizationPageHeader
        organization={organization}
        title="Merchant finance"
        description="Monitor live merchant balances, close settlements, approve payouts, and keep a complete financial history."
      />
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold">Live merchant payables</h2>
        <p className="mt-1 text-sm text-slate-500">
          Accrued unsettled activity as of today. You can close a balance early;
          its agreement deadline remains on the regular schedule.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={addEntry}
        >
          <label className="grid gap-1 text-sm font-bold">
            Merchant
            <select
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              name="merchantId"
              required
            >
              <option value="">Select merchant</option>
              {payables
                .filter(
                  (item) =>
                    item.financeStatus !== 'AGREEMENT_REQUIRED' &&
                    !item.pendingSettlement,
                )
                .map((item) => (
                  <option key={item.merchant.id} value={item.merchant.id}>
                    {item.merchant.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Entry type
            <select
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              name="type"
            >
              <option value="ADJUSTMENT">Balance adjustment</option>
              <option value="MERCHANT_PAYMENT">
                Merchant payment to store
              </option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Amount
            <input
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              name="amount"
              required
              type="number"
              step="0.01"
            />
          </label>
          <label className="grid min-w-64 flex-1 gap-1 text-sm font-bold">
            Documented reason
            <input
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              name="reason"
              required
            />
          </label>
          <button
            className="min-h-11 rounded-lg border border-slate-300 px-4 font-bold"
            type="submit"
          >
            Record entry
          </button>
        </form>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="p-3">Merchant</th>
                <th className="p-3">Branch</th>
                <th className="p-3">Accrued period</th>
                <th className="p-3">Deadline</th>
                <th className="p-3 text-right">Gross</th>
                <th className="p-3 text-right">Refunds</th>
                <th className="p-3 text-right">Commission</th>
                <th className="p-3 text-right">Rent deducted</th>
                <th className="p-3 text-right">Adjustments</th>
                <th className="p-3 text-right">Merchant payments</th>
                <th className="p-3 text-right">Due</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payables.map((item) => (
                <tr key={item.merchant.id}>
                  <td className="p-3">
                    <p className="font-bold">{item.merchant.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.financeStatus === 'AGREEMENT_REQUIRED'
                        ? 'Agreement required'
                        : item.financeStatus === 'NO_ACTIVITY'
                          ? 'No accrued activity'
                          : 'Live payable'}
                    </p>
                  </td>
                  <td className="p-3">
                    {item.branches.map((branch) => branch.name).join(', ') ||
                      'No activity'}
                  </td>
                  <td className="p-3">
                    {item.periodStart
                      ? `${item.periodStart} – ${item.asOf}`
                      : 'Starts after agreement activation'}
                  </td>
                  <td className="p-3">
                    {item.nextSettlementDeadline ?? 'Not scheduled'}
                  </td>
                  {[
                    item.grossSales,
                    item.refundTotal,
                    item.commissionAmount,
                    item.fixedRentAmount,
                    item.adjustmentTotal,
                    item.merchantPaymentTotal,
                    item.amountDue,
                  ].map((value, index) => (
                    <td
                      className={`p-3 text-right tabular-nums ${index === 6 ? 'font-bold' : ''}`}
                      key={index}
                    >
                      {money.format(Number(value))}
                    </td>
                  ))}
                  <td className="p-3 text-right">
                    {item.pendingSettlement ? (
                      <Link
                        className="font-bold text-emerald-700"
                        href={`/app/organizations/${organizationId}/settlements/${item.pendingSettlement.id}`}
                      >
                        Continue {labels[item.pendingSettlement.status]}
                      </Link>
                    ) : item.financeStatus === 'AGREEMENT_REQUIRED' ? (
                      <Link
                        className="font-bold text-emerald-700"
                        href={`/app/organizations/${organizationId}/merchants/${item.merchant.id}/agreements`}
                      >
                        Set up agreement
                      </Link>
                    ) : item.financeStatus === 'NO_ACTIVITY' ? (
                      <span className="text-slate-400">Nothing to settle</span>
                    ) : (
                      <button
                        className="font-bold text-emerald-700 disabled:opacity-60"
                        disabled={closingMerchantId === item.merchant.id}
                        onClick={() => void close(item.merchant.id)}
                        type="button"
                      >
                        {closingMerchantId === item.merchant.id
                          ? 'Closing…'
                          : 'Settle now'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {payables.some((item) => item.accountEntries.length) ? (
          <div className="mt-5 rounded-[0.6rem] border border-slate-200 p-4">
            <h3 className="text-sm font-bold">Unsettled finance entries</h3>
            <div className="mt-2 divide-y divide-slate-100">
              {payables.flatMap((item) =>
                item.accountEntries.map((entry) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                    key={entry.id}
                  >
                    <span>
                      <strong>{item.merchant.name}</strong> ·{' '}
                      {entry.type === 'MERCHANT_PAYMENT'
                        ? 'Merchant payment'
                        : 'Adjustment'}{' '}
                      · {money.format(Number(entry.amount))}
                      <span className="ml-2 text-slate-500">
                        {entry.reason}
                      </span>
                    </span>
                    {!item.pendingSettlement ? (
                      <button
                        className="font-bold text-red-600"
                        onClick={() =>
                          void removeEntry(item.merchant.id, entry.id)
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                )),
              )}
            </div>
          </div>
        ) : null}
      </section>
      {confirmationDialog}
      {metrics ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Net sales', metrics.netSales],
            ['Refunds', metrics.refunds],
            ['Deductions', metrics.deductions],
            ['Amount due', metrics.amountDue],
            ['Merchants', String(metrics.count)],
          ].map(([label, value]) => (
            <div
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={label}
            >
              <p className="text-xs font-bold uppercase text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-xl font-bold">
                {label === 'Merchants' ? value : money.format(Number(value))}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-bold">Settlement register</h2>
            <p className="mt-1 text-sm text-slate-500">
              {page?.total ?? 0} settlements
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Filter by merchant"
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              value={merchantId}
              onChange={(event) => setMerchantId(event.target.value)}
            >
              <option value="">All merchants</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by branch"
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Period from"
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              type="date"
              value={periodFrom}
              onChange={(event) => setPeriodFrom(event.target.value)}
            />
            <input
              aria-label="Period to"
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              type="date"
              value={periodTo}
              onChange={(event) => setPeriodTo(event.target.value)}
            />
          </div>
        </div>
        {error ? (
          <RequestError
            className="mt-5"
            message={error}
            onRetry={() => void load()}
          />
        ) : null}
        {loading ? (
          <ListSkeleton label="Loading settlements" rowClassName="h-16" />
        ) : page?.items.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="p-3">Merchant</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3">Period</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Net sales</th>
                  <th className="p-3 text-right">Deductions</th>
                  <th className="p-3 text-right">Amount due</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {page.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-bold">{item.merchant.name}</td>
                    <td className="p-3">
                      {item.branches.length
                        ? item.branches.map((branch) => branch.name).join(', ')
                        : 'No activity'}
                    </td>
                    <td className="p-3">
                      {item.periodStart.slice(0, 10)} –{' '}
                      {item.periodEnd.slice(0, 10)}
                    </td>
                    <td className="p-3">{labels[item.status]}</td>
                    <td className="p-3 text-right tabular-nums">
                      {money.format(Number(item.netSales))}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {money.format(
                        Number(item.commissionAmount) +
                          Number(item.fixedRentAmount) -
                          Number(item.adjustmentTotal),
                      )}
                    </td>
                    <td className="p-3 text-right font-bold tabular-nums">
                      {money.format(Number(item.netPayout))}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        className="font-bold text-emerald-700"
                        href={`/app/organizations/${organizationId}/settlements/${item.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-slate-500">
            No settlements match these filters.
          </p>
        )}
      </section>
    </section>
  );
}

function payableMetrics(items: LiveMerchantPayable[]): SettlementMetrics {
  const sum = (field: keyof LiveMerchantPayable) =>
    items.reduce((total, item) => total + Number(item[field]), 0).toFixed(2);
  return {
    grossSales: sum('grossSales'),
    refunds: sum('refundTotal'),
    netSales: sum('netSales'),
    deductions: items
      .reduce(
        (total, item) =>
          total +
          Number(item.commissionAmount) +
          Number(item.fixedRentAmount) -
          Number(item.adjustmentTotal),
        0,
      )
      .toFixed(2),
    amountDue: sum('amountDue'),
    count: items.length,
  };
}
