'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import type { MerchantView } from '@/features/merchants/model/merchant.types';
import { buttonStyles } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPanel,
  OperationalToolbar,
} from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { listMovementRecords } from '../api/inventory-api';
import type {
  InventoryMovementRecordFilters,
  InventoryMovementRecordView,
  InventoryScope,
} from '../model/inventory.types';

type PageTarget = { index: number; cursor?: string };
type MovementType = NonNullable<InventoryMovementRecordFilters['type']>;

const movementTypeLabels: Record<MovementType, string> = {
  RECEIPT: 'Receipt',
  ADJUSTMENT: 'Adjustment',
  SALE: 'Sale',
  RETURN: 'Return',
};

function movementTypeLabel(type: MovementType) {
  return movementTypeLabels[type];
}

const philippineDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZone: 'Asia/Manila',
});

function dateRange(from: string, through: string) {
  if (!from && !through) return {};
  const start = new Date(`${from}T00:00:00.000+08:00`);
  const end = new Date(
    new Date(`${through}T00:00:00.000+08:00`).getTime() + 86400000,
  );
  return { from: start.toISOString(), until: end.toISOString() };
}

function hasFilters(filters: InventoryMovementRecordFilters) {
  return Object.values(filters).some(Boolean);
}

export function InventoryMovementRecords({
  organizationId,
  branchId,
  role,
  merchants,
  onAccessLost,
}: InventoryScope & {
  role: OrganizationRole;
  merchants: MerchantView[];
  onAccessLost(): void;
}) {
  const { request } = useAuth();
  const canWrite = role === 'OWNER' || role === 'MANAGER';
  const [items, setItems] = useState<InventoryMovementRecordView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageRetry, setPageRetry] = useState<PageTarget | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [type, setType] = useState<MovementType | ''>('');
  const [merchantId, setMerchantId] = useState('');
  const [fromDay, setFromDay] = useState('');
  const [throughDay, setThroughDay] = useState('');
  const [appliedDates, setAppliedDates] = useState<{
    from?: string;
    until?: string;
  }>({});
  const [dateError, setDateError] = useState<string | null>(null);
  const [retryRevision, setRetryRevision] = useState(0);
  const generation = useRef(0);
  const scope = { organizationId, branchId };
  const filters: InventoryMovementRecordFilters = {
    q: debouncedSearch.trim() || undefined,
    type: type || undefined,
    merchantId: canWrite ? merchantId || undefined : undefined,
    ...appliedDates,
  };

  useEffect(() => {
    let active = true;
    const current = ++generation.current;
    async function load() {
      await Promise.resolve();
      if (!active || current !== generation.current) return;
      setLoading(true);
      setError(null);
      setPageError(null);
      setPageRetry(null);
      setPageIndex(0);
      setPageCursors([undefined]);
      setItems([]);
      setNextCursor(null);
      try {
        const page = await listMovementRecords(request, scope, role, filters);
        if (!active || current !== generation.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      } catch (cause: unknown) {
        if (!active || current !== generation.current) return;
        if (
          cause instanceof ApiError &&
          [401, 403, 404].includes(cause.status)
        ) {
          onAccessLost();
          return;
        }
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Movement records could not be loaded.',
        );
      } finally {
        if (active && current === generation.current) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
    // The filter object is intentionally represented by its primitive fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    request,
    organizationId,
    branchId,
    role,
    debouncedSearch,
    type,
    merchantId,
    appliedDates,
    retryRevision,
  ]);

  async function loadPage(target: PageTarget) {
    if (pageLoading || target.index < 0) return;
    const current = generation.current;
    setPageLoading(true);
    setPageError(null);
    setPageRetry(target);
    try {
      const page = await listMovementRecords(
        request,
        scope,
        role,
        filters,
        target.cursor,
      );
      if (current !== generation.current) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setPageIndex(target.index);
      setPageCursors((previous) => {
        const next = [...previous];
        next[target.index] = target.cursor;
        return next;
      });
      setPageRetry(null);
    } catch (cause) {
      if (current !== generation.current) return;
      if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) {
        onAccessLost();
        return;
      }
      setPageError(
        cause instanceof ApiError
          ? cause.message
          : 'This movement-records page could not be loaded.',
      );
    } finally {
      if (current === generation.current) setPageLoading(false);
    }
  }

  function applyDateFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromDay && !throughDay) {
      setDateError(null);
      setAppliedDates({});
      return;
    }
    if (!fromDay || !throughDay) {
      setDateError('Choose both a From and Through date.');
      return;
    }
    if (fromDay > throughDay) {
      setDateError('Through date must be on or after From date.');
      return;
    }
    setDateError(null);
    setAppliedDates(dateRange(fromDay, throughDay));
  }

  function clearDateFilter() {
    setFromDay('');
    setThroughDay('');
    setDateError(null);
    setAppliedDates({});
  }

  const grid = canWrite
    ? 'lg:grid-cols-[minmax(15rem,1.4fr)_minmax(10rem,0.85fr)_minmax(8rem,0.7fr)_minmax(12rem,1.1fr)_minmax(7rem,0.65fr)_minmax(8rem,0.7fr)_minmax(11rem,1fr)]'
    : 'lg:grid-cols-[minmax(15rem,1.45fr)_minmax(10rem,0.9fr)_minmax(8rem,0.75fr)_minmax(12rem,1.15fr)_minmax(7rem,0.7fr)_minmax(8rem,0.75fr)]';

  return (
    <OperationalPanel
      id="inventory-movement-records-panel"
      variant="open"
      className="data-surface"
      title="Movement records"
      description="Search and review stock activity recorded in this branch."
    >
      <OperationalToolbar
        variant="open"
        className="grid gap-3 px-0 md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.7fr)_minmax(12rem,0.8fr)] xl:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.7fr)_minmax(12rem,0.8fr)_minmax(19rem,1.2fr)_auto]"
      >
        <div className="min-w-0">
          <label className="sr-only" htmlFor="movement-record-search">
            Search movement records
          </label>
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
            />
            <input
              id="movement-record-search"
              type="search"
              value={search}
              maxLength={254}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product, SKU, barcode, or reason"
              className="min-h-11 w-full min-w-0 rounded-full border border-control-border bg-surface py-2 pr-4 pl-10 text-sm placeholder:text-muted focus-visible:outline-offset-[-2px]"
            />
          </div>
        </div>
        <div className="min-w-0">
          <label className="sr-only" htmlFor="movement-record-type">
            Movement type
          </label>
          <SelectControl
            id="movement-record-type"
            aria-label="Movement type"
            value={type}
            className="bg-subtle px-4 text-sm font-medium"
            onValueChange={(value) => setType(value as MovementType | '')}
          >
            <option value="">All movement types</option>
            <option value="RECEIPT">Receipts</option>
            <option value="ADJUSTMENT">Adjustments</option>
            <option value="SALE">Sales</option>
            <option value="RETURN">Returns</option>
          </SelectControl>
        </div>
        {canWrite ? (
          <div className="min-w-0">
            <label className="sr-only" htmlFor="movement-record-merchant">
              Merchant
            </label>
            <SelectControl
              id="movement-record-merchant"
              aria-label="Merchant"
              value={merchantId}
              className="bg-subtle px-4 text-sm font-medium"
              onValueChange={setMerchantId}
            >
              <option value="">All merchants</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </SelectControl>
          </div>
        ) : null}
        <form
          className="grid min-w-0 grid-cols-2 gap-2 md:col-span-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end md:gap-3 xl:col-span-1"
          onSubmit={applyDateFilter}
        >
          <label className="min-w-0 text-xs font-medium text-muted">
            From (PH)
            <input
              type="date"
              value={fromDay}
              onChange={(event) => setFromDay(event.target.value)}
              aria-invalid={Boolean(dateError)}
              className="mt-1 min-h-11 w-full min-w-0 rounded-full border border-control-border bg-surface px-3 text-sm text-ink"
            />
          </label>
          <label className="min-w-0 text-xs font-medium text-muted">
            Through (PH)
            <input
              type="date"
              value={throughDay}
              onChange={(event) => setThroughDay(event.target.value)}
              aria-invalid={Boolean(dateError)}
              className="mt-1 min-h-11 w-full min-w-0 rounded-full border border-control-border bg-surface px-3 text-sm text-ink"
            />
          </label>
          {dateError ? (
            <p
              className="col-span-2 text-xs text-danger md:col-span-3"
              role="alert"
            >
              {dateError}
            </p>
          ) : null}
          <div className="col-span-2 flex items-center gap-2 md:col-span-1">
            <button
              type="submit"
              className={buttonStyles({
                variant: 'secondary',
                className: 'shrink-0',
              })}
            >
              Apply dates
            </button>
            <button
              type="button"
              className={buttonStyles({
                variant: 'quiet',
                className: 'shrink-0',
              })}
              onClick={clearDateFilter}
            >
              Clear dates
            </button>
          </div>
        </form>
      </OperationalToolbar>
      {loading ? (
        <ListSkeleton
          rows={5}
          rowClassName="h-16"
          className="mt-0 px-4"
          label="Loading movement records"
        />
      ) : error ? (
        <RequestError
          message={error}
          onRetry={() => setRetryRevision((value) => value + 1)}
        />
      ) : !items.length ? (
        <p className="px-4 py-10 text-sm text-muted sm:px-6">
          {hasFilters(filters)
            ? 'No movement records match these filters.'
            : 'No movement records have been recorded for this branch yet.'}
        </p>
      ) : (
        <>
          <ol
            aria-label="Branch movement records"
            className="m-0 list-none p-0"
          >
            <li
              className={`data-column-header hidden gap-x-6 gap-y-3 lg:grid ${grid}`}
            >
              <span>Product</span>
              <span>Date & time</span>
              <span>Type</span>
              <span>Reason</span>
              <span>Change</span>
              <span>Balance</span>
              {canWrite ? <span>Actor</span> : null}
            </li>
            {items.map((movement) => (
              <li
                key={movement.id}
                className={`data-row grid min-w-0 gap-x-6 gap-y-3 px-3 py-4 sm:px-4 lg:items-center ${grid}`}
              >
                <Link
                  className="min-w-0 text-sm font-semibold text-ink underline-offset-3 hover:underline"
                  href={`/app/organizations/${organizationId}/branches/${branchId}/inventory/${movement.branchInventoryId}`}
                >
                  <span className="block truncate">
                    {movement.product.name}
                  </span>
                  <span className="mt-1 block truncate text-xs font-normal text-muted">
                    {movement.product.sku ?? 'SKU not set'} ·{' '}
                    {movement.product.merchant.name}
                  </span>
                </Link>
                <time
                  className="text-sm text-muted"
                  dateTime={movement.createdAt}
                >
                  {philippineDateTimeFormatter.format(
                    new Date(movement.createdAt),
                  )}{' '}
                  <span className="text-xs">(PH)</span>
                </time>
                <span className="text-sm font-medium">
                  {movementTypeLabel(movement.type)}
                </span>
                <span className="min-w-0 break-words text-sm">
                  {movement.reason}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    movement.quantityChange > 0
                      ? 'text-success-ink'
                      : movement.quantityChange < 0
                        ? 'text-danger'
                        : 'text-muted'
                  }`}
                >
                  {movement.quantityChange > 0 ? '+' : ''}
                  {movement.quantityChange.toLocaleString()} units
                </span>
                <span className="text-sm tabular-nums">
                  {movement.quantityAfter.toLocaleString()} units
                </span>
                {canWrite && 'actorName' in movement ? (
                  <span className="min-w-0 break-words text-sm text-muted">
                    {movement.actorName}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          {pageError && pageRetry ? (
            <RequestError
              className="p-6"
              message={pageError}
              onRetry={() => void loadPage(pageRetry)}
            />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-4 sm:px-6">
            <p className="text-sm text-muted">Page {pageIndex + 1}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={buttonStyles({ variant: 'quiet' })}
                disabled={pageLoading || pageIndex === 0}
                onClick={() =>
                  void loadPage({
                    index: pageIndex - 1,
                    cursor: pageCursors[pageIndex - 1],
                  })
                }
              >
                Previous
              </button>
              <button
                type="button"
                className={buttonStyles({ variant: 'secondary' })}
                disabled={pageLoading || !nextCursor}
                onClick={() =>
                  void loadPage({
                    index: pageIndex + 1,
                    cursor: nextCursor ?? undefined,
                  })
                }
              >
                {pageLoading ? 'Loading…' : 'Next'}
              </button>
            </div>
          </div>
        </>
      )}
    </OperationalPanel>
  );
}
