'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import type { MerchantView } from '@/features/merchants/model/merchant.types';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
import { OrganizationPageHeader } from '@/features/organizations/components/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { Icon } from '@/shared/components/ui/icon';
import { InputControl } from '@/shared/components/ui/input-control';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  FilterField,
  OperationalCollection,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { listProducts } from '../api/product-api';
import type { Product, ProductStatus } from '../model/product.types';
import { ProductForm } from './product-form';

const productDirectoryGrid =
  'sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(10rem,0.8fr)_6rem]';

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
  const [openingStockExpanded, setOpeningStockExpanded] = useState(false);
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
    return (
      <OrganizationPageFrame>
        <ListSkeleton label="Loading product directory" />
      </OrganizationPageFrame>
    );
  if (!allowed || !organization)
    return (
      <OrganizationPageFrame>
        <p className="mt-8" role="alert">
          Your organization role cannot view or manage products.
        </p>
      </OrganizationPageFrame>
    );
  return (
    <OrganizationPageFrame>
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
      <OperationalCollection
        className="mt-0"
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
                setOpeningStockExpanded(false);
                setSuccess(null);
              }}
            >
              Add product
            </button>
          ) : undefined
        }
        controls={
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.5fr)]">
            <FilterField id="product-search" label="Search">
              <InputControl
                id="product-search"
                icon="search"
                type="search"
                value={search}
                maxLength={254}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Product name, SKU, or barcode"
                className="text-sm"
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
                onValueChange={(value) =>
                  setStatus(value as ProductStatus | '')
                }
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </SelectControl>
            </FilterField>
          </div>
        }
      >
        {loading ? (
          <ListSkeleton className="p-6" label="Loading products" />
        ) : error ? (
          <RequestError
            className="p-6"
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : !products.length ? (
          <EmptyState
            className="mx-6 my-6"
            title={
              search || merchantId || status
                ? 'No products match these filters'
                : 'No products yet'
            }
            description={
              search || merchantId || status
                ? 'Try another search or filter.'
                : canEdit
                  ? 'Add an active merchant’s first product to get started.'
                  : 'No products are available to your access. Ask an owner to configure your merchant link or branch placements.'
            }
          />
        ) : (
          <ul aria-label="Product directory" className="m-0 list-none p-0">
            <li
              className={`data-column-header hidden justify-items-start text-left gap-x-6 gap-y-3 sm:grid ${productDirectoryGrid}`}
            >
              <span>Product</span>
              <span>Merchant</span>
              <span>Status</span>
              <span>Action</span>
            </li>
            {products.map((product) => (
              <li className="data-row" key={product.id}>
                <Link
                  href={`/app/organizations/${organizationId}/products/${product.id}`}
                  aria-label={`View ${product.name}`}
                  className={`grid min-w-0 justify-items-start gap-x-6 gap-y-3 px-4 py-4 text-left text-ink no-underline sm:items-center ${productDirectoryGrid}`}
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
                    className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${product.status === 'ACTIVE' ? 'border-success/20 bg-success/5 text-success-ink' : 'border-hairline bg-subtle text-muted'}`}
                  >
                    {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                  <span
                    className="flex w-fit items-center justify-start gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-subtle"
                    aria-hidden="true"
                  >
                    View <Icon name="arrow" className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OperationalCollection>
      {creating && canEdit ? (
        <FormDialog
          title="Add a product"
          description="Choose its merchant and record its identity. Optionally add initial stock to one explicitly selected branch with its own selling price."
          size={openingStockExpanded ? 'wide' : 'default'}
          pending={pending}
          onClose={() => {
            setCreating(false);
            setOpeningStockExpanded(false);
          }}
        >
          <ProductForm
            organizationId={organizationId}
            merchants={merchants}
            onCancel={() => {
              setCreating(false);
              setOpeningStockExpanded(false);
            }}
            onPendingChange={setPending}
            onOpeningStockChange={setOpeningStockExpanded}
            onSaved={(saved, withOpeningStock) => {
              setCreating(false);
              setOpeningStockExpanded(false);
              setSuccess(
                `${saved.name} was created successfully.${withOpeningStock ? ' Initial stock is recorded in the selected branch.' : ''}`,
              );
              setRevision((value) => value + 1);
            }}
          />
        </FormDialog>
      ) : null}
    </OrganizationPageFrame>
  );
}
