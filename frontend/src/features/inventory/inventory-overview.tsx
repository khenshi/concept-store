'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { Product, ProductStatus } from '@/features/products/product.types';
import { adjustInventory, listInventory, stockIn } from './inventory-api';
import { InventoryMovementHistory } from './inventory-movement-history';
import { InventoryOperationModal } from './inventory-operation-modal';
import type {
  InventoryAdjustmentInput,
  InventoryFilters,
  InventoryItem,
  InventoryOperation,
  InventoryPage,
  StockInInput,
} from './inventory.types';

const PAGE_SIZE = 25;
const fieldClass =
  'min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5';
type Operation = { mode: 'stock-in' } | { mode: 'adjust'; item: InventoryItem };

function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

export function InventoryOverview({
  organizationId,
  initialFilters = {},
}: {
  organizationId: string;
  initialFilters?: Pick<
    InventoryFilters,
    'branchId' | 'merchantId' | 'productId'
  >;
}) {
  const { request } = useAuth();
  const initialBranchId = initialFilters.branchId;
  const initialMerchantId = initialFilters.merchantId;
  const initialProductId = initialFilters.productId;
  const {
    organization,
    organizationStatus,
    branches,
    loadBranches,
    loadMerchants,
    loadProducts,
  } = useOrganizationWorkspaceContext();
  const [page, setPage] = useState<InventoryPage>({
    items: [],
    total: 0,
    offset: 0,
    limit: PAGE_SIZE,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filters, setFilters] = useState<InventoryFilters>({
    branchId: initialBranchId,
    merchantId: initialMerchantId,
    productId: initialProductId,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [search, setSearch] = useState('');
  const [filterBranchId, setFilterBranchId] = useState(initialBranchId ?? '');
  const [filterMerchantId, setFilterMerchantId] = useState(
    initialMerchantId ?? '',
  );
  const [filterStatus, setFilterStatus] = useState<ProductStatus | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [view, setView] = useState<'current' | 'history'>('current');
  const [historyOpened, setHistoryOpened] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const debouncedSearch = useDebouncedValue(search);
  const filterInitialized = useRef(false);
  const inventoryRequestId = useRef(0);

  useEffect(() => {
    if (
      !organization ||
      (organization.role !== 'OWNER' && organization.role !== 'MANAGER')
    )
      return;
    let active = true;
    void Promise.all([
      listInventory(request, organizationId, {
        branchId: initialBranchId,
        merchantId: initialMerchantId,
        productId: initialProductId,
        limit: PAGE_SIZE,
        offset: 0,
      }),
      loadProducts(),
      loadMerchants(),
      loadBranches(),
    ])
      .then(([inventory, catalog, merchantList]) => {
        if (active) {
          setPage(inventory);
          setProducts(catalog);
          setMerchants(merchantList);
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
    initialBranchId,
    initialMerchantId,
    initialProductId,
    loadBranches,
    loadMerchants,
    loadProducts,
    organization,
    organizationId,
    request,
  ]);

  const fetchPage = useCallback(
    async (next: InventoryFilters, filtering = false): Promise<void> => {
      const requestId = ++inventoryRequestId.current;
      setFilters(next);
      if (filtering) setIsFiltering(true);
      else setIsLoading(true);
      setError(null);
      try {
        const result = await listInventory(request, organizationId, next);
        if (requestId === inventoryRequestId.current) setPage(result);
      } catch (cause: unknown) {
        if (requestId === inventoryRequestId.current) setError(message(cause));
      } finally {
        if (requestId === inventoryRequestId.current) {
          setIsFiltering(false);
          setIsLoading(false);
        }
      }
    },
    [organizationId, request],
  );

  useEffect(() => {
    if (!filterInitialized.current) {
      filterInitialized.current = true;
      return;
    }
    void fetchPage(
      {
        branchId: filterBranchId || undefined,
        merchantId: filterMerchantId || undefined,
        productId: initialProductId,
        status: filterStatus || undefined,
        search: debouncedSearch.trim() || undefined,
        offset: 0,
        limit: PAGE_SIZE,
      },
      true,
    );
  }, [
    debouncedSearch,
    fetchPage,
    filterBranchId,
    filterMerchantId,
    filterStatus,
    initialProductId,
  ]);

  function mergeOperation(
    result: InventoryOperation,
    selected: Operation,
  ): void {
    setPage((current) => {
      const index = current.items.findIndex(
        (item) =>
          item.productId === result.inventory.productId &&
          item.branchId === result.inventory.branchId,
      );
      if (index >= 0)
        return {
          ...current,
          items: current.items.map((item, itemIndex) =>
            itemIndex === index ? { ...item, ...result.inventory } : item,
          ),
        };
      if (selected.mode === 'adjust') return current;
      const product = products.find(
        (item) => item.id === result.inventory.productId,
      );
      const branch = branches.find(
        (item) => item.id === result.inventory.branchId,
      );
      if (!product || !branch) return current;
      return {
        ...current,
        total: current.total + 1,
        items: [
          {
            ...result.inventory,
            product,
            branch: { id: branch.id, name: branch.name, code: branch.code },
          },
          ...current.items,
        ].slice(0, current.limit),
      };
    });
  }

  async function saveStockIn(input: StockInInput): Promise<void> {
    if (!operation) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const result = await stockIn(request, organizationId, input);
      mergeOperation(result, operation);
      setSuccess(`Recorded ${input.quantity} units of stock.`);
      setHistoryVersion((version) => version + 1);
      setOperation(null);
    } catch (cause: unknown) {
      setFormError(message(cause));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAdjustment(
    input: InventoryAdjustmentInput,
  ): Promise<void> {
    if (!operation) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const result = await adjustInventory(request, organizationId, input);
      mergeOperation(result, operation);
      setSuccess(`Inventory was adjusted by ${input.quantityChange}.`);
      setHistoryVersion((version) => version + 1);
      setOperation(null);
    } catch (cause: unknown) {
      setFormError(message(cause));
    } finally {
      setIsSaving(false);
    }
  }

  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading inventory" />;
  if (!organization) return null;
  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';
  const from = page.total === 0 ? 0 : page.offset + 1;
  const to = Math.min(page.offset + page.items.length, page.total);

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Inventory"
        description="Track current product quantities across branches and record every change."
      />
      {!canManage ? (
        <Limited />
      ) : (
        <>
          <div
            className="mt-6 flex gap-1 border-b border-slate-200"
            role="tablist"
            aria-label="Inventory views"
          >
            <button
              className={`border-x-0 border-t-0 bg-transparent px-3 py-3 text-sm font-bold ${view === 'current' ? 'border-b-2 border-emerald-600 text-slate-950' : 'border-b-2 border-transparent text-slate-500'}`}
              type="button"
              role="tab"
              aria-selected={view === 'current'}
              onClick={() => setView('current')}
            >
              Current stock
            </button>
            <button
              className={`border-x-0 border-t-0 bg-transparent px-3 py-3 text-sm font-bold ${view === 'history' ? 'border-b-2 border-emerald-600 text-slate-950' : 'border-b-2 border-transparent text-slate-500'}`}
              type="button"
              role="tab"
              aria-selected={view === 'history'}
              onClick={() => {
                setView('history');
                setHistoryOpened(true);
              }}
            >
              Movement history
            </button>
          </div>
          {view === 'current' ? (
            <OperationalPanel
              title="Current stock"
              description={`${page.total} product and branch records · Physical quantities by location`}
              action={
                <button
                  className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 font-bold text-white disabled:opacity-60"
                  type="button"
                  disabled={products.length === 0 || branches.length === 0}
                  onClick={() => {
                    setFormError(null);
                    setOperation({ mode: 'stock-in' });
                  }}
                >
                  Record stock-in
                </button>
              }
            >
              <OperationalToolbar>
                <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_repeat(3,minmax(9rem,0.45fr))_auto]">
                  <FilterField label="Search" id="inventory-search">
                    <input
                      className={fieldClass}
                      id="inventory-search"
                      type="search"
                      value={search}
                      onChange={(event) => {
                        inventoryRequestId.current += 1;
                        setSearch(event.target.value);
                      }}
                      placeholder="Name, SKU, or barcode"
                    />
                  </FilterField>
                  <FilterField label="Branch" id="inventory-branch">
                    <SelectControl
                      className={fieldClass}
                      id="inventory-branch"
                      value={filterBranchId}
                      onValueChange={(value) => {
                        inventoryRequestId.current += 1;
                        setFilterBranchId(value);
                      }}
                    >
                      <option value="">All branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </SelectControl>
                  </FilterField>
                  <FilterField label="Merchant" id="inventory-merchant">
                    <SelectControl
                      className={fieldClass}
                      id="inventory-merchant"
                      value={filterMerchantId}
                      onValueChange={(value) => {
                        inventoryRequestId.current += 1;
                        setFilterMerchantId(value);
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
                  <FilterField label="Product status" id="inventory-status">
                    <SelectControl
                      className={fieldClass}
                      id="inventory-status"
                      value={filterStatus}
                      onValueChange={(value) => {
                        inventoryRequestId.current += 1;
                        setFilterStatus(value as ProductStatus | '');
                      }}
                    >
                      <option value="">All statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </SelectControl>
                  </FilterField>
                </div>
              </OperationalToolbar>
              {success ? <StatusNotice>{success}</StatusNotice> : null}
              {error ? (
                <RequestError
                  className="mt-5 rounded-lg border border-red-600 p-3 text-sm text-red-600"
                  message={error}
                  onRetry={() => void fetchPage(filters)}
                />
              ) : null}
              {isLoading ? (
                <ListSkeleton label="Loading inventory" rowClassName="h-24" />
              ) : page.items.length === 0 ? (
                <Empty />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                    <caption className="sr-only">
                      Current physical inventory quantities by product,
                      merchant, and branch
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
                          Branch
                        </th>
                        <th
                          className="px-4 py-3.5 text-right font-bold"
                          scope="col"
                        >
                          On hand
                        </th>
                        <th
                          className="px-6 py-3.5 text-right font-bold"
                          scope="col"
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.items.map((item) => (
                        <InventoryRow
                          key={`${item.productId}:${item.branchId}`}
                          item={item}
                          onAdjust={() => {
                            setFormError(null);
                            setOperation({ mode: 'adjust', item });
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {page.total > 0 ? (
                <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-5 sm:px-6">
                  <p className="text-sm text-slate-500">
                    Showing {from}–{to} of {page.total}
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="min-h-10 rounded-[0.6rem] border border-slate-200 bg-white px-3 font-bold disabled:opacity-50"
                      disabled={page.offset === 0 || isLoading}
                      onClick={() =>
                        void fetchPage({
                          ...filters,
                          offset: Math.max(0, page.offset - page.limit),
                        })
                      }
                    >
                      Previous
                    </button>
                    <button
                      className="min-h-10 rounded-[0.6rem] border border-slate-200 bg-white px-3 font-bold disabled:opacity-50"
                      disabled={
                        page.offset + page.limit >= page.total || isLoading
                      }
                      onClick={() =>
                        void fetchPage({
                          ...filters,
                          offset: page.offset + page.limit,
                        })
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </OperationalPanel>
          ) : null}
          {historyOpened ? (
            <InventoryMovementHistory
              organizationId={organizationId}
              products={products}
              branches={branches}
              hidden={view !== 'history'}
              refreshKey={historyVersion}
            />
          ) : null}
        </>
      )}
      {operation ? (
        <InventoryOperationModal
          operation={operation}
          products={products}
          merchants={merchants}
          branches={branches}
          isSaving={isSaving}
          requestError={formError}
          onClose={() => setOperation(null)}
          onStockIn={saveStockIn}
          onAdjust={saveAdjustment}
        />
      ) : null}
    </OperationalPage>
  );
}

function InventoryRow({
  item,
  onAdjust,
}: {
  item: InventoryItem;
  onAdjust(): void;
}) {
  return (
    <tr className="border-t border-slate-200 text-slate-700 hover:bg-slate-50/60">
      <th className="px-6 py-4" scope="row">
        <span className="block font-bold text-slate-950">
          {item.product.name}
        </span>
        <span className="mt-1 block text-xs font-semibold text-slate-500">
          {item.product.sku}
        </span>
      </th>
      <td className="px-4 py-4">{item.product.merchant.name}</td>
      <td className="px-4 py-4">
        <span className="block font-semibold text-slate-700">
          {item.branch.name}
        </span>
        <span className="mt-1 block text-xs text-slate-500">
          {item.branch.code ?? 'No branch code'}
        </span>
      </td>
      <td
        className={`px-4 py-4 text-right text-base font-bold ${item.quantity < 0 ? 'text-red-600' : 'text-slate-950'}`}
      >
        {item.quantity}
      </td>
      <td className="px-6 py-4 text-right">
        <button
          className="border-0 bg-transparent p-0 text-sm font-bold text-emerald-700"
          type="button"
          onClick={onAdjust}
        >
          Adjust
        </button>
      </td>
    </tr>
  );
}
function Limited() {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-bold">Inventory access is limited</h2>
      <p className="mt-3 text-slate-500">
        Inventory management is currently available to owners and managers.
      </p>
    </section>
  );
}
function Empty() {
  return (
    <div className="py-10 text-center">
      <h3 className="text-base font-bold">No inventory found</h3>
      <p className="mt-2 text-slate-500">
        Adjust the filters or record the first stock-in.
      </p>
    </div>
  );
}
