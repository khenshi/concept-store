'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { listSales } from './pos-api';
import { PosNavigation } from './pos-navigation';
import type { PaymentMethod, SaleFilters, SalePage } from './pos.types';

const PAGE_SIZE = 25;
const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const dateTime = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  GCASH: 'GCash',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other',
};

function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'Sales history could not be loaded. Please try again.';
}

function startOfDay(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

function endOfDay(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

export function SalesHistory({
  organizationId,
  initialBranchId,
}: {
  organizationId: string;
  initialBranchId?: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus, branches, loadBranches } =
    useOrganizationWorkspaceContext();
  const [branchId, setBranchId] = useState('');
  const [page, setPage] = useState<SalePage>({
    items: [],
    total: 0,
    offset: 0,
    limit: PAGE_SIZE,
  });
  const [filters, setFilters] = useState<SaleFilters>({ limit: PAGE_SIZE });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canUsePos =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'CASHIER';

  useEffect(() => {
    if (!canUsePos) return;
    let active = true;
    void loadBranches()
      .then(async (items) => {
        const selectedBranchId = items.some(
          (branch) => branch.id === initialBranchId,
        )
          ? initialBranchId
          : items[0]?.id;
        if (!selectedBranchId) return null;
        const result = await listSales(
          request,
          organizationId,
          selectedBranchId,
          { limit: PAGE_SIZE, offset: 0 },
        );
        return { selectedBranchId, result };
      })
      .then((result) => {
        if (!active || !result) return;
        setBranchId(result.selectedBranchId);
        setPage(result.result);
      })
      .catch((cause: unknown) => {
        if (active) setError(message(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canUsePos, initialBranchId, loadBranches, organizationId, request]);

  async function fetchPage(
    nextBranchId: string,
    nextFilters: SaleFilters,
  ): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      setPage(
        await listSales(request, organizationId, nextBranchId, nextFilters),
      );
      setBranchId(nextBranchId);
      setFilters(nextFilters);
    } catch (cause: unknown) {
      setError(message(cause));
    } finally {
      setIsLoading(false);
    }
  }

  function submitFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextBranchId = String(data.get('branchId') ?? '');
    if (!nextBranchId) return;
    void fetchPage(nextBranchId, {
      search: String(data.get('search') ?? '').trim() || undefined,
      paymentMethod: (String(data.get('paymentMethod') ?? '') || undefined) as
        PaymentMethod | undefined,
      completedFrom: startOfDay(String(data.get('completedFrom') ?? '')),
      completedTo: endOfDay(String(data.get('completedTo') ?? '')),
      offset: 0,
      limit: PAGE_SIZE,
    });
  }

  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading sales history" />;
  if (!organization) return null;
  const from = page.total === 0 ? 0 : page.offset + 1;
  const to = Math.min(page.offset + page.items.length, page.total);

  return (
    <section className="mx-auto mt-5 w-full max-w-[100rem] sm:mt-6">
      <OrganizationPageHeader
        organization={organization}
        title="Point of sale"
        description="Review completed branch sales and open their immutable transaction details."
      />
      <PosNavigation organizationId={organizationId} />
      {!canUsePos ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold text-slate-950">POS access is limited</h2>
        </div>
      ) : (
        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <h2 className="font-bold text-slate-950">Sales history</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {page.total} completed sales in the selected branch
            </p>
          </header>
          <form
            className="grid items-end gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-[repeat(2,minmax(10rem,1fr))_repeat(2,minmax(9rem,0.8fr))_minmax(10rem,0.8fr)_auto]"
            onSubmit={submitFilters}
          >
            <Field label="Search sale number" id="sales-search">
              <input
                className="min-h-11 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3"
                id="sales-search"
                name="search"
                defaultValue={filters.search}
                placeholder="S-..."
              />
            </Field>
            <Field label="Branch" id="sales-branch">
              <SelectControl
                id="sales-branch"
                name="branchId"
                value={branchId}
                onValueChange={(value) =>
                  void fetchPage(value, { limit: PAGE_SIZE, offset: 0 })
                }
              >
                <option value="" disabled>
                  Select a branch
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </SelectControl>
            </Field>
            <Field label="From" id="sales-from">
              <input
                className="min-h-11 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3"
                id="sales-from"
                name="completedFrom"
                type="date"
              />
            </Field>
            <Field label="To" id="sales-to">
              <input
                className="min-h-11 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3"
                id="sales-to"
                name="completedTo"
                type="date"
              />
            </Field>
            <Field label="Payment" id="sales-payment">
              <SelectControl id="sales-payment" name="paymentMethod">
                <option value="">All methods</option>
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </SelectControl>
            </Field>
            <button
              className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-5 font-bold text-white disabled:opacity-60"
              disabled={isLoading || !branchId}
            >
              Apply
            </button>
          </form>
          {error ? (
            <RequestError
              className="p-6"
              message={error}
              onRetry={() => void fetchPage(branchId, filters)}
            />
          ) : isLoading ? (
            <ListSkeleton
              className="p-6"
              label="Loading completed sales"
              rows={5}
            />
          ) : page.items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <h3 className="font-bold text-slate-950">No completed sales</h3>
              <p className="mt-2 text-sm text-slate-500">
                Completed transactions for this branch will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 font-bold">Sale</th>
                    <th className="px-4 py-3 font-bold">Completed</th>
                    <th className="px-4 py-3 font-bold">Cashier</th>
                    <th className="px-4 py-3 font-bold">Payment</th>
                    <th className="px-4 py-3 text-right font-bold">Items</th>
                    <th className="px-4 py-3 text-right font-bold">Total</th>
                    <th className="px-6 py-3">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {page.items.map((sale) => (
                    <tr key={sale.id}>
                      <td className="px-6 py-4 font-bold text-slate-950">
                        {sale.saleNumber}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {dateTime.format(new Date(sale.completedAt))}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {sale.cashier.firstName} {sale.cashier.lastName}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {sale.paymentMethods
                          .map((method) => paymentLabels[method])
                          .join(', ')}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        {sale.itemCount}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-950">
                        {money.format(Number(sale.total))}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          className="font-bold text-emerald-700 underline underline-offset-3"
                          href={`/app/organizations/${organizationId}/pos/sales/${sale.id}?branchId=${encodeURIComponent(branchId)}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <footer className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 sm:px-6">
            <span>
              {from}–{to} of {page.total}
            </span>
            <div className="flex gap-2">
              <button
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:opacity-40"
                type="button"
                disabled={isLoading || page.offset === 0}
                onClick={() =>
                  void fetchPage(branchId, {
                    ...filters,
                    offset: Math.max(0, page.offset - page.limit),
                  })
                }
              >
                Previous
              </button>
              <button
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:opacity-40"
                type="button"
                disabled={
                  isLoading || page.offset + page.items.length >= page.total
                }
                onClick={() =>
                  void fetchPage(branchId, {
                    ...filters,
                    offset: page.offset + page.limit,
                  })
                }
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      )}
    </section>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700" htmlFor={id}>
      {label}
      {children}
    </label>
  );
}
