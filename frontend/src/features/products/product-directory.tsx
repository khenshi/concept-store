'use client';

import { useEffect, useRef, useState } from 'react';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import {
  FilterField,
  OperationalPage,
  OperationalPanel,
  OperationalToolbar,
  StatusNotice,
} from '@/components/ui/operational-page';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { useDebouncedValue } from '@/components/ui/use-debounced-value';
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
  const [search, setSearch] = useState('');
  const [merchantId, setMerchantId] = useState(initialMerchantId ?? '');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const debouncedSearch = useDebouncedValue(search);
  const filterInitialized = useRef(false);
  const filterRequestId = useRef(0);

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

  useEffect(() => {
    if (
      !organization ||
      (organization.role !== 'OWNER' && organization.role !== 'MANAGER')
    )
      return;
    if (!filterInitialized.current) {
      filterInitialized.current = true;
      return;
    }
    const next: ProductFilters = {
      search: debouncedSearch.trim() || undefined,
      merchantId: merchantId || undefined,
      status: status || undefined,
    };
    setFilters(next);
    setIsFiltering(true);
    setError(null);
    const requestId = ++filterRequestId.current;
    void listProducts(request, organizationId, next)
      .then((result) => {
        if (requestId === filterRequestId.current) setProducts(result);
      })
      .catch((cause: unknown) => {
        if (requestId === filterRequestId.current) setError(message(cause));
      })
      .finally(() => {
        if (requestId === filterRequestId.current) setIsFiltering(false);
      });
  }, [
    debouncedSearch,
    merchantId,
    organization,
    organizationId,
    request,
    status,
  ]);

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
    const action = status === 'ACTIVE' ? 'activate' : 'deactivate';
    if (
      !(await confirm({
        title: `${status === 'ACTIVE' ? 'Activate' : 'Deactivate'} ${product.name}?`,
        description:
          status === 'ACTIVE'
            ? 'The product will become available as an active catalog item.'
            : 'The product will remain in historical records but will no longer be active in the catalog.',
        confirmLabel: `${status === 'ACTIVE' ? 'Activate' : 'Deactivate'} product`,
        tone: status === 'ACTIVE' ? 'primary' : 'danger',
      }))
    ) {
      return;
    }
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
      setSuccess(`${saved.name} was ${action}d.`);
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
            <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.5fr)_minmax(9rem,0.4fr)_auto]">
              <FilterField label="Search" id="product-search">
                <input
                  className={fieldClass}
                  id="product-search"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    filterRequestId.current += 1;
                    setSearch(event.target.value);
                  }}
                  placeholder="Name, SKU, or barcode"
                  maxLength={160}
                />
              </FilterField>
              <FilterField label="Merchant" id="product-merchant">
                <SelectControl
                  className={fieldClass}
                  id="product-merchant"
                  value={merchantId}
                  onValueChange={(value) => {
                    filterRequestId.current += 1;
                    setMerchantId(value);
                  }}
                >
                  <option value="">All merchants</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
                </SelectControl>
              </FilterField>
              <FilterField label="Status" id="product-status">
                <SelectControl
                  className={fieldClass}
                  id="product-status"
                  value={status}
                  onValueChange={(value) => {
                    filterRequestId.current += 1;
                    setStatus(value as ProductStatus | '');
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </SelectControl>
              </FilterField>
              {isFiltering ? (
                <span
                  className="pb-3 text-sm font-semibold text-slate-500"
                  role="status"
                >
                  Updating…
                </span>
              ) : null}
            </div>
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] border-collapse text-left text-sm">
                <caption className="sr-only">
                  Product catalog with merchant ownership, identifiers, price,
                  status, and actions
                </caption>
                <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3.5 font-bold" scope="col">
                      Product
                    </th>
                    <th className="px-4 py-3.5 font-bold" scope="col">
                      Merchant
                    </th>
                    <th className="px-4 py-3.5 font-bold" scope="col">
                      Identifiers
                    </th>
                    <th className="px-4 py-3.5 font-bold" scope="col">
                      Price
                    </th>
                    <th className="px-4 py-3.5 font-bold" scope="col">
                      Status
                    </th>
                    <th
                      className="px-6 py-3.5 text-right font-bold"
                      scope="col"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      pending={pendingStatusId === product.id}
                      onEdit={() => openForm(product)}
                      onToggle={() => void toggle(product)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
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
      {confirmationDialog}
    </OperationalPage>
  );
}

function ProductRow({
  product,
  pending,
  onEdit,
  onToggle,
}: {
  product: Product;
  pending: boolean;
  onEdit(): void;
  onToggle(): void;
}) {
  return (
    <tr className="border-t border-slate-200 text-slate-700 hover:bg-slate-50/60">
      <th className="px-6 py-4 font-bold text-slate-950" scope="row">
        {product.name}
      </th>
      <td className="px-4 py-4">{product.merchant.name}</td>
      <td className="px-4 py-4">
        <span className="block font-semibold text-slate-700">
          {product.sku}
        </span>
        <span className="mt-1 block text-xs text-slate-500">
          {product.barcode ?? 'No barcode'}
        </span>
      </td>
      <td className="px-4 py-4 font-bold text-slate-950">
        {peso.format(Number(product.sellingPrice))}
      </td>
      <td className="px-4 py-4">
        <span
          className={
            product.status === 'ACTIVE'
              ? 'rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700'
              : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600'
          }
        >
          {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-4">
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
      </td>
    </tr>
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
