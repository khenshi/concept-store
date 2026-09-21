'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { Product } from '@/features/products/model/product.types';
import { buttonStyles } from '@/shared/components/ui/button';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { RequestError } from '@/shared/components/ui/request-error';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { createPlacement, listEligibleProducts } from '../api/inventory-api';
import { placementInputSchema } from '../model/inventory.schemas';
import type { InventoryScope } from '../model/inventory.types';

export function InventoryPlacementForm({
  scope,
  onSaved,
  onCancel,
  onPendingChange,
}: {
  scope: InventoryScope;
  onSaved(): void;
  onCancel(): void;
  onPendingChange(pending: boolean): void;
}) {
  const { request } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [errors, setErrors] = useState<
    Partial<
      Record<
        'productId' | 'sellingPrice' | 'initialQuantity' | 'lowStockThreshold',
        string
      >
    >
  >({});
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const timers = useRef<
    Partial<
      Record<
        'productId' | 'sellingPrice' | 'initialQuantity' | 'lowStockThreshold',
        number
      >
    >
  >({});
  const readGeneration = useRef(0);
  const q = useDebouncedValue(search);
  const { organizationId, branchId } = scope;
  useEffect(
    () => () => {
      Object.values(timers.current).forEach(window.clearTimeout);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    const generation = ++readGeneration.current;
    async function load() {
      await Promise.resolve();
      if (!active || generation !== readGeneration.current) return;
      setLoading(true);
      setLoadError(null);
      setProducts([]);
      setNextCursor(null);
      setMoreError(null);
      setLoadingMore(false);
      try {
        const page = await listEligibleProducts(
          request,
          { organizationId, branchId },
          q.trim() || undefined,
        );
        if (active && generation === readGeneration.current) {
          setProducts(page.items);
          setNextCursor(page.nextCursor);
        }
      } catch (cause) {
        if (active && generation === readGeneration.current)
          setLoadError(
            cause instanceof ApiError
              ? cause.message
              : 'Available products could not be loaded.',
          );
      } finally {
        if (active && generation === readGeneration.current) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, q, revision]);
  async function loadMore() {
    if (!nextCursor || loading || loadingMore || loadError) return;
    const generation = readGeneration.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listEligibleProducts(
        request,
        { organizationId, branchId },
        q.trim() || undefined,
        nextCursor,
      );
      if (generation !== readGeneration.current) return;
      setProducts((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (generation === readGeneration.current)
        setMoreError(
          cause instanceof ApiError
            ? cause.message
            : 'More available products could not be loaded.',
        );
    } finally {
      if (generation === readGeneration.current) setLoadingMore(false);
    }
  }
  function validate(
    field:
      'productId' | 'sellingPrice' | 'initialQuantity' | 'lowStockThreshold',
    id: string,
    sellingPrice: string,
    lowStockThreshold: string,
    initialQuantity: string,
    immediate = false,
  ) {
    window.clearTimeout(timers.current[field]);
    const run = () => {
      const parsed = placementInputSchema.safeParse({
        productId: id,
        sellingPrice,
        initialQuantity,
        lowStockThreshold,
      });
      setErrors((current) => ({
        ...current,
        [field]: parsed.success
          ? undefined
          : parsed.error.issues.find((issue) => issue.path[0] === field)
              ?.message,
      }));
    };
    if (immediate) run();
    else timers.current[field] = window.setTimeout(run, 300);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    Object.values(timers.current).forEach(window.clearTimeout);
    const parsed = placementInputSchema.safeParse({
      productId,
      sellingPrice: price,
      initialQuantity,
      lowStockThreshold: threshold,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
        ),
      );
      focusFirstInvalidField(event.currentTarget);
      return;
    }
    setPending(true);
    onPendingChange(true);
    setError(null);
    setErrors({});
    try {
      await createPlacement(request, scope, parsed.data);
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'The placement could not be saved. Please try again.',
      );
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  }
  return (
    <form className="mt-6 grid gap-5" noValidate onSubmit={submit}>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {loadError ? (
        <RequestError
          message={loadError}
          onRetry={() => setRevision((value) => value + 1)}
        />
      ) : null}
      <ProductPicker
        products={products}
        selectedProduct={selectedProduct}
        search={search}
        query={q}
        loading={loading}
        nextCursor={nextCursor}
        loadingMore={loadingMore}
        moreError={moreError}
        disabled={pending || Boolean(loadError)}
        error={errors.productId}
        onSearchChange={(value) => {
          readGeneration.current++;
          setSearch(value);
          setProductId('');
          setSelectedProduct(null);
          validate('productId', '', price, threshold, initialQuantity);
        }}
        onSelect={(product) => {
          setProductId(product.id);
          setSelectedProduct(product);
          setSearch(productLabel(product));
          validate('productId', product.id, price, threshold, initialQuantity);
        }}
        onBlur={() =>
          validate(
            'productId',
            productId,
            price,
            threshold,
            initialQuantity,
            true,
          )
        }
        onLoadMore={() => void loadMore()}
      />
      <TextField
        label="Initial stock"
        name="initialQuantity"
        inputMode="numeric"
        value={initialQuantity}
        error={errors.initialQuantity}
        disabled={pending}
        onChange={(event) => {
          const next = sanitizeWholeNumber(event.target.value);
          setInitialQuantity(next);
          validate('initialQuantity', productId, price, threshold, next);
        }}
        onBlur={() =>
          validate(
            'initialQuantity',
            productId,
            price,
            threshold,
            initialQuantity,
            true,
          )
        }
        required
        hint="Enter the starting stock quantity for this branch"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Selling price (PHP)"
          name="sellingPrice"
          inputMode="decimal"
          value={price}
          error={errors.sellingPrice}
          disabled={pending}
          onChange={(event) => {
            const next = sanitizePrice(event.target.value);
            setPrice(next);
            validate(
              'sellingPrice',
              productId,
              next,
              threshold,
              initialQuantity,
            );
          }}
          onBlur={() =>
            validate(
              'sellingPrice',
              productId,
              price,
              threshold,
              initialQuantity,
              true,
            )
          }
          required
          hint="Set a different price for this branch"
        />
        <TextField
          label="Low-stock threshold"
          name="lowStockThreshold"
          inputMode="numeric"
          value={threshold}
          error={errors.lowStockThreshold}
          disabled={pending}
          onChange={(event) => {
            const next = sanitizeWholeNumber(event.target.value);
            setThreshold(next);
            validate(
              'lowStockThreshold',
              productId,
              price,
              next,
              initialQuantity,
            );
          }}
          onBlur={() =>
            validate(
              'lowStockThreshold',
              productId,
              price,
              threshold,
              initialQuantity,
              true,
            )
          }
          required
          hint="Set the low-stock warning level. Enter 0 to disable warnings."
        />
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <button
          className={buttonStyles({ variant: 'primary' })}
          type="submit"
          disabled={pending || loading || Boolean(loadError) || !productId}
          aria-busy={pending}
        >
          {pending ? 'Saving…' : 'Create placement'}
        </button>
        <button
          className={buttonStyles({ variant: 'secondary' })}
          type="button"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function sanitizeWholeNumber(value: string) {
  return value.replace(/\D/g, '');
}

function sanitizePrice(value: string) {
  const [whole, ...fraction] = value.replace(/[^\d.]/g, '').split('.');
  return fraction.length ? `${whole}.${fraction.join('')}` : whole;
}

function productLabel(product: Product) {
  return `${product.name}${product.sku ? ` · ${product.sku}` : ''}`;
}

function ProductPicker({
  products,
  selectedProduct,
  search,
  query,
  loading,
  nextCursor,
  loadingMore,
  moreError,
  disabled,
  error,
  onSearchChange,
  onSelect,
  onBlur,
  onLoadMore,
}: {
  products: Product[];
  selectedProduct: Product | null;
  search: string;
  query: string;
  loading: boolean;
  nextCursor: string | null;
  loadingMore: boolean;
  moreError: string | null;
  disabled: boolean;
  error?: string;
  onSearchChange(value: string): void;
  onSelect(product: Product): void;
  onBlur(): void;
  onLoadMore(): void;
}) {
  const id = useId();
  const listboxId = `${id}-results`;
  const container = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const openPicker = () => {
    if (!disabled) setOpen(true);
  };
  const closePicker = () => {
    setOpen(false);
    window.requestAnimationFrame(() => searchInput.current?.focus());
  };
  const focusResult = (index: number) => {
    container.current
      ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
      .item(index)
      ?.focus();
  };
  const moveResultFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      focusResult((index + offset + products.length) % products.length);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      container.current?.querySelector('input')?.focus();
    }
  };
  return (
    <div
      ref={container}
      className="relative grid min-w-0 gap-2"
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          container.current?.contains(event.relatedTarget)
        )
          return;
        setOpen(false);
        onBlur();
      }}
    >
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label className="text-label font-semibold text-ink" htmlFor={id}>
          Product
        </label>
        {error ? (
          <span
            id={`${id}-error`}
            className="max-w-full text-right text-xs leading-4 font-medium text-danger sm:max-w-[65%]"
            title={error}
          >
            {error}
          </span>
        ) : null}
      </div>
      <div className="relative">
        <input
          ref={searchInput}
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          autoComplete="off"
          maxLength={254}
          value={search}
          placeholder={
            loading
              ? 'Loading available products…'
              : 'Search by name, SKU, or barcode'
          }
          disabled={disabled}
          className="min-h-11 w-full min-w-0 rounded-control border border-control-border bg-surface px-3 py-2.5 text-body text-ink placeholder:text-faint focus-visible:border-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60 aria-invalid:border-danger"
          onFocus={openPicker}
          onClick={openPicker}
          onChange={(event) => {
            onSearchChange(event.target.value);
            openPicker();
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && products.length) {
              event.preventDefault();
              openPicker();
              window.requestAnimationFrame(() => focusResult(0));
            } else if (event.key === 'Enter' && open && products.length) {
              event.preventDefault();
              onSelect(products[0]);
              closePicker();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
        {open && !disabled ? (
          <div className="absolute top-full right-0 left-0 z-50 max-h-80 overflow-y-auto rounded-b-control border border-t-0 border-hairline bg-surface p-1.5 shadow-floating">
            <div id={listboxId} role="listbox" aria-label="Available products">
              {loading ? (
                <p className="px-3 py-4 text-sm text-muted" role="status">
                  Loading available products…
                </p>
              ) : products.length ? (
                products.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    role="option"
                    aria-selected={product.id === selectedProduct?.id}
                    tabIndex={-1}
                    className={`flex min-h-11 w-full items-center rounded-compact border-0 px-3 py-2.5 text-left text-sm text-ink hover:bg-subtle ${product.id === selectedProduct?.id ? 'bg-selected font-semibold' : 'bg-surface'}`}
                    onKeyDown={(event) => {
                      moveResultFocus(event, index);
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(product);
                        closePicker();
                      }
                    }}
                    onClick={() => {
                      onSelect(product);
                      closePicker();
                    }}
                  >
                    {productLabel(product)}
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-sm text-muted">
                  No eligible products found.
                </p>
              )}
            </div>
            {nextCursor && search === query ? (
              <div className="border-t border-hairline p-2">
                {moreError ? (
                  <p role="alert" className="mb-2 text-xs text-danger">
                    {moreError}
                  </p>
                ) : null}
                <button
                  type="button"
                  className={buttonStyles({ variant: 'quiet' })}
                  disabled={loadingMore}
                  aria-busy={loadingMore}
                  onClick={onLoadMore}
                >
                  {loadingMore
                    ? 'Loading more…'
                    : moreError
                      ? 'Retry loading more'
                      : 'Load more products'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <p id={`${id}-hint`} className="text-xs leading-5 text-muted">
        {selectedProduct
          ? `Selected: ${productLabel(selectedProduct)}`
          : !products.length && !loading
            ? 'No available products match. Already placed or inactive products are excluded.'
            : 'Focus or click to browse eligible products'}
      </p>
    </div>
  );
}
