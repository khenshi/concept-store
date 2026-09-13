'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import type { MerchantView } from '@/features/merchants/model/merchant.types';
import type { ProductStatus } from '@/features/products/model/product.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BackLink } from '@/shared/components/ui/back-link';
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
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { getInventoryBranch, listInventory } from '../api/inventory-api';
import type {
  BranchInventory,
  InventoryBranch,
  InventoryScope,
} from '../model/inventory.types';
import { InventoryPlacementForm } from './inventory-placement-form';

export function InventoryDirectory(props: InventoryScope) {
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedInventoryDirectory
      key={`${props.organizationId}:${props.branchId}:${organization?.role}`}
      {...props}
    />
  );
}

function ScopedInventoryDirectory({
  organizationId,
  branchId,
}: InventoryScope) {
  const { request } = useAuth();
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const allowed =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'MERCHANT';
  const canWrite =
    organization?.role === 'OWNER' || organization?.role === 'MANAGER';
  const [branch, setBranch] = useState<InventoryBranch | null>(null);
  const [items, setItems] = useState<BranchInventory[]>([]);
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
    if (!allowed) return;
    let active = true;
    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);
      setBranch(null);
      setItems([]);
      setMerchants([]);
      try {
        const scope = { organizationId, branchId };
        const [location, inventory, profiles] = await Promise.all([
          getInventoryBranch(request, scope),
          listInventory(request, scope, {
            q: q.trim() || undefined,
            merchantId: merchantId || undefined,
            status: status || undefined,
          }),
          listMerchants(request, organizationId, {}, organization?.role),
        ]);
        if (active) {
          setBranch(location);
          setItems(inventory);
          setMerchants(profiles);
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Branch inventory could not be loaded.',
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
    organization,
    request,
    organizationId,
    branchId,
    q,
    merchantId,
    status,
    revision,
  ]);
  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading branch inventory" />;
  if (!allowed)
    return (
      <p role="alert" className="mt-8">
        Your organization role cannot view or manage branch inventory.
      </p>
    );
  return (
    <OperationalPage>
      <BackLink
        href={`/app/organizations/${organizationId}/branches/${branchId}`}
      >
        Back to branch
      </BackLink>
      <PageHeader
        title={branch ? `${branch.name} inventory` : 'Branch inventory'}
        description={
          canWrite
            ? 'Maintain this branch’s independent PHP prices and whole-unit stock.'
            : 'Read your merchant’s placements only. Prices, quantities, and history are specific to this branch.'
        }
      />
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      <OperationalPanel
        title="Inventory"
        description={
          loading
            ? 'Loading inventory…'
            : `${items.length} matching ${canWrite ? '' : 'own '}placements`
        }
        action={
          canWrite ? (
            <button
              type="button"
              className={buttonStyles({ variant: 'primary' })}
              disabled={loading || Boolean(error)}
              onClick={() => {
                setSuccess(null);
                setCreating(true);
              }}
            >
              Add product placement
            </button>
          ) : undefined
        }
      >
        <OperationalToolbar className="grid gap-4 md:grid-cols-3">
          <FilterField id="inventory-search" label="Search">
            <input
              id="inventory-search"
              type="search"
              maxLength={254}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product, SKU, or barcode"
              className="min-h-11 min-w-0 rounded-control border border-control-border bg-surface px-3 text-sm"
            />
          </FilterField>
          <FilterField id="inventory-merchant" label="Merchant">
            <SelectControl
              id="inventory-merchant"
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
          </FilterField>
          <FilterField id="inventory-status" label="Product status">
            <SelectControl
              id="inventory-status"
              value={status}
              onValueChange={(value) => setStatus(value as ProductStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </SelectControl>
          </FilterField>
        </OperationalToolbar>
        {loading ? (
          <ListSkeleton className="p-6" label="Loading inventory placements" />
        ) : error ? (
          <RequestError
            className="p-6"
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : !items.length ? (
          <div className="p-6 text-center">
            <h3 className="font-semibold">
              {search || merchantId || status
                ? 'No placements match these filters'
                : 'No product placements yet'}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {search || merchantId || status
                ? 'Try another search or filter.'
                : canWrite
                  ? 'Place an active product here with a branch-specific price, then receive stock separately.'
                  : 'Your merchant has no placements here. A branch assignment never grants access to another merchant’s stock. Ask an owner if access needs configuring.'}
            </p>
          </div>
        ) : (
          <ul
            aria-label="Branch inventory"
            className="m-0 list-none divide-y divide-hairline p-0"
          >
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/app/organizations/${organizationId}/branches/${branchId}/inventory/${item.id}`}
                  aria-label={`View ${item.product.name} inventory`}
                  className="grid min-w-0 gap-3 px-6 py-5 text-ink no-underline hover:bg-subtle sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                >
                  <div className="min-w-0 break-words">
                    <strong className="block text-sm font-semibold">
                      {item.product.name}
                    </strong>
                    <span className="mt-1 block text-xs text-muted">
                      {item.product.merchant.name} ·{' '}
                      {item.product.status === 'ACTIVE' ? 'Active' : 'Inactive'}{' '}
                      · SKU {item.product.sku ?? 'not set'}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums">
                    PHP {item.sellingPrice}
                  </span>
                  <span className="text-sm tabular-nums">
                    {item.quantity.toLocaleString()} units
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OperationalPanel>
      {creating && canWrite ? (
        <FormDialog
          title="Add product placement"
          description={`Place an existing product in ${branch?.name ?? 'this branch'} with its own selling price and stock tracking.`}
          pending={pending}
          onClose={() => setCreating(false)}
        >
          <InventoryPlacementForm
            scope={{ organizationId, branchId }}
            onPendingChange={setPending}
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              setSuccess(
                'Product placement created with zero stock. Receive opening stock separately.',
              );
              setRevision((value) => value + 1);
            }}
          />
        </FormDialog>
      ) : null}
    </OperationalPage>
  );
}
