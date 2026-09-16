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
  const [threshold, setThreshold] = useState('5');
  const [errors, setErrors] = useState<
    Partial<Record<'productId' | 'sellingPrice' | 'lowStockThreshold', string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const timers = useRef<
    Partial<Record<'productId' | 'sellingPrice' | 'lowStockThreshold', number>>
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
    field: 'productId' | 'sellingPrice' | 'lowStockThreshold',
    id: string,
    sellingPrice: string,
    lowStockThreshold: string,
    immediate = false,
  ) {
    window.clearTimeout(timers.current[field]);
    const run = () => {
      const parsed = placementInputSchema.safeParse({
        productId: id,
        sellingPrice,
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
        loading={loading}
        nextCursor={nextCursor}
        loadingMore={loadingMore}
        moreError={moreError}
        disabled={pending || loading || Boolean(loadError)}
        error={errors.productId}
        onSearchChange={(value) => {
          readGeneration.current++;
          setProducts([]);
          setNextCursor(null);
          setMoreError(null);
          setLoadingMore(false);
          setLoading(true);
          setSearch(value);
          setProductId('');
          setSelectedProduct(null);
          validate('productId', '', price, threshold);
        }}
        onSelect={(product) => {
          setProductId(product.id);
          setSelectedProduct(product);
          setSearch(productLabel(product));
          validate('productId', product.id, price, threshold);
        }}
        onBlur={() => validate('productId', productId, price, threshold, true)}
        onLoadMore={() => void loadMore()}
      />
      <TextField
        label="Selling price (PHP)"
        name="sellingPrice"
        inputMode="decimal"
        value={price}
        error={errors.sellingPrice}
        disabled={pending}
        onChange={(event) => {
          setPrice(event.target.value);
          validate('sellingPrice', productId, event.target.value, threshold);
        }}
        onBlur={() =>
          validate('sellingPrice', productId, price, threshold, true)
        }
        required
        hint="Positive price with up to two decimal places. This branch may charge a different price."
      />
      <TextField
        label="Low-stock threshold"
        name="lowStockThreshold"
        inputMode="numeric"
        value={threshold}
        error={errors.lowStockThreshold}
        disabled={pending}
        onChange={(event) => {
          setThreshold(event.target.value);
          validate('lowStockThreshold', productId, price, event.target.value);
        }}
        onBlur={() =>
          validate('lowStockThreshold', productId, price, threshold, true)
        }
        required
        hint="Warn at or below this stock level. Use 0 to disable low-stock warnings."
      />
      <p className="text-sm text-muted">
        Placement starts with zero stock. Receive opening stock separately. No
        stock is transferred or deducted from another branch.
      </p>
      <div className="flex flex-wrap gap-3">
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

function productLabel(product: Product) {
  return `${product.name}${product.sku ? ` · ${product.sku}` : ''}`;
}

function ProductPicker({
  products,
  selectedProduct,
  search,
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
  const [open, setOpen] = useState(false);
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
      <label className="text-label font-semibold text-ink" htmlFor={id}>
        Product
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
        autoComplete="off"
        maxLength={254}
        value={search}
        disabled={disabled}
        placeholder={
          loading
            ? 'Loading available products…'
            : 'Search by name, SKU, or barcode'
        }
        className="min-h-11 w-full min-w-0 rounded-control border border-control-border bg-surface px-3 py-2.5 text-body text-ink placeholder:text-faint focus-visible:border-focus disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60 aria-invalid:border-danger"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onSearchChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && products.length) {
            event.preventDefault();
            setOpen(true);
            window.requestAnimationFrame(() => focusResult(0));
          } else if (event.key === 'Enter' && open && products.length) {
            event.preventDefault();
            onSelect(products[0]);
            setOpen(false);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      <p id={`${id}-hint`} className="text-xs leading-5 text-muted">
        {loading
          ? 'Loading…'
          : selectedProduct
            ? `Selected: ${productLabel(selectedProduct)}`
            : !products.length
              ? 'No available products match. Already placed or inactive products are excluded.'
              : 'Type to filter eligible products, then choose one result.'}
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {open && !disabled && (products.length || nextCursor) ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-control border border-hairline bg-surface p-1.5 shadow-floating">
          <div id={listboxId} role="listbox" aria-label="Available products">
            {products.map((product, index) => (
              <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={product.id === selectedProduct?.id}
                tabIndex={-1}
                className={`flex min-h-11 w-full items-center rounded-compact border-0 px-3 py-2.5 text-left text-sm text-ink hover:bg-subtle ${product.id === selectedProduct?.id ? 'bg-selected font-semibold' : 'bg-surface'}`}
                onKeyDown={(event) => moveResultFocus(event, index)}
                onClick={() => {
                  onSelect(product);
                  setOpen(false);
                }}
              >
                {productLabel(product)}
              </button>
            ))}
          </div>
          {nextCursor ? (
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
  );
}
