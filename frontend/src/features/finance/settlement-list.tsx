'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import {
  generateOffCycleSettlement,
  generateMissingSettlements,
  getSettlementSummary,
  listSettlements,
} from './settlement-api';
import type {
  SettlementMetrics,
  SettlementPage,
  SettlementStatus,
} from './settlement.types';

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
    : 'The settlements could not be loaded.';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [catchingUp, setCatchingUp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        merchantId: merchantId || undefined,
        branchId: branchId || undefined,
        status: (status || undefined) as SettlementStatus | undefined,
        periodFrom: periodFrom || undefined,
        periodTo: periodTo || undefined,
        limit: 100,
      };
      const [result, summary] = await Promise.all([
        listSettlements(request, organizationId, filters),
        getSettlementSummary(request, organizationId, filters),
      ]);
      setPage(result);
      setMetrics(summary);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
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
    let active = true;
    const filters = {
      merchantId: merchantId || undefined,
      branchId: branchId || undefined,
      status: (status || undefined) as SettlementStatus | undefined,
      periodFrom: periodFrom || undefined,
      periodTo: periodTo || undefined,
      limit: 100,
    };
    void Promise.all([
      listSettlements(request, organizationId, filters),
      getSettlementSummary(request, organizationId, filters),
    ])
      .then(([result, summary]) => {
        if (active) {
          setPage(result);
          setMetrics(summary);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(message(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
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
    if (merchantsStatus === 'idle') void loadMerchants().catch(() => undefined);
  }, [loadMerchants, merchantsStatus]);
  useEffect(() => {
    if (branchesStatus === 'idle') void loadBranches().catch(() => undefined);
  }, [branchesStatus, loadBranches]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setError(null);
    try {
      await generateOffCycleSettlement(request, organizationId, {
        merchantId: String(form.get('merchantId')),
        periodStart: String(form.get('periodStart')),
        periodEnd: String(form.get('periodEnd')),
        reason: String(form.get('reason')).trim(),
      });
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setCreating(false);
    }
  }

  async function catchUp() {
    setCatchingUp(true);
    setError(null);
    setNotice(null);
    try {
      const result = await generateMissingSettlements(request, organizationId);
      setNotice(
        `${result.generated} missing draft${result.generated === 1 ? '' : 's'} generated${result.skipped ? `; ${result.skipped} skipped` : ''}.`,
      );
      await load();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setCatchingUp(false);
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
        title="Settlements"
        description="Calculate merchant obligations, review deductions, approve them, and record payouts."
      />
      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="font-bold">Automatic settlement generation</h2>
          <p className="mt-1 text-sm text-slate-500">
            Closed periods are generated automatically from each merchant
            agreement.
          </p>
        </div>
        {organization.role === 'OWNER' ? (
          <button
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-700 disabled:opacity-60"
            disabled={catchingUp}
            type="button"
            onClick={() => void catchUp()}
          >
            {catchingUp ? 'Checking…' : 'Generate missing drafts'}
          </button>
        ) : null}
      </section>
      {notice ? (
        <p
          className="mt-3 text-sm font-semibold text-emerald-700"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <form
        className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-4"
        onSubmit={create}
      >
        <h2 className="md:col-span-4 text-base font-bold">
          Create off-cycle settlement
        </h2>
        <Field label="Merchant">
          <select
            className="min-h-11 rounded-lg border border-slate-300 px-3"
            name="merchantId"
            required
          >
            <option value="">Select merchant</option>
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Period start">
          <input
            className="min-h-11 rounded-lg border border-slate-300 px-3"
            name="periodStart"
            type="date"
            required
          />
        </Field>
        <Field label="Period end">
          <input
            className="min-h-11 rounded-lg border border-slate-300 px-3"
            name="periodEnd"
            type="date"
            required
          />
        </Field>
        <Field label="Reason">
          <input
            className="min-h-11 rounded-lg border border-slate-300 px-3"
            name="reason"
            placeholder="Why is this exceptional settlement needed?"
            required
          />
        </Field>
        <button
          className="min-h-11 self-end rounded-lg bg-emerald-600 px-4 font-bold text-white disabled:opacity-60"
          disabled={creating}
          type="submit"
        >
          {creating ? 'Creating…' : 'Create off-cycle draft'}
        </button>
      </form>
      {metrics ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Net sales', metrics.netSales],
            ['Refunds', metrics.refunds],
            ['Deductions', metrics.deductions],
            ['Amount due', metrics.amountDue],
            ['Settlements', String(metrics.count)],
          ].map(([label, value]) => (
            <div
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={label}
            >
              <p className="text-xs font-bold uppercase text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-xl font-bold">
                {label === 'Settlements' ? value : money.format(Number(value))}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      {children}
    </label>
  );
}
