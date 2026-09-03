'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Branch } from '@/features/branches/branch.types';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import type { Product } from '@/features/products/product.types';
import { listInventoryMovements } from './inventory-api';
import type {
  InventoryMovement,
  InventoryMovementFilters,
  InventoryMovementPage,
  InventoryMovementType,
} from './inventory.types';

const PAGE_SIZE = 25;
const dateTime = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});
const fieldClass =
  'min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5';

function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'Movement history could not be loaded. Please try again.';
}

export function InventoryMovementHistory({
  organizationId,
  products,
  branches,
  hidden,
  refreshKey,
}: {
  organizationId: string;
  products: Product[];
  branches: Branch[];
  hidden: boolean;
  refreshKey: number;
}) {
  const { request } = useAuth();
  const [page, setPage] = useState<InventoryMovementPage>({
    items: [],
    nextCursor: null,
  });
  const [filters, setFilters] = useState<InventoryMovementFilters>({
    limit: PAGE_SIZE,
  });
  const [branchId, setBranchId] = useState('');
  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState<InventoryMovementType | ''>(
    '',
  );
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  const loadedVersionRef = useRef<number | null>(null);
  const refreshKeyRef = useRef(refreshKey);
  const filterInitialized = useRef(false);
  const movementRequestId = useRef(0);

  useEffect(() => {
    refreshKeyRef.current = refreshKey;
  }, [refreshKey]);

  const load = useCallback(
    async (
      next: InventoryMovementFilters,
      stack?: Array<string | undefined>,
    ): Promise<void> => {
      const requestId = ++movementRequestId.current;
      setIsLoading(true);
      setError(null);
      setFilters(next);
      filtersRef.current = next;
      try {
        const result = await listInventoryMovements(
          request,
          organizationId,
          next,
        );
        if (requestId !== movementRequestId.current) return;
        setPage(result);
        loadedVersionRef.current = refreshKeyRef.current;
        if (stack) setCursorStack(stack);
      } catch (cause: unknown) {
        if (requestId === movementRequestId.current) setError(message(cause));
      } finally {
        if (requestId === movementRequestId.current) setIsLoading(false);
      }
    },
    [organizationId, request],
  );

  useEffect(() => {
    if (hidden || loadedVersionRef.current === refreshKey) return;
    let active = true;
    const requestId = ++movementRequestId.current;
    void listInventoryMovements(request, organizationId, filtersRef.current)
      .then((result) => {
        if (active && requestId === movementRequestId.current) {
          setPage(result);
          loadedVersionRef.current = refreshKey;
        }
      })
      .catch((cause: unknown) => {
        if (active && requestId === movementRequestId.current)
          setError(message(cause));
      })
      .finally(() => {
        if (active && requestId === movementRequestId.current)
          setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hidden, organizationId, refreshKey, request]);

  useEffect(() => {
    if (hidden) return;
    if (!filterInitialized.current) {
      filterInitialized.current = true;
      return;
    }
    const next: InventoryMovementFilters = {
      branchId: branchId || undefined,
      productId: productId || undefined,
      type: movementType || undefined,
      limit: PAGE_SIZE,
    };
    void load(next, [undefined]);
  }, [branchId, hidden, load, movementType, productId]);

  function nextPage(): void {
    if (!page.nextCursor) return;
    const stack = [...cursorStack, page.nextCursor];
    void load({ ...filters, cursor: page.nextCursor }, stack);
  }

  function previousPage(): void {
    if (cursorStack.length <= 1) return;
    const stack = cursorStack.slice(0, -1);
    const cursor = stack.at(-1);
    void load({ ...filters, cursor }, stack);
  }

  return (
    <section
      className={`${hidden ? 'hidden' : ''} mt-6 rounded-xl border border-slate-200 bg-white p-6`}
      aria-hidden={hidden || undefined}
    >
      <div>
        <h2 className="text-base font-bold">Movement history</h2>
        <p className="mt-2 text-sm text-slate-500">
          Every stock-in and explained adjustment, newest first.
        </p>
      </div>
      <div className="mt-6 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(10rem,1fr))_auto]">
        <Filter label="Branch" id="movement-branch">
          <SelectControl
            className={fieldClass}
            id="movement-branch"
            value={branchId}
            onValueChange={setBranchId}
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </SelectControl>
        </Filter>
        <Filter label="Product" id="movement-product">
          <SelectControl
            className={fieldClass}
            id="movement-product"
            value={productId}
            onValueChange={setProductId}
          >
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </SelectControl>
        </Filter>
        <Filter label="Movement type" id="movement-type">
          <SelectControl
            className={fieldClass}
            id="movement-type"
            value={movementType}
            onValueChange={(value) =>
              setMovementType(value as InventoryMovementType | '')
            }
          >
            <option value="">All types</option>
            <option value="STOCK_IN">Stock-in</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </SelectControl>
        </Filter>
        {isLoading ? (
          <span
            className="pb-3 text-sm font-semibold text-slate-500"
            role="status"
          >
            Updating…
          </span>
        ) : null}
      </div>
      {error ? (
        <RequestError
          className="mt-5 rounded-lg border border-red-600 p-3 text-sm text-red-600"
          message={error}
          onRetry={() => void load(filters)}
        />
      ) : null}
      {isLoading ? (
        <ListSkeleton label="Loading movement history" rowClassName="h-24" />
      ) : page.items.length === 0 ? (
        <div className="py-10 text-center">
          <h3 className="text-base font-bold">No movements found</h3>
          <p className="mt-2 text-slate-500">
            Stock-in and adjustment activity will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-5 list-none p-0">
          {page.items.map((movement) => (
            <MovementRow key={movement.id} movement={movement} />
          ))}
        </ul>
      )}
      {!isLoading && (cursorStack.length > 1 || page.nextCursor) ? (
        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5">
          <p className="text-sm text-slate-500">Page {cursorStack.length}</p>
          <div className="flex gap-2">
            <button
              className="min-h-10 rounded-[0.6rem] border border-slate-200 bg-white px-3 font-bold disabled:opacity-50"
              disabled={cursorStack.length <= 1}
              onClick={previousPage}
            >
              Previous
            </button>
            <button
              className="min-h-10 rounded-[0.6rem] border border-slate-200 bg-white px-3 font-bold disabled:opacity-50"
              disabled={!page.nextCursor}
              onClick={nextPage}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MovementRow({ movement }: { movement: InventoryMovement }) {
  const positive = movement.quantityChange > 0;
  return (
    <li className="grid gap-3 border-b border-slate-200 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <strong>{movement.product.name}</strong>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            {movement.product.sku}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            {movement.type === 'STOCK_IN' ? 'Stock-in' : 'Adjustment'}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {movement.branch.name} · {movement.createdBy.email}
        </p>
        {movement.note ? (
          <p className="mt-2 text-sm text-slate-700">{movement.note}</p>
        ) : null}
        {movement.referenceId ? (
          <p className="mt-1 text-xs text-slate-500">
            Reference: {movement.referenceId}
          </p>
        ) : null}
      </div>
      <div className="text-left sm:text-right">
        <strong className={positive ? 'text-emerald-700' : 'text-red-600'}>
          {positive ? '+' : ''}
          {movement.quantityChange}
        </strong>
        <time
          className="mt-1 block text-xs text-slate-500"
          dateTime={movement.createdAt}
        >
          {dateTime.format(new Date(movement.createdAt))}
        </time>
      </div>
    </li>
  );
}

function Filter({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
