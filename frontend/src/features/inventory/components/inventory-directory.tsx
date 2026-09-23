'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import type { MerchantView } from '@/features/merchants/model/merchant.types';
import type { ProductStatus } from '@/features/products/model/product.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import {
  OperationalPage,
  OperationalPanel,
  OperationalToolbar,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { Icon } from '@/shared/components/ui/icon';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { getInventoryBranch, listInventory } from '../api/inventory-api';
import type {
  BranchInventory,
  InventoryBranch,
  InventoryScope,
  InventoryStockStatus,
} from '../model/inventory.types';
import { InventoryPlacementForm } from './inventory-placement-form';
import { InventoryBranchSelector } from './inventory-branch-selector';
import { InventoryStockForm } from './inventory-stock-form';
import { inventoryStockQuantityClass } from './inventory-stock-status';
import { InventoryReconciliation } from './inventory-reconciliation';
import { InventoryMovementRecords } from './inventory-movement-records';
import { InventoryTableSkeleton } from './inventory-table-skeleton';

export function InventoryDirectory(
  props: InventoryScope & { initialStockStatus?: InventoryStockStatus },
) {
  const { user } = useAuth();
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedInventoryDirectory
      key={`${props.organizationId}:${props.branchId}:${organization?.role}:${user?.id}`}
      {...props}
    />
  );
}

function ScopedInventoryDirectory({
  organizationId,
  branchId,
  initialStockStatus,
}: InventoryScope & { initialStockStatus?: InventoryStockStatus }) {
  const { request } = useAuth();
  const { organization, organizationStatus, setSelectedBranchId } =
    useOrganizationWorkspaceContext();
  const allowed =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'MERCHANT';
  const canWrite =
    organization?.role === 'OWNER' || organization?.role === 'MANAGER';
  const [branch, setBranch] = useState<InventoryBranch | null>(null);
  const [items, setItems] = useState<BranchInventory[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [merchants, setMerchants] = useState<MerchantView[]>([]);
  const [search, setSearch] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [stockStatus, setStockStatus] = useState<InventoryStockStatus | ''>(
    initialStockStatus ?? '',
  );
  const [activeTab, setActiveTab] = useState<
    'stock' | 'movements' | 'integrity'
  >('stock');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [stockAction, setStockAction] = useState<{
    inventory: BranchInventory;
    mode: 'receipt' | 'adjustment';
  } | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = useRef(false);
  const readGeneration = useRef(0);
  const accessLost = useCallback(() => {
    readGeneration.current++;
    dirty.current = false;
    setCreating(false);
    setStockAction(null);
    setItems([]);
    setNextCursor(null);
    setLoadingMore(false);
    setMoreError(null);
    setBranch(null);
    setMerchants([]);
    setActiveTab('stock');
    setError(
      'Inventory access is unavailable. Ask an owner to check your branch assignment or merchant link.',
    );
    setLoading(false);
  }, []);
  const [revision, setRevision] = useState(0);
  const q = useDebouncedValue(search);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const generation = ++readGeneration.current;
    async function load() {
      await Promise.resolve();
      if (!active || generation !== readGeneration.current) return;
      setLoading(true);
      setError(null);
      setBranch(null);
      setItems([]);
      setNextCursor(null);
      setLoadingMore(false);
      setMoreError(null);
      setMerchants([]);
      try {
        const scope = { organizationId, branchId };
        const [location, inventory, profiles] = await Promise.all([
          getInventoryBranch(request, scope),
          listInventory(request, scope, {
            q: q.trim() || undefined,
            merchantId: merchantId || undefined,
            status: status || undefined,
            stockStatus: stockStatus || undefined,
          }),
          listMerchants(request, organizationId, {}, organization?.role),
        ]);
        if (active && generation === readGeneration.current) {
          setBranch(location);
          setItems(inventory.items);
          setNextCursor(inventory.nextCursor);
          setMerchants(profiles);
        }
      } catch (cause) {
        if (active && generation === readGeneration.current)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Branch inventory could not be loaded.',
          );
      } finally {
        if (active && generation === readGeneration.current) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [
    allowed,
    organization,
    request,
    organizationId,
    branchId,
    q,
    merchantId,
    status,
    stockStatus,
    revision,
  ]);
  async function loadMore() {
    if (!nextCursor || loading || loadingMore || error) return;
    const generation = readGeneration.current;
    const cursor = nextCursor;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listInventory(
        request,
        { organizationId, branchId },
        {
          q: q.trim() || undefined,
          merchantId: merchantId || undefined,
          status: status || undefined,
          stockStatus: stockStatus || undefined,
        },
        cursor,
      );
      if (generation !== readGeneration.current) return;
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (generation === readGeneration.current)
        setMoreError(
          cause instanceof ApiError
            ? cause.message
            : 'More placements could not be loaded.',
        );
    } finally {
      if (generation === readGeneration.current) setLoadingMore(false);
    }
  }
  if (organizationStatus === 'loading')
    return (
      <InventoryTableSkeleton
        variant="stock"
        label="Loading branch inventory"
      />
    );
  if (!allowed)
    return (
      <p role="alert" className="mt-8">
        Your organization role cannot view or manage branch inventory.
      </p>
    );
  const inventoryGrid = canWrite
    ? 'lg:grid-cols-[minmax(0,1.4fr)_minmax(6.5rem,0.75fr)_minmax(7rem,0.75fr)_minmax(7rem,0.6fr)_minmax(12rem,1fr)]'
    : 'lg:grid-cols-[minmax(0,1.5fr)_minmax(6.5rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)]';
  return (
    <OperationalPage>
      <PageHeader
        title="Inventory"
        description={
          canWrite
            ? 'Maintain this branch’s independent PHP prices and whole-unit stock.'
            : 'Read your merchant’s placements only. Prices, quantities, and history are specific to this branch.'
        }
        action={
          <InventoryBranchSelector
            organizationId={organizationId}
            branchId={branchId}
            role={organization!.role}
            disabled={pending}
            onAccessDenied={accessLost}
            rememberBranch={setSelectedBranchId}
            beforeChange={() => {
              if (
                pending ||
                (dirty.current &&
                  !window.confirm(
                    'Discard this unsaved inventory form and change branches?',
                  ))
              )
                return false;
              dirty.current = false;
              setCreating(false);
              setStockAction(null);
              readGeneration.current++;
              setItems([]);
              setNextCursor(null);
              setLoadingMore(false);
              setMoreError(null);
              setBranch(null);
              setSearch('');
              setMerchantId('');
              setStatus('');
              setStockStatus('');
              setActiveTab('stock');
              setSuccess(null);
              setLoading(true);
              return true;
            }}
            compact
          />
        }
      />
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      {allowed ? (
        <div
          className="mb-4 flex flex-wrap items-center gap-1 border-b border-hairline"
          role="tablist"
          aria-label="Inventory views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'stock'}
            aria-controls="inventory-stock-panel"
            className={`min-h-11 rounded-none border-b-2 px-3 text-sm font-semibold transition-colors ${
              activeTab === 'stock'
                ? 'border-ink text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
            onClick={() => setActiveTab('stock')}
          >
            Inventory stock
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'movements'}
            aria-controls="inventory-movement-records-panel"
            className={`min-h-11 rounded-none border-b-2 px-3 text-sm font-semibold transition-colors ${
              activeTab === 'movements'
                ? 'border-ink text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
            onClick={() => setActiveTab('movements')}
          >
            Movement records
          </button>
          {canWrite ? (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'integrity'}
              aria-controls="inventory-integrity-panel"
              className={`min-h-11 rounded-none border-b-2 px-3 text-sm font-semibold transition-colors ${
                activeTab === 'integrity'
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
              onClick={() => setActiveTab('integrity')}
            >
              Stock integrity
            </button>
          ) : null}
        </div>
      ) : null}
      {activeTab === 'stock' ? (
        <OperationalPanel
          id="inventory-stock-panel"
          variant="open"
          className="inventory-stock-surface"
          title="Inventory stock"
          description={
            loading
              ? 'Loading inventory…'
              : `${items.length} ${nextCursor ? 'displayed' : 'matching'} ${canWrite ? '' : 'own '}placements${nextCursor ? ' · more available' : ''}`
          }
          action={
            canWrite ? (
              <button
                type="button"
                className={buttonStyles({ variant: 'accent' })}
                disabled={loading || Boolean(error)}
                onClick={() => {
                  setSuccess(null);
                  dirty.current = false;
                  setCreating(true);
                }}
              >
                Add product placement
              </button>
            ) : undefined
          }
        >
          <OperationalToolbar
            variant="open"
            className="inventory-stock-toolbar grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
          >
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <label className="sr-only" htmlFor="inventory-search">
                Search
              </label>
              <div className="relative">
                <Icon
                  name="search"
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  id="inventory-search"
                  type="search"
                  maxLength={254}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Product, SKU, or barcode"
                  className="min-h-11 w-full min-w-0 rounded-full border border-control-border bg-surface py-2 pr-4 pl-10 text-sm placeholder:text-muted"
                />
              </div>
            </div>
            <div className="min-w-0">
              <label className="sr-only" htmlFor="inventory-stock-status">
                Stock status
              </label>
              <SelectControl
                id="inventory-stock-status"
                aria-label="Stock status"
                className="rounded-full bg-subtle px-4 text-sm font-medium lg:min-w-[10.5rem]"
                value={stockStatus}
                onValueChange={(value) =>
                  setStockStatus(value as InventoryStockStatus | '')
                }
              >
                <option value="">All stock statuses</option>
                <option value="IN_STOCK">In stock</option>
                <option value="LOW_STOCK">Low stock</option>
                <option value="OUT_OF_STOCK">Out of stock</option>
              </SelectControl>
            </div>
            <div className="min-w-0">
              <label className="sr-only" htmlFor="inventory-merchant">
                Merchant
              </label>
              <SelectControl
                id="inventory-merchant"
                aria-label="Merchant"
                className="rounded-full bg-subtle px-4 text-sm font-medium lg:min-w-[10rem]"
                value={merchantId}
                onValueChange={setMerchantId}
              >
                <option value="">All merchants</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </SelectControl>
            </div>
            <div className="min-w-0">
              <label className="sr-only" htmlFor="inventory-status">
                Product status
              </label>
              <SelectControl
                id="inventory-status"
                aria-label="Product status"
                className="rounded-full bg-subtle px-4 text-sm font-medium lg:min-w-[9.5rem]"
                value={status}
                onValueChange={(value) =>
                  setStatus(value as ProductStatus | '')
                }
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </SelectControl>
            </div>
          </OperationalToolbar>
          {loading ? (
            <InventoryTableSkeleton
              variant="stock"
              canWrite={canWrite}
              label="Loading inventory placements"
            />
          ) : error ? (
            <RequestError
              className="p-6"
              message={error}
              onRetry={() => setRevision((value) => value + 1)}
            />
          ) : !items.length ? (
            <div className="py-10 text-center sm:py-12">
              <h3 className="font-semibold">
                {search || merchantId || status || stockStatus
                  ? 'No placements match these filters'
                  : 'No product placements yet'}
              </h3>
              <p className="mt-2 text-sm text-muted">
                {search || merchantId || status || stockStatus
                  ? 'Try another search or filter.'
                  : canWrite
                    ? 'Place an active product here with a branch-specific price, then receive stock separately.'
                    : 'Your merchant has no placements here. A branch assignment never grants access to another merchant’s stock. Ask an owner if access needs configuring.'}
              </p>
            </div>
          ) : (
            <ul aria-label="Branch inventory" className="m-0 list-none p-0">
              <li
                className={`data-column-header inventory-column-header hidden gap-x-6 gap-y-3 lg:grid ${inventoryGrid}`}
              >
                <span>Product</span>
                <span>SKU</span>
                <span>Price</span>
                <span>Quantity</span>
                <span>Actions</span>
              </li>
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`data-row inventory-data-row grid min-w-0 gap-x-6 gap-y-3 lg:items-center ${inventoryGrid}`}
                >
                  <div className="min-w-0 break-words">
                    <strong className="block text-sm font-semibold">
                      {item.product.name}
                    </strong>
                    <span className="mt-1 block text-xs text-muted">
                      {item.product.merchant.name} ·{' '}
                      {item.product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className="min-w-0 break-words text-sm text-muted">
                    {item.product.sku ?? 'Not set'}
                  </span>
                  <span className="text-sm tabular-nums">
                    PHP {item.sellingPrice}
                  </span>
                  <span className="text-sm tabular-nums">
                    <strong
                      className={`block font-semibold ${inventoryStockQuantityClass(item.stockStatus)}`}
                    >
                      {item.quantity.toLocaleString()} units
                    </strong>
                    <span className="mt-1 block text-xs text-muted">
                      Threshold {item.lowStockThreshold.toLocaleString()}
                    </span>
                  </span>
                  <div
                    className="flex flex-wrap gap-x-3 gap-y-2 md:flex-nowrap md:whitespace-nowrap"
                    aria-label={`${item.product.name} stock actions`}
                  >
                    {canWrite ? (
                      <button
                        type="button"
                        className={buttonStyles({
                          variant: 'quiet',
                          className: 'min-h-9 px-2 py-1 text-xs',
                        })}
                        disabled={pending}
                        onClick={() => {
                          dirty.current = false;
                          setSuccess(null);
                          setStockAction({ inventory: item, mode: 'receipt' });
                        }}
                      >
                        Stock in
                      </button>
                    ) : null}
                    {canWrite ? (
                      <button
                        type="button"
                        className={buttonStyles({
                          variant: 'quiet',
                          className: 'min-h-9 px-2 py-1 text-xs',
                        })}
                        disabled={pending}
                        onClick={() => {
                          dirty.current = false;
                          setSuccess(null);
                          setStockAction({
                            inventory: item,
                            mode: 'adjustment',
                          });
                        }}
                      >
                        Adjust
                      </button>
                    ) : null}
                    <Link
                      href={`/app/organizations/${organizationId}/branches/${branchId}/inventory/${item.id}`}
                      aria-label={`View ${item.product.name} inventory`}
                      className={buttonStyles({
                        variant: 'quiet',
                        className: 'min-h-9 px-2 py-1 text-xs no-underline',
                      })}
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!loading && !error && nextCursor ? (
            <div className="border-t border-hairline px-0 py-5">
              {moreError ? (
                <p role="alert" className="mb-3 text-sm text-danger">
                  {moreError}
                </p>
              ) : null}
              <button
                type="button"
                className={buttonStyles({ variant: 'secondary' })}
                disabled={loadingMore}
                aria-busy={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore
                  ? 'Loading more…'
                  : moreError
                    ? 'Retry loading more'
                    : 'Load more placements'}
              </button>
            </div>
          ) : null}
        </OperationalPanel>
      ) : null}
      {activeTab === 'movements' && branch && !loading && !error ? (
        <InventoryMovementRecords
          key={`${organizationId}:${branchId}:${organization?.role}:${revision}`}
          organizationId={organizationId}
          branchId={branchId}
          role={organization!.role}
          merchants={merchants}
          onAccessLost={accessLost}
        />
      ) : null}
      {canWrite && activeTab === 'integrity' && branch && !loading && !error ? (
        <InventoryReconciliation
          key={`${organizationId}:${branchId}:${revision}`}
          id="inventory-integrity-panel"
          organizationId={organizationId}
          branchId={branchId}
        />
      ) : null}
      {creating && canWrite ? (
        <div
          onChangeCapture={() => {
            dirty.current = true;
          }}
          onClickCapture={(event) => {
            if (
              event.target instanceof HTMLElement &&
              event.target.closest('[role="option"]')
            )
              dirty.current = true;
          }}
        >
          <FormDialog
            title="Add product placement"
            description={`Place an existing product with its own selling price and stock tracking.`}
            pending={pending}
            onClose={() => {
              dirty.current = false;
              setCreating(false);
            }}
            headerAside={
              <>
                <span className="inline-flex max-w-full items-center rounded-full border border-control-border bg-subtle px-3 py-1.5 text-xs font-medium text-muted">
                  Branch: {branch?.name ?? 'This branch'}
                </span>
              </>
            }
          >
            <InventoryPlacementForm
              scope={{ organizationId, branchId }}
              onPendingChange={setPending}
              onCancel={() => {
                dirty.current = false;
                setCreating(false);
              }}
              onSaved={() => {
                dirty.current = false;
                setCreating(false);
                setSuccess('Product placement created with opening stock.');
                setRevision((value) => value + 1);
              }}
            />
          </FormDialog>
        </div>
      ) : null}
      {stockAction && canWrite ? (
        <div
          onChangeCapture={() => {
            dirty.current = true;
          }}
          onClickCapture={(event) => {
            if (
              event.target instanceof HTMLButtonElement &&
              event.target.getAttribute('aria-pressed') !== null
            )
              dirty.current = true;
          }}
        >
          <FormDialog
            title={`${stockAction.mode === 'receipt' ? 'Stock in' : 'Adjust'} ${stockAction.inventory.product.name} stock`}
            description="This action affects only this branch placement."
            headerAside={
              <>
                <span className="inline-flex max-w-full items-center rounded-full border border-control-border bg-subtle px-3 py-1.5 text-xs font-medium text-muted">
                  Branch: {branch?.name ?? 'This branch'}
                </span>
                <span className="inline-flex max-w-full items-center rounded-full border border-control-border bg-subtle px-3 py-1.5 text-xs font-medium text-muted">
                  Current units:{' '}
                  {stockAction.inventory.quantity.toLocaleString()}
                </span>
              </>
            }
            pending={pending}
            onClose={() => {
              dirty.current = false;
              setStockAction(null);
            }}
          >
            <InventoryStockForm
              scope={{
                organizationId,
                branchId,
                inventoryId: stockAction.inventory.id,
              }}
              inventory={stockAction.inventory}
              mode={stockAction.mode}
              branchName={branch?.name}
              onPendingChange={setPending}
              onAccessLost={accessLost}
              onCancel={() => {
                dirty.current = false;
                setStockAction(null);
              }}
              onSaved={() => {
                const action =
                  stockAction.mode === 'receipt' ? 'receipt' : 'correction';
                dirty.current = false;
                setStockAction(null);
                setSuccess(
                  `Stock ${action} recorded for ${stockAction.inventory.product.name}. Refreshing branch inventory.`,
                );
                setRevision((value) => value + 1);
              }}
            />
          </FormDialog>
        </div>
      ) : null}
    </OperationalPage>
  );
}
