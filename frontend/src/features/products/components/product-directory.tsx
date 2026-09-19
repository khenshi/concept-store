'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import type { MerchantView } from '@/features/merchants/model/merchant.types';
import { OrganizationPageHeader } from '@/features/organizations/components/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  FilterField,
  OperationalPage,
  OperationalPanel,
  OperationalToolbar,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { listProducts } from '../api/product-api';
import type { Product, ProductStatus } from '../model/product.types';
import { ProductForm } from './product-form';

export function ProductDirectory(props: { organizationId: string }) {
  const { organization } = useOrganizationWorkspaceContext();
  const { user } = useAuth();
  return (
    <ScopedProductDirectory
      key={`${props.organizationId}:${organization?.role}:${user?.id}`}
      {...props}
    />
  );
}

function ScopedProductDirectory({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const allowed =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'MERCHANT';
  const canEdit = organization?.role === 'OWNER';
  const [products, setProducts] = useState<Product[]>([]);
  const [merchants, setMerchants] = useState<MerchantView[]>([]);
  const [search, setSearch] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const q = useDebouncedValue(search);
  useEffect(() => {
    if (!allowed || creating) return;
    let active = true;
    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);
      setProducts([]);
      setMerchants([]);
      try {
        const [items, profiles] = await Promise.all([
          listProducts(request, organizationId, {
            q: q.trim() || undefined,
            merchantId: merchantId || undefined,
            status: status || undefined,
          }),
          listMerchants(request, organizationId, {}, organization?.role),
        ]);
        if (active) {
          setProducts(items);
          setMerchants(profiles);
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'The product directory could not be loaded.',
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [
    allowed,
    creating,
    organization,
    request,
    organizationId,
    q,
    merchantId,
    status,
    revision,
  ]);
  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading product directory" />;
  if (!allowed || !organization)
    return (
      <p className="mt-8" role="alert">
        Your organization role cannot view or manage products.
      </p>
    );
  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Products"
        description={
          canEdit
            ? 'Maintain merchant-owned products. Prices and stock are tracked independently by branch.'
            : 'Read available products and their independent branch prices and stock. Ask an owner to change catalog details.'
        }
      />
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      <OperationalPanel
        variant="open"
        className="data-surface"
        title="Product directory"
        description={
          loading ? 'Loading products…' : `${products.length} matching products`
        }
        action={
          canEdit ? (
            <button
              type="button"
              className={buttonStyles({ variant: 'accent' })}
              disabled={loading || Boolean(error)}
              onClick={() => {
                setCreating(true);
                setSuccess(null);
              }}
            >
              Add product
            </button>
          ) : undefined
        }
      >
        <OperationalToolbar
          variant="open"
          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.5fr)]"
        >
          <FilterField id="product-search" label="Search">
            <input
              id="product-search"
              type="search"
              value={search}
              maxLength={254}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product name, SKU, or barcode"
              className="min-h-11 min-w-0 rounded-control border border-control-border bg-surface px-3 text-sm"
              disabled={creating}
            />
          </FilterField>
          <FilterField id="product-filter-merchant" label="Merchant">
            <SelectControl
              id="product-filter-merchant"
              value={merchantId}
              disabled={creating}
              onValueChange={setMerchantId}
            >
              <option value="">All merchants</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </SelectControl>
          </FilterField>
          <FilterField id="product-filter-status" label="Status">
            <SelectControl
              id="product-filter-status"
              value={status}
              disabled={creating}
              onValueChange={(value) => setStatus(value as ProductStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </SelectControl>
          </FilterField>
        </OperationalToolbar>
        {loading ? (
          <ListSkeleton className="p-6" label="Loading products" />
        ) : error ? (
          <RequestError
            className="p-6"
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : !products.length ? (
          <div className="px-6 py-12 text-center">
            <h3 className="font-semibold">
              {search || merchantId || status
                ? 'No products match these filters'
                : 'No products yet'}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {search || merchantId || status
                ? 'Try another search or filter.'
                : canEdit
                  ? 'Add an active merchant’s first product to get started.'
                  : 'No products are available to your access. Ask an owner to configure your merchant link or branch placements.'}
            </p>
          </div>
        ) : (
          <ul aria-label="Product directory" className="m-0 list-none p-0">
            <li className="data-column-header hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(8rem,0.7fr)] gap-x-6 gap-y-3 sm:grid">
              <span>Product</span>
              <span>Merchant</span>
              <span>Status</span>
            </li>
            {products.map((product) => (
              <li className="data-row" key={product.id}>
                <Link
                  href={`/app/organizations/${organizationId}/products/${product.id}`}
                  aria-label={`View ${product.name}`}
                  className="grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 text-ink no-underline sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(8rem,0.7fr)] sm:items-center"
                >
                  <div className="min-w-0 break-words">
                    <strong className="block text-sm font-semibold">
                      {product.name}
                    </strong>
                    <span className="mt-1 block text-xs text-muted">
                      SKU: {product.sku ?? 'Not set'} · Barcode:{' '}
                      {product.barcode ?? 'Not set'}
                    </span>
                  </div>
                  <span className="min-w-0 break-words text-sm">
                    {merchants.find(
                      (merchant) => merchant.id === product.merchantId,
                    )?.name ?? 'Merchant unavailable'}
                  </span>
                  <span
                    className={`w-fit rounded-compact border px-2 py-1 text-xs ${product.status === 'ACTIVE' ? 'border-success/20 bg-success/5 text-success-ink' : 'border-hairline bg-subtle text-muted'}`}
                  >
                    {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OperationalPanel>
      {creating && canEdit ? (
        <FormDialog
          title="Add a product"
          description="Choose its merchant and record its identity. Optionally add initial stock to one explicitly selected branch with its own selling price."
          pending={pending}
          onClose={() => setCreating(false)}
        >
          <ProductForm
            organizationId={organizationId}
            merchants={merchants}
            onCancel={() => setCreating(false)}
            onPendingChange={setPending}
            onSaved={(saved, withOpeningStock) => {
              setCreating(false);
              setSuccess(
                `${saved.name} was created successfully.${withOpeningStock ? ' Initial stock is recorded in the selected branch.' : ''}`,
              );
              setRevision((value) => value + 1);
            }}
          />
        </FormDialog>
      ) : null}
    </OperationalPage>
  );
}
