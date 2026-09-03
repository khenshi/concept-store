'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { CheckoutModal, type CheckoutPayment } from './checkout-modal';
import { checkoutSale, listPosProducts, lookupPosProduct } from './pos-api';
import { PosNavigation } from './pos-navigation';
import { SaleCompleteModal } from './sale-complete-modal';
import type {
  PosCartLine,
  PosProduct,
  PosProductPage,
  Sale,
} from './pos.types';

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 350;
const EMPTY_PAGE: PosProductPage = {
  items: [],
  total: 0,
  offset: 0,
  limit: PAGE_SIZE,
};
const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The POS catalog could not be loaded. Please try again.';
}

function amount(value: string, quantity = 1): string {
  return money.format(Number(value) * quantity);
}

export function PosWorkspace({ organizationId }: { organizationId: string }) {
  const { request } = useAuth();
  const {
    organization,
    organizationStatus,
    branches,
    branchesStatus,
    loadBranches,
  } = useOrganizationWorkspaceContext();
  const [branchId, setBranchId] = useState('');
  const [page, setPage] = useState<PosProductPage>(EMPTY_PAGE);
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [quickCode, setQuickCode] = useState('');
  const [quickCodeError, setQuickCodeError] = useState<string | null>(null);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const catalogRequestId = useRef(0);

  const canUsePos =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'CASHIER';

  useEffect(() => {
    if (!canUsePos) return;
    let active = true;
    void loadBranches()
      .then((items) => {
        if (!active) return;
        setBranchId(items[0]?.id ?? '');
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
  }, [canUsePos, loadBranches, organizationId, request]);

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, line) =>
          total + Number(line.product.sellingPrice) * line.quantity,
        0,
      ),
    [cart],
  );

  const searchProducts = useCallback(
    async (normalized: string): Promise<void> => {
      if (!branchId || !normalized) return;
      const requestId = ++catalogRequestId.current;
      setIsLoading(true);
      setError(null);
      try {
        const result = await listPosProducts(
          request,
          organizationId,
          branchId,
          {
            search: normalized,
            limit: PAGE_SIZE,
            offset: 0,
          },
        );
        if (requestId === catalogRequestId.current) setPage(result);
      } catch (cause: unknown) {
        if (requestId === catalogRequestId.current) setError(message(cause));
      } finally {
        if (requestId === catalogRequestId.current) setIsLoading(false);
      }
    },
    [branchId, organizationId, request],
  );

  useEffect(() => {
    const normalized = search.trim();
    if (!branchId || !normalized) return;
    const timeoutId = window.setTimeout(() => {
      void searchProducts(normalized);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [branchId, search, searchProducts]);

  function selectBranch(nextBranchId: string): void {
    catalogRequestId.current += 1;
    setBranchId(nextBranchId);
    setPage(EMPTY_PAGE);
    setIsLoading(false);
    setError(null);
    setSearch('');
  }

  function addProduct(product: PosProduct): void {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) return current;
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  async function quickAddProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId || isQuickAdding) return;
    const code = quickCode.trim();
    if (!code) {
      setQuickCodeError('Enter a SKU or barcode.');
      return;
    }

    setIsQuickAdding(true);
    setQuickCodeError(null);
    try {
      const product = await lookupPosProduct(
        request,
        organizationId,
        branchId,
        code,
      );
      const selectedQuantity =
        cart.find((line) => line.product.id === product.id)?.quantity ?? 0;
      if (!product.available || selectedQuantity >= product.quantity) {
        setQuickCodeError(`${product.name} has no remaining stock to add.`);
        return;
      }
      addProduct(product);
      setQuickCode('');
    } catch (cause: unknown) {
      setQuickCodeError(
        cause instanceof ApiError && cause.status === 404
          ? `No sellable product matches “${code}”.`
          : message(cause),
      );
    } finally {
      setIsQuickAdding(false);
    }
  }

  function changeQuantity(productId: string, change: number): void {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.product.id !== productId) return [line];
        const quantity = line.quantity + change;
        if (quantity <= 0) return [];
        return [
          { ...line, quantity: Math.min(quantity, line.product.quantity) },
        ];
      }),
    );
  }

  async function completeCheckout(payment: CheckoutPayment): Promise<void> {
    if (!checkoutId || !branchId || cart.length === 0) return;
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const sale = await checkoutSale(request, organizationId, branchId, {
        clientTransactionId: checkoutId,
        items: cart.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
        payments: [
          {
            method: payment.method,
            amount: cartTotal.toFixed(2),
            referenceNumber: payment.referenceNumber,
          },
        ],
      });
      setCompletedSale(sale);
      setCheckoutId(null);
      setCart([]);
      catalogRequestId.current += 1;
      setSearch('');
      setPage(EMPTY_PAGE);
      setError(null);
    } catch (cause: unknown) {
      setCheckoutError(message(cause));
    } finally {
      setIsCheckingOut(false);
    }
  }

  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading point of sale" />;
  if (!organization) return null;

  return (
    <section className="mx-auto mt-5 w-full max-w-[100rem] sm:mt-6">
      <OrganizationPageHeader
        organization={organization}
        title="Point of sale"
        description="Build a branch sale from active products and current online inventory."
      />
      <PosNavigation organizationId={organizationId} />
      {!canUsePos ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold text-slate-950">POS access is limited</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Owner, manager, or cashier access is required to use this workspace.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <section className="space-y-4">
            <header className="rounded-xl border border-slate-200 bg-white px-5 py-5 sm:px-6">
              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:w-72">
                Selling branch
                <SelectControl
                  value={branchId}
                  disabled={branchesStatus === 'loading' || cart.length > 0}
                  onValueChange={(value) => void selectBranch(value)}
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
              </label>
            </header>
            <form
              className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-5 py-5 sm:px-6"
              onSubmit={quickAddProduct}
            >
              <label
                className="text-sm font-bold text-slate-800"
                htmlFor="quick-product-code"
              >
                Quick add by SKU or barcode
              </label>
              <div className="mt-2 flex gap-3">
                <input
                  className="min-h-12 min-w-0 flex-1 rounded-[0.6rem] border border-emerald-200 bg-white px-3.5 text-slate-950 outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                  id="quick-product-code"
                  value={quickCode}
                  placeholder="Enter or scan code, then press Enter"
                  autoComplete="off"
                  disabled={!branchId || isQuickAdding}
                  aria-invalid={Boolean(quickCodeError)}
                  aria-describedby={
                    quickCodeError ? 'quick-product-code-error' : undefined
                  }
                  onChange={(event) => {
                    setQuickCode(event.target.value);
                    setQuickCodeError(null);
                  }}
                />
                <button
                  className="min-h-12 rounded-[0.65rem] border-0 bg-emerald-700 px-5 font-bold text-white disabled:opacity-60"
                  type="submit"
                  disabled={!branchId || isQuickAdding}
                >
                  {isQuickAdding ? 'Adding…' : 'Add'}
                </button>
              </div>
              {quickCodeError ? (
                <p
                  className="mt-2 text-sm font-semibold text-rose-700"
                  id="quick-product-code-error"
                  role="alert"
                >
                  {quickCodeError}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-600">
                  Exact matches are added directly to the current sale.
                </p>
              )}
            </form>
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 sm:px-6">
              <label className="block text-sm font-bold text-slate-800">
                Search products
                <div className="mt-2 flex items-center gap-3">
                  <input
                    className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3.5 text-slate-950 outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
                    value={search}
                    placeholder="Product name, SKU, or barcode"
                    disabled={!branchId}
                    onChange={(event) => {
                      const nextSearch = event.target.value;
                      catalogRequestId.current += 1;
                      setSearch(nextSearch);
                      setError(null);
                      if (!nextSearch.trim()) {
                        setPage(EMPTY_PAGE);
                        setIsLoading(false);
                      }
                    }}
                  />
                  {isLoading && search.trim() ? (
                    <span
                      className="shrink-0 text-sm font-semibold text-slate-500"
                      role="status"
                    >
                      Searching…
                    </span>
                  ) : null}
                </div>
              </label>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {error ? (
                <div className="p-5 sm:p-6">
                  <RequestError
                    message={error}
                    onRetry={() => void searchProducts(search.trim())}
                  />
                </div>
              ) : null}
              {isLoading && page.items.length === 0 ? (
                <ListSkeleton label="Loading sellable products" />
              ) : page.items.length === 0 && !search.trim() ? (
                <div className="px-6 py-16 text-center">
                  <h3 className="font-bold text-slate-950">
                    Enter a product search
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    The catalog loads only when you search. For normal checkout,
                    scan or enter a SKU or barcode above to add it directly.
                  </p>
                </div>
              ) : page.items.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <h3 className="font-bold text-slate-950">
                    No sellable products
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Try another search or confirm this branch has available
                    stock.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {page.items.map((product) => {
                    const selected = cart.find(
                      (line) => line.product.id === product.id,
                    );
                    return (
                      <article
                        className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6"
                        key={product.id}
                      >
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-slate-950">
                            {product.name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {product.sku} · {product.merchant.name}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="font-bold text-slate-950">
                            {amount(product.sellingPrice)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {product.quantity} in stock
                          </p>
                        </div>
                        <button
                          className="min-h-11 rounded-[0.6rem] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
                          type="button"
                          disabled={
                            !product.available ||
                            (selected?.quantity ?? 0) >= product.quantity
                          }
                          onClick={() => addProduct(product)}
                        >
                          {selected ? 'Add another' : 'Add to cart'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:sticky xl:top-24">
            <header className="border-b border-slate-200 px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-bold text-slate-950">Current sale</h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  {cart.reduce((total, line) => total + line.quantity, 0)} items
                </span>
              </div>
              {cart.length > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Clear the cart before switching branches.
                </p>
              ) : null}
            </header>
            {cart.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <h3 className="font-bold text-slate-950">The cart is empty</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Add products from the branch catalog to begin a sale.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {cart.map((line) => (
                  <div className="px-5 py-4" key={line.product.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">
                          {line.product.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {amount(line.product.sellingPrice)} each
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-950">
                        {amount(line.product.sellingPrice, line.quantity)}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          className="size-9 rounded-lg border border-slate-200 bg-white font-bold"
                          type="button"
                          aria-label={`Decrease ${line.product.name} quantity`}
                          onClick={() => changeQuantity(line.product.id, -1)}
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-sm font-bold">
                          {line.quantity}
                        </span>
                        <button
                          className="size-9 rounded-lg border border-slate-200 bg-white font-bold disabled:opacity-40"
                          type="button"
                          aria-label={`Increase ${line.product.name} quantity`}
                          disabled={line.quantity >= line.product.quantity}
                          onClick={() => changeQuantity(line.product.id, 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="border-0 bg-transparent text-xs font-bold text-rose-700 underline"
                        type="button"
                        onClick={() =>
                          setCart((current) =>
                            current.filter(
                              (item) => item.product.id !== line.product.id,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <footer className="border-t border-slate-200 bg-slate-50/60 p-5">
              <div className="flex items-center justify-between font-bold text-slate-950">
                <span>Total</span>
                <span>{money.format(cartTotal)}</span>
              </div>
              <button
                className="mt-4 min-h-12 w-full rounded-[0.65rem] border-0 bg-emerald-600 px-4 font-bold text-white disabled:opacity-45"
                type="button"
                disabled={cart.length === 0}
                onClick={() => {
                  setCheckoutError(null);
                  setCheckoutId(crypto.randomUUID());
                }}
              >
                Continue to payment
              </button>
              {cart.length > 0 ? (
                <button
                  className="mt-3 min-h-11 w-full rounded-[0.6rem] border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
                  type="button"
                  onClick={() => setCart([])}
                >
                  Clear cart
                </button>
              ) : null}
            </footer>
          </aside>
        </div>
      )}
      {checkoutId ? (
        <CheckoutModal
          lines={cart}
          total={cartTotal}
          branchName={
            branches.find((branch) => branch.id === branchId)?.name ?? 'branch'
          }
          isSaving={isCheckingOut}
          requestError={checkoutError}
          onClose={() => {
            setCheckoutId(null);
            setCheckoutError(null);
          }}
          onSubmit={completeCheckout}
        />
      ) : null}
      {completedSale ? (
        <SaleCompleteModal
          sale={completedSale}
          onNewSale={() => setCompletedSale(null)}
        />
      ) : null}
    </section>
  );
}
