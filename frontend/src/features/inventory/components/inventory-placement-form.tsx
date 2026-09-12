'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import { listProducts } from '@/features/products/api/product-api';
import type { Product } from '@/features/products/model/product.types';
import { buttonStyles } from '@/shared/components/ui/button';
import { SelectControl } from '@/shared/components/ui/select-control';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { RequestError } from '@/shared/components/ui/request-error';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { createPlacement, listInventory } from '../api/inventory-api';
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
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<
    Partial<Record<'productId' | 'sellingPrice', string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const timers = useRef<Partial<Record<'productId' | 'sellingPrice', number>>>(
    {},
  );
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
    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setLoadError(null);
      try {
        const [items, profiles, placed] = await Promise.all([
          listProducts(request, organizationId, {
            status: 'ACTIVE',
            q: q.trim() || undefined,
          }),
          listMerchants(request, organizationId, { status: 'ACTIVE' }),
          listInventory(request, { organizationId, branchId }),
        ]);
        const merchantIds = new Set(profiles.map((profile) => profile.id));
        const placedIds = new Set(
          placed.map((placement) => placement.productId),
        );
        const candidates = items.filter(
          (item) => merchantIds.has(item.merchantId) && !placedIds.has(item.id),
        );
        if (active) setProducts(candidates);
      } catch (cause) {
        if (active)
          setLoadError(
            cause instanceof ApiError
              ? cause.message
              : 'Available products could not be loaded.',
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, q, revision]);
  function validate(
    field: 'productId' | 'sellingPrice',
    id: string,
    sellingPrice: string,
    immediate = false,
  ) {
    window.clearTimeout(timers.current[field]);
    const run = () => {
      const parsed = placementInputSchema.safeParse({
        productId: id,
        sellingPrice,
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
  // Keep the selected product visible when searching for another candidate.
  const options =
    selectedProduct && !products.some((item) => item.id === productId)
      ? [selectedProduct, ...products]
      : products;
  return (
    <form
      className="mt-6 grid gap-5"
      noValidate
      onSubmit={submit}
      onBlur={(event) => {
        if (
          event.target instanceof HTMLButtonElement &&
          event.target.id === 'placement-product'
        )
          validate('productId', productId, price, true);
      }}
    >
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <TextField
        label="Find a product"
        name="search"
        type="search"
        maxLength={254}
        value={search}
        disabled={pending}
        onChange={(event) => setSearch(event.target.value)}
        hint="Search active products in this organization by name, SKU, or barcode."
      />
      {loadError ? (
        <RequestError
          message={loadError}
          onRetry={() => setRevision((value) => value + 1)}
        />
      ) : null}
      <div className="grid gap-2">
        <label htmlFor="placement-product" className="text-label font-semibold">
          Product
        </label>
        <SelectControl
          id="placement-product"
          value={productId}
          disabled={pending || loading || Boolean(loadError)}
          required
          aria-invalid={Boolean(errors.productId)}
          aria-describedby="placement-product-hint"
          onValueChange={(id) => {
            setProductId(id);
            setSelectedProduct(products.find((item) => item.id === id) ?? null);
            validate('productId', id, price);
          }}
        >
          <option value="">
            {loading ? 'Loading available products…' : 'Choose a product'}
          </option>
          {options.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
              {product.sku ? ` · ${product.sku}` : ''}
            </option>
          ))}
        </SelectControl>
        <p
          id="placement-product-hint"
          className={`text-xs ${errors.productId ? 'text-danger' : 'text-muted'}`}
        >
          {errors.productId ??
            (loading
              ? 'Loading…'
              : !products.length
                ? 'No available products match. Already placed or inactive products are excluded.'
                : 'Only active products with active merchants and no placement in this branch are offered.')}
        </p>
      </div>
      <TextField
        label="Selling price (PHP)"
        name="sellingPrice"
        inputMode="decimal"
        value={price}
        error={errors.sellingPrice}
        disabled={pending}
        onChange={(event) => {
          setPrice(event.target.value);
          validate('sellingPrice', productId, event.target.value);
        }}
        onBlur={() => validate('sellingPrice', productId, price, true)}
        required
        hint="Positive price with up to two decimal places. This branch may charge a different price."
      />
      <p className="text-sm text-muted">
        Placement starts with zero stock. Receive opening stock separately. No
        stock is transferred or deducted from another branch.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          className={buttonStyles({ variant: 'primary' })}
          type="submit"
          disabled={pending || loading || Boolean(loadError) || !options.length}
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
