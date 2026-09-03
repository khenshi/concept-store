'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import {
  FilterField,
  OperationalPage,
  OperationalPanel,
  OperationalToolbar,
} from '@/components/ui/operational-page';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import {
  getInventoryReport,
  getMerchantReport,
  getSalesReport,
} from './report-api';
import type {
  InventoryReport,
  MerchantReport,
  ReportFilters,
  SalesReport,
} from './report.types';

type ReportView = 'sales' | 'inventory' | 'merchants';
const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const date = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

function initialPeriod(): Pick<ReportFilters, 'from' | 'to'> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function ReportsWorkspace({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const {
    organization,
    organizationStatus,
    branches,
    merchants,
    loadBranches,
    loadMerchants,
  } = useOrganizationWorkspaceContext();
  const [view, setView] = useState<ReportView>('sales');
  const [filters, setFilters] = useState<ReportFilters>({
    ...initialPeriod(),
    offset: 0,
    limit: 50,
  });
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [merchantReport, setMerchantReport] = useState<MerchantReport | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const dateError =
    !filters.from || !filters.to
      ? 'Select both a start and end date.'
      : filters.from > filters.to
        ? 'The start date must be on or before the end date.'
        : null;

  useEffect(() => {
    void Promise.all([loadBranches(), loadMerchants()]).catch(() => undefined);
  }, [loadBranches, loadMerchants]);

  useEffect(() => {
    if (dateError) return;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      const pending =
        view === 'sales'
          ? getSalesReport(request, organizationId, filters)
          : view === 'inventory'
            ? getInventoryReport(request, organizationId, filters)
            : getMerchantReport(request, organizationId, filters);
      void pending
        .then((result) => {
          if (!active) return;
          if (view === 'sales') setSales(result as SalesReport);
          if (view === 'inventory') setInventory(result as InventoryReport);
          if (view === 'merchants') setMerchantReport(result as MerchantReport);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'The report could not be loaded.',
          );
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [dateError, filters, organizationId, refreshNonce, request, view]);

  function updateFilters(change: Partial<ReportFilters>) {
    setFilters((current) => ({
      ...current,
      ...change,
      offset: 0,
      limit: 50,
    }));
  }

  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading reports" />;
  if (!organization) return null;
  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';
  const activeReport =
    view === 'sales'
      ? sales
      : view === 'inventory'
        ? inventory
        : merchantReport;

  function movePage(offset: number) {
    setIsLoading(true);
    setError(null);
    setFilters((current) => ({ ...current, offset }));
  }

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Reports"
        description="Review sales attribution, current inventory, and merchant performance from server-authoritative records."
      />
      {!canManage ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Owner or manager access is required to view reports.
        </div>
      ) : (
        <OperationalPanel
          title="Operational reports"
          description="Choose a report and narrow it by period, branch, or merchant."
        >
          <div
            className="flex flex-wrap gap-2 border-b border-slate-200 px-5 py-4 sm:px-6"
            role="tablist"
            aria-label="Reports"
          >
            {(['sales', 'inventory', 'merchants'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                className={`min-h-10 rounded-lg px-4 text-sm font-bold capitalize ${view === item ? 'bg-emerald-700 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
                onClick={() => {
                  setIsLoading(true);
                  setError(null);
                  setView(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          <OperationalToolbar>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
              <FilterField label="From" id="report-from">
                <input
                  className="min-h-11 rounded-lg border border-slate-200 px-3"
                  id="report-from"
                  type="date"
                  value={filters.from}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value || (filters.to && value > filters.to))
                      setIsLoading(false);
                    updateFilters({ from: value });
                  }}
                  required
                />
              </FilterField>
              <FilterField label="To" id="report-to">
                <input
                  className="min-h-11 rounded-lg border border-slate-200 px-3"
                  id="report-to"
                  type="date"
                  value={filters.to}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value || (filters.from && filters.from > value))
                      setIsLoading(false);
                    updateFilters({ to: value });
                  }}
                  required
                />
              </FilterField>
              <FilterField label="Branch" id="report-branch">
                <SelectControl
                  id="report-branch"
                  value={filters.branchId ?? ''}
                  onValueChange={(value) =>
                    updateFilters({ branchId: value || undefined })
                  }
                >
                  <option value="">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </SelectControl>
              </FilterField>
              <FilterField label="Merchant" id="report-merchant">
                <SelectControl
                  id="report-merchant"
                  value={filters.merchantId ?? ''}
                  onValueChange={(value) =>
                    updateFilters({ merchantId: value || undefined })
                  }
                >
                  <option value="">All merchants</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
                </SelectControl>
              </FilterField>
              {isLoading && !dateError ? (
                <span
                  className="pb-3 text-sm font-semibold text-slate-500"
                  role="status"
                >
                  Updating…
                </span>
              ) : null}
              {dateError ? (
                <p
                  className="text-sm font-semibold text-rose-700 md:col-span-2 xl:col-span-5"
                  role="alert"
                >
                  {dateError}
                </p>
              ) : null}
            </div>
          </OperationalToolbar>
          {error ? (
            <div className="p-5 sm:p-6">
              <RequestError
                message={error}
                onRetry={() => {
                  setIsLoading(true);
                  setError(null);
                  setRefreshNonce((current) => current + 1);
                }}
              />
            </div>
          ) : null}
          {isLoading ? <ListSkeleton label={`Loading ${view} report`} /> : null}
          {!isLoading && !error && view === 'sales' && sales ? (
            <SalesTable report={sales} />
          ) : null}
          {!isLoading && !error && view === 'inventory' && inventory ? (
            <InventoryTable report={inventory} />
          ) : null}
          {!isLoading && !error && view === 'merchants' && merchantReport ? (
            <MerchantTable report={merchantReport} />
          ) : null}
          {!isLoading && !error && activeReport && activeReport.total > 0 ? (
            <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4 sm:px-6">
              <p className="text-sm text-slate-500">
                {activeReport.offset + 1}–
                {Math.min(
                  activeReport.offset + activeReport.limit,
                  activeReport.total,
                )}{' '}
                of {activeReport.total}
              </p>
              <div className="flex gap-2">
                <button
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold disabled:opacity-40"
                  type="button"
                  disabled={activeReport.offset === 0}
                  onClick={() =>
                    movePage(
                      Math.max(0, activeReport.offset - activeReport.limit),
                    )
                  }
                >
                  Previous
                </button>
                <button
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold disabled:opacity-40"
                  type="button"
                  disabled={
                    activeReport.offset + activeReport.limit >=
                    activeReport.total
                  }
                  onClick={() =>
                    movePage(activeReport.offset + activeReport.limit)
                  }
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </OperationalPanel>
      )}
    </OperationalPage>
  );
}

function SalesTable({ report }: { report: SalesReport }) {
  return (
    <ReportTable
      headers={[
        'Sale',
        'Product',
        'Merchant / Branch',
        'Gross',
        'Refunds',
        'Net',
      ]}
      empty={report.items.length === 0}
    >
      {report.items.map((row) => (
        <tr className="border-b border-slate-200" key={row.id}>
          <th className="px-4 py-3 text-left">
            <span className="block text-sm">{row.saleNumber}</span>
            <span className="text-xs font-normal text-slate-500">
              {date.format(new Date(row.completedAt))}
            </span>
          </th>
          <td className="px-4 py-3 text-sm">
            {row.productName}
            <span className="block text-xs text-slate-500">
              {row.productSku} · Qty {row.quantity}
            </span>
          </td>
          <td className="px-4 py-3 text-sm">
            {row.merchant.name}
            <span className="block text-xs text-slate-500">
              {row.branch.name}
            </span>
          </td>
          <td className="px-4 py-3 text-sm">
            {money.format(Number(row.grossSales))}
          </td>
          <td className="px-4 py-3 text-sm">
            {money.format(Number(row.refunds))}
          </td>
          <td className="px-4 py-3 text-sm font-bold">
            {money.format(Number(row.netSales))}
          </td>
        </tr>
      ))}
    </ReportTable>
  );
}

function InventoryTable({ report }: { report: InventoryReport }) {
  return (
    <ReportTable
      headers={['Product', 'Merchant', 'Branch', 'Price', 'On hand', 'Status']}
      empty={report.items.length === 0}
    >
      {report.items.map((row) => (
        <tr
          className="border-b border-slate-200"
          key={`${row.productId}-${row.branchId}`}
        >
          <th className="px-4 py-3 text-left text-sm">
            {row.product.name}
            <span className="block text-xs font-normal text-slate-500">
              {row.product.sku}
            </span>
          </th>
          <td className="px-4 py-3 text-sm">{row.product.merchant.name}</td>
          <td className="px-4 py-3 text-sm">{row.branch.name}</td>
          <td className="px-4 py-3 text-sm">
            {money.format(Number(row.product.sellingPrice))}
          </td>
          <td className="px-4 py-3 text-sm font-bold">{row.quantity}</td>
          <td className="px-4 py-3 text-sm">{row.product.status}</td>
        </tr>
      ))}
    </ReportTable>
  );
}

function MerchantTable({ report }: { report: MerchantReport }) {
  return (
    <ReportTable
      headers={[
        'Merchant',
        'Gross',
        'Refunds',
        'Net sales',
        'Commission + rent',
        'Paid',
      ]}
      empty={report.items.length === 0}
    >
      {report.items.map((row) => (
        <tr className="border-b border-slate-200" key={row.id}>
          <th className="px-4 py-3 text-left text-sm">
            {row.name}
            <span className="block text-xs font-normal text-slate-500">
              {row.status}
            </span>
          </th>
          <td className="px-4 py-3 text-sm">
            {money.format(Number(row.grossSales))}
          </td>
          <td className="px-4 py-3 text-sm">
            {money.format(Number(row.refunds))}
          </td>
          <td className="px-4 py-3 text-sm font-bold">
            {money.format(Number(row.netSales))}
          </td>
          <td className="px-4 py-3 text-sm">
            {money.format(
              Number(row.finalizedCommission) + Number(row.finalizedRent),
            )}
          </td>
          <td className="px-4 py-3 text-sm">
            {money.format(Number(row.amountPaid))}
          </td>
        </tr>
      ))}
    </ReportTable>
  );
}

function ReportTable({
  headers,
  empty,
  children,
}: {
  headers: string[];
  empty: boolean;
  children: ReactNode;
}) {
  if (empty)
    return (
      <p className="px-6 py-12 text-center text-sm text-slate-500">
        No report records match these filters.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse">
        <caption className="sr-only">Filtered report results</caption>
        <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
          <tr>
            {headers.map((header) => (
              <th className="px-4 py-3 text-left" key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
