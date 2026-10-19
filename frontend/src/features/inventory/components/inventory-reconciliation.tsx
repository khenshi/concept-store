'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import { OperationalTableFrame } from '@/shared/components/ui/operational-table';
import { RequestError } from '@/shared/components/ui/request-error';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { getInventoryReconciliation } from '../api/inventory-api';
import type {
  InventoryReconciliationPage,
  InventoryScope,
} from '../model/inventory.types';
import { InventoryTableSkeleton } from './inventory-table-skeleton';

type PageTarget = { index: number; cursor?: string };

export function InventoryReconciliation({
  organizationId,
  branchId,
  id,
}: InventoryScope & { id?: string }) {
  const { request } = useAuth();
  const generation = useRef(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<InventoryReconciliationPage>({
    items: [],
    nextCursor: null,
    totalPages: 0,
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageRetry, setPageRetry] = useState<PageTarget | null>(null);
  useEffect(() => {
    const activeGeneration = generation;
    return () => {
      activeGeneration.current++;
    };
  }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setStarted(true);
    setLoading(true);
    setError(null);
    setPageError(null);
    setPageRetry(null);
    setPage({ items: [], nextCursor: null, totalPages: 0 });
    setPageIndex(0);
    setPageCursors([undefined]);
    try {
      const result = await getInventoryReconciliation(
        request,
        { organizationId, branchId },
        undefined,
      );
      if (current !== generation.current) return;
      setPage(result);
    } catch (cause) {
      if (current !== generation.current) return;
      if (cause instanceof ApiError && [401, 403, 404].includes(cause.status))
        setPage({ items: [], nextCursor: null, totalPages: 0 });
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Stock integrity could not be checked.',
      );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [request, organizationId, branchId]);

  const loadPage = useCallback(
    async (target: PageTarget) => {
      if (pageLoading || target.index < 0) return;
      const current = generation.current;
      setPageLoading(true);
      setPageError(null);
      setPageRetry(target);
      try {
        const result = await getInventoryReconciliation(
          request,
          { organizationId, branchId },
          target.cursor,
        );
        if (current !== generation.current) return;
        setPage(result);
        setPageIndex(target.index);
        setPageCursors((previous) => {
          const next = [...previous];
          next[target.index] = target.cursor;
          return next;
        });
        setPageRetry(null);
      } catch (cause) {
        if (current !== generation.current) return;
        if (
          cause instanceof ApiError &&
          [401, 403, 404].includes(cause.status)
        ) {
          setPage({ items: [], nextCursor: null, totalPages: 0 });
          setError(cause.message);
          setPageRetry(null);
          return;
        }
        setPageError(
          cause instanceof ApiError
            ? cause.message
            : 'This stock-integrity page could not be loaded.',
        );
      } finally {
        if (current === generation.current) setPageLoading(false);
      }
    },
    [request, organizationId, branchId, pageLoading],
  );

  return (
    <OperationalPanel
      id={id}
      className="mt-0"
      title="Stock integrity"
      description="Compare saved stock with the movement ledger for this branch. This check never changes stock."
      action={
        <button
          type="button"
          className={buttonStyles({ variant: 'quiet' })}
          onClick={() => void load()}
          disabled={loading || pageLoading}
        >
          {started ? 'Run check again' : 'Check stock integrity'}
        </button>
      }
    >
      <OperationalTableFrame
        empty={
          started && !loading && !error && !page.items.length ? (
            <EmptyState
              className="mt-6"
              title="No stock/ledger mismatch was found in this branch."
              description="The recorded stock matches the movement ledger."
            />
          ) : undefined
        }
        footer={
          started && !loading && !error ? (
            <>
              {pageError && pageRetry ? (
                <RequestError
                  className="p-6"
                  message={pageError}
                  onRetry={() => void loadPage(pageRetry)}
                />
              ) : null}
              <PaginationControls
                ariaLabel="Stock integrity pagination"
                currentPage={pageIndex + 1}
                totalPages={page.totalPages ?? 0}
                hasNext={Boolean(page.nextCursor)}
                pending={pageLoading}
                onPrevious={() =>
                  void loadPage({
                    index: pageIndex - 1,
                    cursor: pageCursors[pageIndex - 1],
                  })
                }
                onNext={() =>
                  void loadPage({
                    index: pageIndex + 1,
                    cursor: page.nextCursor ?? undefined,
                  })
                }
              />
            </>
          ) : undefined
        }
      >
        {!started ? (
          <p className="p-6 text-sm text-muted">
            Run a check when you need to investigate a stock discrepancy.
          </p>
        ) : loading && !page.items.length ? (
          <InventoryTableSkeleton
            variant="integrity"
            label="Checking stock movements"
          />
        ) : error ? (
          <RequestError
            className="p-6"
            message={error}
            onRetry={() => void load()}
          />
        ) : page.items.length ? (
          <div className="p-6">
            <p className="text-sm text-muted" role="status">
              {page.items.length} mismatched{' '}
              {page.items.length === 1 ? 'placement' : 'placements'} found.
              Investigate before making any stock correction.
            </p>
            <ul
              aria-label="Stock integrity mismatches"
              className="mt-4 list-none p-0"
            >
              <li className="data-column-header hidden grid-cols-[minmax(0,1.4fr)_minmax(13rem,auto)] gap-x-6 gap-y-3 sm:grid">
                <span>Product</span>
                <span>Recorded difference</span>
              </li>
              {page.items.map((item) => (
                <li
                  key={item.inventoryId}
                  className="data-row grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(13rem,auto)] sm:items-center"
                >
                  <Link
                    className="min-w-0 break-words font-semibold text-ink underline"
                    href={`/app/organizations/${organizationId}/branches/${branchId}/inventory/${item.inventoryId}`}
                  >
                    {item.productName}
                  </Link>
                  <span className="text-sm tabular-nums sm:text-right">
                    Saved {item.recordedQuantity.toLocaleString()} · Ledger{' '}
                    {item.ledgerQuantity} · Difference {item.difference}
                  </span>
                  <span className="text-xs text-muted sm:col-span-2">
                    SKU {item.sku ?? 'not set'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </OperationalTableFrame>
    </OperationalPanel>
  );
}
