'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { BackLink } from '@/shared/components/ui/back-link';
import { Button, buttonStyles } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { TextField } from '@/shared/components/ui/text-field';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import type { PosScope } from '@/features/pos/model/pos.types';
import { listCashiers, listSales } from '../api/sales-api';
import {
  salesQuerySchema,
  type SalesQuery,
  type CashierOption,
} from '../model/sales.schemas';
import { salesDateRangeSchema, salesUtcRange } from '../model/sales-date-range';
import { SalesAccess } from './sales-access';
import { SalesBranchSelector } from './sales-branch-selector';

export function BranchSales(
  props: PosScope & { embedded?: boolean; active?: boolean },
) {
  return (
    <SalesAccess organizationId={props.organizationId}>
      {(role, key) => (
        <ScopedBranchSales
          key={`${key}:${props.branchId}`}
          {...props}
          role={role}
        />
      )}
    </SalesAccess>
  );
}

function ScopedBranchSales({
  organizationId,
  branchId,
  role,
  embedded = false,
  active: visible = true,
}: PosScope & {
  role: OrganizationRole;
  embedded?: boolean;
  active?: boolean;
}) {
  if (role === 'MERCHANT')
    return (
      <MerchantBranchSales
        organizationId={organizationId}
        branchId={branchId}
        embedded={embedded}
        visible={visible}
      />
    );
  return (
    <StaffBranchSales
      organizationId={organizationId}
      branchId={branchId}
      role={role}
      embedded={embedded}
      visible={visible}
    />
  );
}

function StaffBranchSales({
  organizationId,
  branchId,
  role,
  embedded,
  visible,
}: PosScope & {
  role: 'OWNER' | 'MANAGER' | 'CASHIER';
  embedded: boolean;
  visible: boolean;
}) {
  const { request } = useAuth();
  const [result, setResult] = useState<Extract<
    Awaited<ReturnType<typeof listSales>>,
    { kind: 'staff' }
  > | null>(null);
  const [cashiers, setCashiers] = useState<CashierOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState<SalesQuery>({ page: 1, limit: 10 });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [cashierId, setCashierId] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<SalesQuery['paymentMethod']>();
  const [fromDay, setFromDay] = useState('');
  const [throughDay, setThroughDay] = useState('');
  const [filterError, setFilterError] = useState<string>();

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setResult(null);
      setError(null);
      if (!visible || search.trim() !== debouncedSearch.trim()) return;
      try {
        const response = await listSales(
          request,
          { organizationId, branchId },
          role,
          { ...query, q: debouncedSearch.trim() || undefined },
        );
        if (response.kind !== 'staff')
          throw new Error('Staff sales response is inconsistent.');
        if (active) setResult(response);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Sales could not be loaded. Access may have changed; retry this read.',
          );
      }
    });
    return () => {
      active = false;
    };
  }, [
    request,
    organizationId,
    branchId,
    role,
    query,
    revision,
    search,
    debouncedSearch,
    visible,
  ]);

  useEffect(() => {
    let active = true;
    if (!visible) return;
    void listCashiers(request, { organizationId, branchId })
      .then((options) => {
        if (active) setCashiers(options);
      })
      .catch(() => {
        if (active) setCashiers([]);
      });
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, revision, visible]);

  function updateQuery(patch: Partial<SalesQuery>) {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  }

  function applyDates() {
    const parsed = salesDateRangeSchema.safeParse({ fromDay, throughDay });
    if (!parsed.success) {
      setFilterError(parsed.error.issues[0]?.message);
      return;
    }
    setFilterError(undefined);
    const range = salesUtcRange(parsed.data);
    setQuery((current) => ({ ...current, ...range, page: 1 }));
  }

  function clearDates() {
    setFromDay('');
    setThroughDay('');
    setFilterError(undefined);
    setQuery((current) => ({
      ...current,
      from: undefined,
      until: undefined,
      page: 1,
    }));
  }

  const page = result?.page;
  const hasFilters = Boolean(
    debouncedSearch.trim() ||
    query.cashierId ||
    query.paymentMethod ||
    query.from ||
    query.until,
  );
  const grid =
    'lg:grid-cols-[minmax(0,1.1fr)_minmax(9rem,0.9fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_minmax(8rem,0.7fr)_minmax(9rem,auto)]';

  return (
    <OperationalPage>
      {!embedded ? (
        <>
          <BackLink
            href={`/app/organizations/${organizationId}/branches/${branchId}`}
          >
            Back to branch
          </BackLink>
          <PageHeader
            title="Branch sales"
            description={
              role === 'CASHIER'
                ? 'Your completed sales in this assigned branch.'
                : 'Completed sales in this permitted branch.'
            }
          />
        </>
      ) : null}
      <OperationalPanel
        variant="open"
        className="data-surface"
        title="Sales history"
        description={`${role === 'CASHIER' ? 'Your completed sales in this assigned branch. ' : ''}Newest completion first. Amounts and names are saved transaction snapshots.`}
        action={
          <Button
            variant="quiet"
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh sales
          </Button>
        }
      >
        <form
          noValidate
          className="grid min-w-0 gap-3 border-b border-hairline px-4 py-4 sm:px-6 sm:py-5"
          onSubmit={(event) => {
            event.preventDefault();
            applyDates();
          }}
        >
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,0.7fr)_minmax(10rem,0.65fr)]">
            <div className="relative min-w-0">
              <label
                className="block text-xs font-medium text-muted"
                htmlFor="sales-search"
              >
                Search
              </label>
              <div className=" relative mt-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  id="sales-search"
                  type="search"
                  maxLength={254}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setQuery((current) =>
                      current.page === 1 ? current : { ...current, page: 1 },
                    );
                  }}
                  placeholder="Search receipt code"
                  className="min-h-11 w-full min-w-0 rounded-full border border-control-border bg-surface py-2 pr-4 pl-10 text-sm placeholder:text-muted focus-visible:border-focus"
                />
              </div>
            </div>
            <div className="min-w-0">
              <label
                className="block text-xs font-medium text-muted"
                htmlFor="sales-cashier"
              >
                Cashier
              </label>
              <SelectControl
                id="sales-cashier"
                aria-label="Cashier"
                className="rounded-full bg-surface px-4 text-sm font-medium mt-1"
                value={cashierId}
                onValueChange={(value) => {
                  setCashierId(value);
                  updateQuery({ cashierId: value || undefined });
                }}
              >
                <option value="">All cashiers</option>
                {cashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>
                    {cashier.name}
                  </option>
                ))}
              </SelectControl>
            </div>
            <div className="min-w-0">
              <label
                className="block text-xs font-medium text-muted"
                htmlFor="sales-payment-method"
              >
                Payment method
              </label>
              <SelectControl
                id="sales-payment-method"
                aria-label="Payment method"
                className="rounded-full bg-surface px-4 text-sm font-medium mt-1"
                value={paymentMethod ?? ''}
                onValueChange={(value) => {
                  const next = (value ||
                    undefined) as SalesQuery['paymentMethod'];
                  setPaymentMethod(next);
                  updateQuery({ paymentMethod: next });
                }}
              >
                <option value="">All payment methods</option>
                <option value="CASH">Cash</option>
                <option value="GCASH">GCash</option>
                <option value="CARD">Card</option>
              </SelectControl>
            </div>
          </div>
          <div className="grid min-w-0 items-end gap-3 sm:grid-cols-[minmax(9rem,12rem)_minmax(9rem,12rem)_auto]">
            <label className="min-w-0 text-xs font-medium text-muted">
              <span className="block">From</span>
              <span className="relative mt-1 block">
                <Icon
                  name="calendar"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  type="date"
                  value={fromDay}
                  onChange={(event) => setFromDay(event.target.value)}
                  aria-label="From Date"
                  className="min-h-11 w-full min-w-0 appearance-none rounded-full border border-control-border bg-surface py-2 pr-3 pl-10 text-sm text-muted focus-visible:border-focus"
                />
              </span>
            </label>
            <label className="min-w-0 text-xs font-medium text-muted">
              <span className="block">Through</span>
              <span className="relative mt-1 block">
                <Icon
                  name="calendar"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  type="date"
                  value={throughDay}
                  onChange={(event) => setThroughDay(event.target.value)}
                  aria-label="Through Date"
                  className="min-h-11 w-full min-w-0 appearance-none rounded-full border border-control-border bg-surface py-2 pr-3 pl-10 text-sm text-muted focus-visible:border-focus"
                />
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="secondary"
                className="rounded-full"
              >
                Apply Dates
              </Button>
              <Button
                type="button"
                variant="quiet"
                className="rounded-full"
                onClick={clearDates}
              >
                Clear Dates
              </Button>
            </div>
          </div>
          {filterError ? (
            <p role="alert" className="text-sm text-danger">
              {filterError}
            </p>
          ) : null}
        </form>
        {error ? (
          <RequestError
            className="p-6"
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : !result ? (
          <ListSkeleton className="p-6" label="Loading sales history" />
        ) : !page?.items.length ? (
          <div className="py-10 text-center sm:py-12">
            <h3 className="font-semibold">
              {hasFilters
                ? 'No sales match these filters'
                : 'No completed sales yet'}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {hasFilters
                ? 'Try another receipt code or filter.'
                : role === 'CASHIER'
                  ? 'Your completed sales will appear here.'
                  : 'Completed sales in this branch will appear here.'}
            </p>
          </div>
        ) : (
          <ul aria-label="Sales history" className="m-0 list-none p-0">
            <li
              className={`data-column-header hidden gap-x-6 gap-y-3 lg:grid ${grid}`}
            >
              <span>Date</span>
              <span>Sale Code</span>
              <span>Cashier</span>
              <span>Payment Method</span>
              <span>Amount</span>
              <span>Action</span>
            </li>
            {page.items.map((sale) => (
              <li
                key={sale.id}
                className={`data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:items-center ${grid}`}
              >
                <div className="min-w-0 break-words">
                  <time dateTime={sale.completedAt} className="tabular-nums">
                    <span className="block text-sm font-medium text-ink">
                      {manilaDateFormatter.format(new Date(sale.completedAt))}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted">
                      {manilaTimeFormatter.format(new Date(sale.completedAt))}{' '}
                      (PH)
                    </span>
                  </time>
                </div>
                <span className="min-w-0 break-words text-sm font-medium">
                  {sale.receiptCode}
                </span>
                <span className="min-w-0 break-words text-sm">
                  {sale.cashierName}
                </span>
                <span className="text-sm">
                  {paymentLabel(sale.paymentMethod)}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  Total: PHP {sale.total}
                </span>
                <Link
                  aria-label={`View receipt ${sale.receiptCode}`}
                  className={buttonStyles({
                    variant: 'secondary',
                    className: 'rounded-full',
                  })}
                  href={`/app/organizations/${organizationId}/branches/${branchId}/${embedded ? 'pos/sales' : 'sales'}/${sale.id}`}
                >
                  View Receipt
                  <span className="sr-only"> {sale.receiptCode}</span>
                </Link>
                <span className="sr-only">
                  Cashier: {sale.cashierName} ·{' '}
                  {paymentLabel(sale.paymentMethod)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {result ? (
          <nav
            className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-5 sm:p-6"
            aria-label="Sales pagination"
          >
            <p className="text-sm text-muted">
              {page?.total ?? 0} permitted sales · Page {page?.page ?? 1} of{' '}
              {Math.max(1, page?.totalPages ?? 0)}
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="rounded-full"
                disabled={query.page <= 1}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                Previous page
              </Button>
              <Button
                variant="secondary"
                className="rounded-full"
                disabled={
                  query.page >= (page?.totalPages ?? 0) ||
                  query.page >= 21474836
                }
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                Next page
              </Button>
            </div>
          </nav>
        ) : null}
      </OperationalPanel>
    </OperationalPage>
  );
}

function MerchantBranchSales({
  organizationId,
  branchId,
  embedded,
  visible,
}: PosScope & { embedded: boolean; visible: boolean }) {
  const { request } = useAuth();
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof listSales>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState<SalesQuery>({ page: 1, limit: 50 });
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [filterError, setFilterError] = useState<string>();
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setResult(null);
      setError(null);
      if (!visible) return;
      try {
        const response = await listSales(
          request,
          { organizationId, branchId },
          'MERCHANT',
          query,
        );
        if (response.kind !== 'merchant')
          throw new Error('Merchant sales response is inconsistent.');
        if (active) setResult(response);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Sales could not be loaded. Access may have changed; retry this read.',
          );
      }
    });
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, query, revision, visible]);
  function applyDates() {
    const parsed = salesQuerySchema.safeParse({
      page: 1,
      limit: query.limit,
      ...(from.trim() ? { from: from.trim() } : {}),
      ...(until.trim() ? { until: until.trim() } : {}),
    });
    if (!parsed.success) {
      setFilterError(parsed.error.issues[0]?.message);
      return;
    }
    setFilterError(undefined);
    setQuery(parsed.data);
  }
  const branchName =
    result?.kind === 'merchant' ? result.page.items[0]?.branchName : undefined;
  return (
    <OperationalPage>
      {!embedded ? (
        <>
          <BackLink href={`/app/organizations/${organizationId}/sales`}>
            Back to your selling branches
          </BackLink>
          <PageHeader
            title="Your branch sales"
            description="Only your own product snapshots and own-items subtotal. This is not the whole receipt."
            action={
              <SalesBranchSelector
                organizationId={organizationId}
                branchId={branchId}
              />
            }
          />
        </>
      ) : null}
      <OperationalPanel
        variant="open"
        className="data-surface"
        title={branchName ?? 'Own sales'}
        description="Newest completion first. Amounts and names are saved transaction snapshots."
        action={
          <Button
            variant="quiet"
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh sales
          </Button>
        }
      >
        <form
          noValidate
          className="grid min-w-0 gap-4 border-b border-hairline bg-subtle px-5 py-5 sm:grid-cols-2 sm:px-6 sm:py-6"
          onSubmit={(event) => {
            event.preventDefault();
            applyDates();
          }}
        >
          <TextField
            label="From (UTC, inclusive)"
            placeholder="2026-09-13T00:00:00Z"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            hint="Optional timestamp ending in Z."
          />
          <TextField
            label="Until (UTC, exclusive)"
            placeholder="2026-09-14T00:00:00Z"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            hint="Optional timestamp ending in Z; later than From."
          />
          {filterError ? (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {filterError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <Button type="submit" variant="secondary">
              Apply dates
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setFrom('');
                setUntil('');
                setFilterError(undefined);
                setQuery({ page: 1, limit: query.limit });
              }}
            >
              Clear dates
            </Button>
          </div>
        </form>
        {error ? (
          <RequestError
            className="p-6"
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : !result ? (
          <ListSkeleton className="p-6" label="Loading branch sales" />
        ) : result.kind !== 'merchant' || !result.page.items.length ? (
          <p className="p-6 text-sm text-muted">
            {query.from || query.until
              ? 'No permitted sales in this UTC range.'
              : 'No sales involving your currently linked business in this branch.'}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            <li className="data-column-header hidden grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.8fr)_minmax(10rem,auto)] gap-x-6 gap-y-3 sm:grid">
              <span>Sale</span>
              <span>Amount</span>
              <span>Action</span>
            </li>
            {result.page.items.map((sale) => (
              <li
                key={sale.id}
                className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.8fr)_minmax(10rem,auto)] sm:items-center"
              >
                <div className="min-w-0 break-words">
                  <h2 className="font-semibold">{sale.receiptCode}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {sale.branchName}
                    {sale.branchCode ? ` · ${sale.branchCode}` : ''} ·{' '}
                    <time dateTime={sale.completedAt}>
                      {new Date(sale.completedAt).toLocaleString()}
                    </time>
                  </p>
                </div>
                <p className="font-semibold tabular-nums">
                  Own items subtotal: PHP {sale.ownItemsSubtotal}
                </p>
                <Link
                  aria-label={`View own items ${sale.receiptCode}`}
                  className={buttonStyles({ variant: 'secondary' })}
                  href={`/app/organizations/${organizationId}/branches/${branchId}/sales/${sale.id}`}
                >
                  View own items
                  <span className="sr-only"> {sale.receiptCode}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {result?.kind === 'merchant' ? (
          <nav
            className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-5 sm:p-6"
            aria-label="Sales pagination"
          >
            <p className="text-sm text-muted">
              {result.page.total} permitted sales · Page {result.page.page} of{' '}
              {Math.max(1, result.page.totalPages)}
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                disabled={query.page <= 1}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                Previous page
              </Button>
              <Button
                variant="secondary"
                disabled={
                  query.page >= result.page.totalPages || query.page >= 21474836
                }
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                Next page
              </Button>
            </div>
          </nav>
        ) : null}
      </OperationalPanel>
    </OperationalPage>
  );
}

const manilaDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Manila',
});

const manilaTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZone: 'Asia/Manila',
});

function paymentLabel(method: 'CASH' | 'GCASH' | 'CARD') {
  return method === 'CASH' ? 'Cash' : method === 'GCASH' ? 'GCash' : 'Card';
}
