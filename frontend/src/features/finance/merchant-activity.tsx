'use client';

import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { useAuth } from '@/features/auth/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { getMerchantReport } from '@/features/reports/report-api';
import type { MerchantReport } from '@/features/reports/report.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

export function MerchantActivity({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const { merchants, branches, loadMerchants, loadBranches } =
    useOrganizationWorkspaceContext();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [merchantId, setMerchantId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [report, setReport] = useState<MerchantReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const dateError =
    from && to && from > to
      ? 'The start date must be on or before the end date.'
      : null;

  useEffect(() => {
    void Promise.all([loadMerchants(), loadBranches()]);
  }, [loadBranches, loadMerchants]);
  useEffect(() => {
    if (!from || !to || dateError) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void getMerchantReport(request, organizationId, {
        from,
        to,
        merchantId: merchantId || undefined,
        branchId: branchId || undefined,
        offset: 0,
        limit: 100,
      })
        .then((value) => {
          if (active) setReport(value);
        })
        .catch(() => {
          if (active) setError('Merchant activity could not be loaded.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [
    branchId,
    dateError,
    from,
    merchantId,
    organizationId,
    refreshNonce,
    request,
    to,
  ]);

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-bold">Merchant activity</h2>
      <p className="mt-1 text-sm text-slate-500">
        Sales, deductions, and paid settlements by merchant.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="From">
          <input
            className="min-h-11 rounded-lg border border-slate-200 px-3"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>
        <Field label="To">
          <input
            className="min-h-11 rounded-lg border border-slate-200 px-3"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </Field>
        <Field label="Merchant">
          <SelectControl value={merchantId} onValueChange={setMerchantId}>
            <option value="">All merchants</option>
            {merchants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectControl>
        </Field>
        <Field label="Branch">
          <SelectControl value={branchId} onValueChange={setBranchId}>
            <option value="">All branches</option>
            {branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectControl>
        </Field>
      </div>
      {dateError ? (
        <p className="mt-3 text-sm font-bold text-rose-700" role="alert">
          {dateError}
        </p>
      ) : null}
      {error ? (
        <RequestError
          className="mt-5"
          message={error}
          onRetry={() => {
            setError(null);
            setRefreshNonce((value) => value + 1);
          }}
        />
      ) : loading ? (
        <ListSkeleton label="Loading merchant activity" />
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Merchant</th>
                <th className="p-3 text-right">Gross</th>
                <th className="p-3 text-right">Refunds</th>
                <th className="p-3 text-right">Net sales</th>
                <th className="p-3 text-right">Commission + rent</th>
                <th className="p-3 text-right">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report?.items.map((item) => (
                <tr key={item.id}>
                  <td className="p-3 font-bold">{item.name}</td>
                  <td className="p-3 text-right">
                    {money.format(Number(item.grossSales))}
                  </td>
                  <td className="p-3 text-right">
                    {money.format(Number(item.refunds))}
                  </td>
                  <td className="p-3 text-right">
                    {money.format(Number(item.netSales))}
                  </td>
                  <td className="p-3 text-right">
                    {money.format(
                      Number(item.finalizedCommission) +
                        Number(item.finalizedRent),
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {money.format(Number(item.amountPaid))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report?.items.length === 0 ? (
            <p className="py-8 text-center text-slate-500">
              No merchant activity in this period.
            </p>
          ) : null}
        </div>
      )}
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
