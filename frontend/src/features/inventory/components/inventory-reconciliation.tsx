'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { getInventoryReconciliation } from '../api/inventory-api';
import type {
  InventoryReconciliationPage,
  InventoryScope,
} from '../model/inventory.types';

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
  });
  useEffect(() => {
    const activeGeneration = generation;
    return () => {
      activeGeneration.current++;
    };
  }, []);

  const load = useCallback(
    async (cursor?: string) => {
      const current = ++generation.current;
      setStarted(true);
      setLoading(true);
      setError(null);
      if (!cursor) setPage({ items: [], nextCursor: null });
      try {
        const result = await getInventoryReconciliation(
          request,
          { organizationId, branchId },
          cursor,
        );
        if (current !== generation.current) return;
        setPage((previous) => ({
          items: cursor ? [...previous.items, ...result.items] : result.items,
          nextCursor: result.nextCursor,
        }));
      } catch (cause) {
        if (current !== generation.current) return;
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status))
          setPage({ items: [], nextCursor: null });
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Stock integrity could not be checked.',
        );
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [request, organizationId, branchId],
  );

  return (
    <OperationalPanel
      id={id}
      variant="open"
      className="data-surface"
      title="Stock integrity"
      description="Compare saved stock with the movement ledger for this branch. This check never changes stock."
      action={
        <button
          type="button"
          className={buttonStyles({ variant: 'quiet' })}
          onClick={() => void load()}
          disabled={loading}
        >
          {started ? 'Run check again' : 'Check stock integrity'}
        </button>
      }
    >
      {!started ? (
        <p className="p-6 text-sm text-muted">
          Run a check when you need to investigate a stock discrepancy.
        </p>
      ) : loading && !page.items.length ? (
        <p className="p-6 text-sm text-muted" role="status">
          Checking stock movements…
        </p>
      ) : error ? (
        <RequestError
          className="p-6"
          message={error}
          onRetry={() =>
            void load(
              page.items.length ? (page.nextCursor ?? undefined) : undefined,
            )
          }
        />
      ) : !page.items.length ? (
        <p className="p-6 text-sm text-muted" role="status">
          No stock/ledger mismatch was found in this branch.
        </p>
      ) : (
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
          {page.nextCursor ? (
            <button
              type="button"
              className={buttonStyles({ variant: 'quiet' })}
              disabled={loading}
              onClick={() => void load(page.nextCursor!)}
            >
              {loading ? 'Loading more…' : 'Load more mismatches'}
            </button>
          ) : null}
        </div>
      )}
    </OperationalPanel>
  );
}
