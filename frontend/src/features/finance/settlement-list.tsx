'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { listSettlements, listLivePayables } from './settlement-api';
import type {
  SettlementMetrics,
  LiveMerchantPayable,
  SettlementPage,
  SettlementStatus,
} from './settlement.types';
import { MerchantReceivables } from './merchant-receivables';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const LIVE_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 20;
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
  const [historyOffset, setHistoryOffset] = useState(0);
  const [status, setStatus] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [metrics, setMetrics] = useState<SettlementMetrics | null>(null);
  const [payables, setPayables] = useState<LiveMerchantPayable[]>([]);
  const [liveTotal, setLiveTotal] = useState(0);
  const [liveOffset, setLiveOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<
    'live' | 'history' | 'receivables'
  >('live');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const financeRequestId = useRef(0);
  const historyDateError =
    periodFrom && periodTo && periodFrom > periodTo
      ? 'The start date must be on or before the end date.'
      : null;

  const load = useCallback(async () => {
    const requestId = ++financeRequestId.current;
    setLoading(true);
    try {
      if (activeTab === 'live') {
        setLiveError(null);
        const result = await listLivePayables(request, organizationId, {
          offset: liveOffset,
          limit: LIVE_PAGE_SIZE,
        });
        if (requestId !== financeRequestId.current) return;
        setMetrics(payableMetrics(result.items));
        setPayables(result.items);
        setLiveTotal(result.total);
      } else if (activeTab === 'history') {
        setHistoryError(null);
        const result = await listSettlements(request, organizationId, {
          merchantId: merchantId || undefined,
          branchId: branchId || undefined,
          status: (status || undefined) as SettlementStatus | undefined,
          periodFrom: periodFrom || undefined,
          periodTo: periodTo || undefined,
          offset: historyOffset,
          limit: HISTORY_PAGE_SIZE,
        });
        if (requestId === financeRequestId.current) setPage(result);
      }
    } catch (cause: unknown) {
      if (requestId === financeRequestId.current) {
        if (activeTab === 'live') setLiveError(message(cause));
        if (activeTab === 'history') setHistoryError(message(cause));
      }
    } finally {
      if (requestId === financeRequestId.current) setLoading(false);
    }
  }, [
    activeTab,
    branchId,
    historyOffset,
    liveOffset,
    merchantId,
    organizationId,
    periodFrom,
    periodTo,
    request,
    status,
  ]);

  useEffect(() => {
    if (activeTab === 'history' && historyDateError) return;
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [activeTab, historyDateError, load]);
  useEffect(() => {
    if (activeTab === 'history' && merchantsStatus === 'idle')
      void loadMerchants().catch(() => undefined);
  }, [activeTab, loadMerchants, merchantsStatus]);
  useEffect(() => {
    if (activeTab === 'history' && branchesStatus === 'idle')
      void loadBranches().catch(() => undefined);
  }, [activeTab, branchesStatus, loadBranches]);

  if (!organization)
    return (
      <p className="mt-12" role="status">
        Loading settlements…
      </p>
    );
  return (
    <section className="mx-auto mt-5 w-full sm:mt-6">
      <OrganizationPageHeader
        organization={organization}
        title="Merchant finance"
        description="Monitor live merchant balances, close settlements, approve payouts, and keep a complete financial history."
      />
      <nav
        aria-label="Merchant finance sections"
        className="mt-6 flex gap-1 border-b border-slate-200"
      >
        {[
          ['live', 'Live payables'],
          ['history', 'Settlement history'],
          ['receivables', 'Rent receivables'],
        ].map(([value, label]) => (
          <button
            aria-current={activeTab === value ? 'page' : undefined}
            className={`border-b-2 px-4 py-3 text-sm font-bold ${
              activeTab === value
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
            key={value}
            onClick={() =>
              setActiveTab(value as 'live' | 'history' | 'receivables')
            }
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      {activeTab === 'live' ? (
        <>
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">Live merchant payables</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current unsettled sales as of today. Refunds and agreement
                  deductions are applied automatically.
                </p>
              </div>
              <button
                className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold"
                disabled={loading}
                onClick={() => void load()}
                type="button"
              >
                {loading ? 'Refreshing…' : 'Refresh balances'}
              </button>
            </div>
            {liveError ? (
              <RequestError
                className="mt-5"
                message={liveError}
                onRetry={() => void load()}
              />
            ) : null}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="p-3">Merchant</th>
                    <th className="p-3">Branch</th>
                    <th className="p-3">Period</th>
                    <th className="p-3">Deadline</th>
                    <th className="p-3 text-right">Amount due</th>
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
                              ? 'No financial activity'
                              : item.financeStatus === 'OVERDUE'
                                ? 'Settlement overdue'
                                : 'Live payable'}
                        </p>
                      </td>
                      <td className="p-3">
                        {item.branches
                          .map((branch) => branch.name)
                          .join(', ') || 'No activity'}
                      </td>
                      <td className="p-3">
                        {item.periodStart
                          ? `${item.periodStart} – ${item.asOf}`
                          : 'Starts after agreement activation'}
                      </td>
                      <td className="p-3">
                        {item.nextSettlementDeadline ?? 'Not scheduled'}
                      </td>
                      <td className="p-3 text-right font-bold tabular-nums">
                        {money.format(Number(item.amountDue))}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          className="font-bold text-emerald-700"
                          href={`/app/organizations/${organizationId}/settlements/payables/${item.merchant.id}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!loading && payables.length === 0 ? (
                    <tr>
                      <td
                        className="p-8 text-center text-slate-500"
                        colSpan={6}
                      >
                        No active merchants were returned. Clear the filters or
                        retry loading live payables.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {liveTotal > LIVE_PAGE_SIZE ? (
              <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
                <p className="text-sm text-slate-500">
                  {liveOffset + 1}–
                  {Math.min(liveOffset + LIVE_PAGE_SIZE, liveTotal)} of{' '}
                  {liveTotal} merchants
                </p>
                <div className="flex gap-2">
                  <button
                    className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-40"
                    disabled={liveOffset === 0 || loading}
                    onClick={() =>
                      setLiveOffset((current) =>
                        Math.max(0, current - LIVE_PAGE_SIZE),
                      )
                    }
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-40"
                    disabled={
                      liveOffset + LIVE_PAGE_SIZE >= liveTotal || loading
                    }
                    onClick={() =>
                      setLiveOffset((current) => current + LIVE_PAGE_SIZE)
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>
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
                    {label === 'Merchants'
                      ? value
                      : money.format(Number(value))}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : activeTab === 'history' ? (
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
                onChange={(event) => {
                  financeRequestId.current += 1;
                  setMerchantId(event.target.value);
                  setHistoryOffset(0);
                }}
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
                onChange={(event) => {
                  financeRequestId.current += 1;
                  setStatus(event.target.value);
                  setHistoryOffset(0);
                }}
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
                onChange={(event) => {
                  financeRequestId.current += 1;
                  setBranchId(event.target.value);
                  setHistoryOffset(0);
                }}
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
                onChange={(event) => {
                  const value = event.target.value;
                  financeRequestId.current += 1;
                  if (value && periodTo && value > periodTo) setLoading(false);
                  setPeriodFrom(value);
                  setHistoryOffset(0);
                }}
              />
              <input
                aria-label="Period to"
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                type="date"
                value={periodTo}
                onChange={(event) => {
                  const value = event.target.value;
                  financeRequestId.current += 1;
                  if (periodFrom && value && periodFrom > value)
                    setLoading(false);
                  setPeriodTo(value);
                  setHistoryOffset(0);
                }}
              />
              {loading && !historyDateError ? (
                <span
                  className="self-center text-sm font-semibold text-slate-500"
                  role="status"
                >
                  Updating…
                </span>
              ) : null}
            </div>
          </div>
          {historyDateError ? (
            <p
              className="mt-3 text-sm font-semibold text-rose-700"
              role="alert"
            >
              {historyDateError}
            </p>
          ) : null}
          {historyError ? (
            <RequestError
              className="mt-5"
              message={historyError}
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
                          ? item.branches
                              .map((branch) => branch.name)
                              .join(', ')
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
          {page && page.total > HISTORY_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-500">
                {page.offset + 1}–
                {Math.min(page.offset + page.limit, page.total)} of {page.total}
              </p>
              <div className="flex gap-2">
                <button
                  className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-40"
                  disabled={page.offset === 0 || loading}
                  onClick={() =>
                    setHistoryOffset((current) =>
                      Math.max(0, current - HISTORY_PAGE_SIZE),
                    )
                  }
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold disabled:opacity-40"
                  disabled={page.offset + page.limit >= page.total || loading}
                  onClick={() =>
                    setHistoryOffset((current) => current + HISTORY_PAGE_SIZE)
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <MerchantReceivables organizationId={organizationId} />
      )}
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
