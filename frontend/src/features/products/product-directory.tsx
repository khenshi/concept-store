'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import {
  FilterField,
  OperationalPage,
  OperationalPanel,
  OperationalToolbar,
  StatusNotice,
} from '@/components/ui/operational-page';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import type { Merchant } from '@/features/merchants/merchant.types';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import {
  createProduct,
  listProducts,
  updateProduct,
  updateProductStatus,
} from './product-api';
import { ProductFormModal } from './product-form-modal';
import type {
  Product,
  ProductFilters,
  ProductInput,
  ProductStatus,
} from './product.types';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const fieldClass =
  'min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5';

function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function sorted(products: Product[]): Product[] {
  return [...products].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

export function ProductDirectory({
  organizationId,
  initialMerchantId,
}: {
  organizationId: string;
  initialMerchantId?: string;
}) {
  const { request } = useAuth();
  const {
    organization,
    organizationStatus,
    loadMerchants,
    loadProducts,
    upsertProduct,
  } = useOrganizationWorkspaceContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filters, setFilters] = useState<ProductFilters>({
    merchantId: initialMerchantId,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load(selected: ProductFilters = filters): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      setProducts(await listProducts(request, organizationId, selected));
    } catch (cause: unknown) {
      setError(message(cause));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (
      !organization ||
      (organization.role !== 'OWNER' && organization.role !== 'MANAGER')
    )
      return;
    let active = true;
    void Promise.all([
      initialMerchantId
        ? listProducts(request, organizationId, {
            merchantId: initialMerchantId,
          })
        : loadProducts(),
      loadMerchants(),
    ])
      .then(([catalog, activeMerchants]) => {
        if (active) {
          setProducts(catalog);
          setMerchants(activeMerchants);
        }
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
  }, [
    initialMerchantId,
    loadMerchants,
    loadProducts,
    organization,
    organizationId,
    request,
  ]);

  async function filter(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: ProductFilters = {
      search: String(data.get('search') ?? '').trim() || undefined,
      merchantId: String(data.get('merchantId') ?? '') || undefined,
      status: (String(data.get('status') ?? '') || undefined) as
        ProductStatus | undefined,
    };
    setFilters(next);
    setIsFiltering(true);
    setError(null);
    try {
      setProducts(await listProducts(request, organizationId, next));
    } catch (cause: unknown) {
      setError(message(cause));
    } finally {
      setIsFiltering(false);
    }
  }

  async function save(input: ProductInput): Promise<void> {
    setIsSaving(true);
    setFormError(null);
    try {
      const saved = editing
        ? await updateProduct(request, organizationId, editing.id, {
            name: input.name,
            sku: input.sku,
            barcode: input.barcode,
            sellingPrice: input.sellingPrice,
          })
        : await createProduct(request, organizationId, input);
      setProducts((current) =>
        sorted([...current.filter((item) => item.id !== saved.id), saved]),
      );
      upsertProduct(saved);
      setSuccess(
        editing
          ? `${saved.name} was updated.`
          : `${saved.name} was added to the catalog.`,
      );
      closeForm();
    } catch (cause: unknown) {
      setFormError(message(cause));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggle(product: Product): Promise<void> {
    const status: ProductStatus =
      product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setPendingStatusId(product.id);
    setError(null);
    try {
      const saved = await updateProductStatus(
        request,
        organizationId,
        product.id,
        status,
      );
      setProducts((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      upsertProduct(saved);
      setSuccess(`${saved.name} is now ${saved.status.toLowerCase()}.`);
    } catch (cause: unknown) {
      setError(message(cause));
    } finally {
      setPendingStatusId(null);
    }
  }

  function openForm(product: Product | null): void {
    setEditing(product);
    setFormError(null);
    setFormOpen(true);
  }
  function closeForm(): void {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  }

  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading products" />;
  if (!organization) return null;
  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Products"
        description="Manage merchant-owned products, selling codes, and current prices."
      />
      {!canManage ? (
        <Limited />
      ) : (
        <OperationalPanel
          title="Product directory"
          description={`${products.length} matching products · Catalog records and current selling prices`}
          action={
            <button
              className="min-h-11 cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              type="button"
              onClick={() => openForm(null)}
              disabled={merchants.length === 0}
            >
              Add product
            </button>
          }
        >
          {merchants.length === 0 && !isLoading ? (
            <StatusNotice tone="warning">
              Add a merchant before creating products.
            </StatusNotice>
          ) : null}
          <OperationalToolbar>
            <form
              className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.5fr)_minmax(9rem,0.4fr)_auto]"
              onSubmit={(event) => void filter(event)}
            >
              <FilterField label="Search" id="product-search">
                <input
                  className={fieldClass}
                  id="product-search"
                  name="search"
                  type="search"
                  defaultValue={filters.search}
                  placeholder="Name, SKU, or barcode"
                  maxLength={160}
                />
              </FilterField>
              <FilterField label="Merchant" id="product-merchant">
                <select
                  className={fieldClass}
                  id="product-merchant"
                  name="merchantId"
                  defaultValue={filters.merchantId ?? ''}
                >
                  <option value="">All merchants</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Status" id="product-status">
                <select
                  className={fieldClass}
                  id="product-status"
                  name="status"
                  defaultValue={filters.status ?? ''}
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </FilterField>
              <button
                className="min-h-12 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-3.5 font-bold disabled:cursor-wait disabled:opacity-65"
                disabled={isFiltering}
              >
                {isFiltering ? 'Applying…' : 'Apply'}
              </button>
            </form>
          </OperationalToolbar>
          {success ? <StatusNotice>{success}</StatusNotice> : null}
          {error ? (
            <RequestError
              className="mt-5 rounded-lg border border-red-600 p-3 text-sm text-red-600"
              message={error}
              onRetry={() => void load()}
            />
          ) : null}
          {isLoading ? (
            <ListSkeleton label="Loading products" rowClassName="h-24" />
          ) : products.length === 0 ? (
            <Empty />
          ) : (
            <ul className="list-none px-5 py-1 sm:px-6">
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  organizationId={organizationId}
                  product={product}
                  pending={pendingStatusId === product.id}
                  onEdit={() => openForm(product)}
                  onToggle={() => void toggle(product)}
                />
              ))}
            </ul>
          )}
        </OperationalPanel>
      )}
      {formOpen ? (
        <ProductFormModal
          merchants={merchants}
          product={editing}
          isSaving={isSaving}
          requestError={formError}
          onClose={closeForm}
          onSave={save}
        />
      ) : null}
    </OperationalPage>
  );
}

function ProductRow({
  organizationId,
  product,
  pending,
  onEdit,
  onToggle,
}: {
  organizationId: string;
  product: Product;
  pending: boolean;
  onEdit(): void;
  onToggle(): void;
}) {
  return (
    <li className="flex items-center justify-between gap-5 border-b border-slate-200 py-4 last:border-0 max-sm:grid">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <strong>{product.name}</strong>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            {product.sku}
          </span>
          <span
            className={
              product.status === 'ACTIVE'
                ? 'rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700'
                : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600'
            }
          >
            {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-slate-500">
          {product.merchant.name}
          {product.barcode ? ` · ${product.barcode}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4 max-sm:justify-between">
        <strong className="text-sm">
          {peso.format(Number(product.sellingPrice))}
        </strong>
        <Link
          className="text-sm font-bold text-emerald-700 underline underline-offset-3"
          href={`/app/organizations/${organizationId}/inventory?productId=${product.id}`}
        >
          View stock
        </Link>
        <button
          className="cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-emerald-700 underline underline-offset-3"
          type="button"
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          className="cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-slate-600 underline underline-offset-3 disabled:cursor-wait disabled:opacity-60"
          type="button"
          disabled={pending}
          onClick={onToggle}
        >
          {pending
            ? 'Updating…'
            : product.status === 'ACTIVE'
              ? 'Deactivate'
              : 'Activate'}
        </button>
      </div>
    </li>
  );
}

function Limited() {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-bold">Product access is limited</h2>
      <p className="mt-3 leading-7 text-slate-500">
        Product management is currently available to organization owners and
        managers.
      </p>
    </section>
  );
}
function Empty() {
  return (
    <div className="py-10 text-center">
      <h3 className="text-base font-bold">No products found</h3>
      <p className="mt-2 text-slate-500">
        Adjust the filters or add the first product.
      </p>
    </div>
  );
}
