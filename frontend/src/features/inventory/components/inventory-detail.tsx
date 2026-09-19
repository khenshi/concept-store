'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BackLink } from '@/shared/components/ui/back-link';
import { buttonStyles } from '@/shared/components/ui/button';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import {
  getInventory,
  getInventoryBranch,
  listMovements,
} from '../api/inventory-api';
import type {
  BranchInventory,
  InventoryBranch,
  InventoryDetailScope,
  InventoryMovementView,
} from '../model/inventory.types';
import { InventoryPriceForm } from './inventory-price-form';
import { InventoryThresholdForm } from './inventory-threshold-form';
import { InventoryStockForm } from './inventory-stock-form';
import { InventoryBranchSelector } from './inventory-branch-selector';
import { InventoryStockStatusBadge } from './inventory-stock-status';

export function InventoryDetail(props: InventoryDetailScope) {
  const { user } = useAuth();
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedInventoryDetail
      key={`${props.organizationId}:${props.branchId}:${props.inventoryId}:${organization?.role}:${user?.id}`}
      {...props}
    />
  );
}

function ScopedInventoryDetail({
  organizationId,
  branchId,
  inventoryId,
}: InventoryDetailScope) {
  const { request } = useAuth();
  const { organization, organizationStatus, setSelectedBranchId } =
    useOrganizationWorkspaceContext();
  const allowed =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'MERCHANT';
  const canWrite =
    organization?.role === 'OWNER' || organization?.role === 'MANAGER';
  const [inventory, setInventory] = useState<BranchInventory | null>(null);
  const [branch, setBranch] = useState<InventoryBranch | null>(null);
  const [movements, setMovements] = useState<InventoryMovementView[]>([]);
  const [nextMovementCursor, setNextMovementCursor] = useState<string | null>(
    null,
  );
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<
    'price' | 'threshold' | 'receipt' | 'adjustment' | null
  >(null);
  const [revision, setRevision] = useState(0);
  const dirty = useRef(false);
  const readGeneration = useRef(0);
  const accessLost = useCallback(() => {
    readGeneration.current++;
    dirty.current = false;
    setInventory(null);
    setBranch(null);
    setMovements([]);
    setNextMovementCursor(null);
    setOlderError(null);
    setOlderLoading(false);
    setLoading(false);
    setError(
      'Access to this placement is unavailable. Ask an owner to review your branch assignments or merchant link.',
    );
  }, []);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const generation = ++readGeneration.current;
    async function load() {
      await Promise.resolve();
      if (!active || generation !== readGeneration.current) return;
      setLoading(true);
      setError(null);
      setInventory(null);
      setBranch(null);
      setMovements([]);
      setNextMovementCursor(null);
      setOlderError(null);
      setOlderLoading(false);
      try {
        const scope = { organizationId, branchId, inventoryId };
        const [item, location, history] = await Promise.all([
          getInventory(request, scope),
          getInventoryBranch(request, scope),
          listMovements(request, scope, organization?.role),
        ]);
        if (active && generation === readGeneration.current) {
          setInventory(item);
          setBranch(location);
          setMovements(history.items);
          setNextMovementCursor(history.nextCursor);
        }
      } catch (cause) {
        if (active && generation === readGeneration.current)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Inventory and movement history could not be refreshed.',
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
    inventoryId,
    revision,
  ]);
  useEffect(() => {
    const activeGeneration = readGeneration;
    return () => {
      activeGeneration.current++;
    };
  }, []);
  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading inventory" />;
  if (!allowed)
    return (
      <p role="alert" className="mt-8">
        Your organization role cannot view or manage branch inventory.
      </p>
    );
  const back = (
    <BackLink
      href={`/app/organizations/${organizationId}/branches/${branchId}/inventory`}
    >
      Back to branch inventory
    </BackLink>
  );
  const branchSelector = (
    <InventoryBranchSelector
      organizationId={organizationId}
      branchId={branchId}
      role={organization!.role}
      disabled={pendingOperation !== null}
      onAccessDenied={accessLost}
      rememberBranch={setSelectedBranchId}
      beforeChange={() => {
        if (
          pendingOperation !== null ||
          (dirty.current &&
            !window.confirm(
              'Discard this unsaved inventory form and change branches?',
            ))
        )
          return false;
        dirty.current = false;
        readGeneration.current++;
        setInventory(null);
        setBranch(null);
        setMovements([]);
        setNextMovementCursor(null);
        setOlderError(null);
        setSuccess(null);
        setLoading(true);
        return true;
      }}
      compact
    />
  );
  if (loading)
    return (
      <OperationalPage>
        {back}
        {branchSelector}
        {success ? <StatusNotice>{success}</StatusNotice> : null}
        <ListSkeleton label="Refreshing current stock and movement history" />
      </OperationalPage>
    );
  // A successful command followed by a failed refresh must not leave stale stock actionable.
  if (error || !inventory || !branch)
    return (
      <OperationalPage>
        {back}
        {branchSelector}
        {success ? <StatusNotice>{success}</StatusNotice> : null}
        <RequestError
          message={error ?? 'Inventory unavailable.'}
          onRetry={() => setRevision((value) => value + 1)}
        />
      </OperationalPage>
    );
  const scope = { organizationId, branchId, inventoryId };
  const saved = (message: string) => {
    dirty.current = false;
    setSuccess(message);
    setRevision((value) => value + 1);
  };
  const loadOlder = async () => {
    if (!nextMovementCursor || olderLoading) return;
    const generation = readGeneration.current;
    setOlderLoading(true);
    setOlderError(null);
    try {
      const history = await listMovements(
        request,
        scope,
        organization?.role,
        nextMovementCursor,
      );
      if (generation !== readGeneration.current) return;
      setMovements((current) => [...current, ...history.items]);
      setNextMovementCursor(history.nextCursor);
    } catch (cause) {
      if (generation !== readGeneration.current) return;
      if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) {
        accessLost();
        return;
      }
      setOlderError(
        cause instanceof ApiError
          ? cause.message
          : 'Older movements could not be loaded.',
      );
    } finally {
      if (generation === readGeneration.current) setOlderLoading(false);
    }
  };
  return (
    <OperationalPage>
      {back}
      <PageHeader
        title={inventory.product.name}
        description={`${branch.name} · ${inventory.product.merchant.name} · ${inventory.product.status === 'ACTIVE' ? 'Active' : 'Inactive'} product`}
        action={branchSelector}
      />
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      <OperationalPanel variant="open" title="Current placement">
        <dl className="grid gap-5 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Branch price</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              PHP {inventory.sellingPrice}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Current stock</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {inventory.quantity.toLocaleString()} units
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Stock status</dt>
            <dd className="mt-1 font-semibold">
              <InventoryStockStatusBadge status={inventory.stockStatus} />
            </dd>
            <p className="mt-1 text-xs text-muted tabular-nums">
              Threshold: {inventory.lowStockThreshold.toLocaleString()}
            </p>
          </div>
          <div>
            <dt className="text-xs text-muted">Product identity</dt>
            <dd className="mt-1">
              <Link
                href={`/app/organizations/${organizationId}/products/${inventory.productId}`}
              >
                View product profile
              </Link>
            </dd>
          </div>
        </dl>
        <p className="px-6 pb-6 text-sm text-muted">
          This placement is independent. Commands never transfer stock or change
          another branch’s price.
        </p>
      </OperationalPanel>
      {canWrite ? (
        <div
          onChangeCapture={() => {
            dirty.current = true;
          }}
        >
          <div className="grid min-w-0 gap-x-6 lg:grid-cols-2">
            <OperationalPanel variant="open" title="Branch selling price">
              <fieldset
                className="min-w-0 border-0 p-0"
                disabled={
                  pendingOperation !== null && pendingOperation !== 'price'
                }
              >
                <InventoryPriceForm
                  onAccessLost={accessLost}
                  scope={scope}
                  inventory={inventory}
                  onPendingChange={(pending) =>
                    setPendingOperation(pending ? 'price' : null)
                  }
                  onSaved={() =>
                    saved(
                      'Branch price saved. Refreshing the current placement.',
                    )
                  }
                />
              </fieldset>
            </OperationalPanel>
            <OperationalPanel variant="open" title="Low-stock threshold">
              <fieldset
                className="min-w-0 border-0 p-0"
                disabled={
                  pendingOperation !== null && pendingOperation !== 'threshold'
                }
              >
                <InventoryThresholdForm
                  onAccessLost={accessLost}
                  scope={scope}
                  inventory={inventory}
                  onPendingChange={(pending) =>
                    setPendingOperation(pending ? 'threshold' : null)
                  }
                  onSaved={() =>
                    saved(
                      'Low-stock threshold saved. Refreshing the current placement.',
                    )
                  }
                />
              </fieldset>
            </OperationalPanel>
          </div>
          <div className="grid min-w-0 gap-x-6 lg:grid-cols-2">
            <OperationalPanel
              variant="open"
              title="Receive stock"
              description="Record positive whole units and why they entered this branch."
            >
              <fieldset
                className="min-w-0 border-0 p-0"
                disabled={
                  pendingOperation !== null && pendingOperation !== 'receipt'
                }
              >
                <InventoryStockForm
                  onAccessLost={accessLost}
                  mode="receipt"
                  scope={scope}
                  inventory={inventory}
                  onPendingChange={(pending) =>
                    setPendingOperation(pending ? 'receipt' : null)
                  }
                  onSaved={() =>
                    saved(
                      'Stock receipt recorded. Refreshing current stock and history.',
                    )
                  }
                />
              </fieldset>
            </OperationalPanel>
            <OperationalPanel
              variant="open"
              title="Correct stock"
              description="Review a signed correction before applying it. Available for inactive products or merchants."
            >
              <fieldset
                className="min-w-0 border-0 p-0"
                disabled={
                  pendingOperation !== null && pendingOperation !== 'adjustment'
                }
              >
                <InventoryStockForm
                  onAccessLost={accessLost}
                  mode="adjustment"
                  scope={scope}
                  inventory={inventory}
                  onPendingChange={(pending) =>
                    setPendingOperation(pending ? 'adjustment' : null)
                  }
                  onSaved={() =>
                    saved(
                      'Stock adjustment recorded. Refreshing current stock and history.',
                    )
                  }
                />
              </fieldset>
            </OperationalPanel>
          </div>
        </div>
      ) : null}
      <OperationalPanel
        variant="open"
        className="data-surface"
        title="Movement history"
        description={
          canWrite
            ? 'Immutable receipts and adjustments, newest first. Actor identifiers are retained without exposing personal details.'
            : 'Your immutable receipts and adjustments, newest first. Member identities are not exposed.'
        }
      >
        {!movements.length ? (
          <p className="p-6 text-sm text-muted">
            No stock movements yet. New placements start at zero without an
            opening movement.
          </p>
        ) : (
          <>
            <ol
              aria-label="Inventory movement history"
              className="m-0 list-none p-0"
            >
              <li className="data-column-header hidden grid-cols-[minmax(0,1.5fr)_minmax(12rem,auto)] gap-x-6 gap-y-3 sm:grid">
                <span>Movement</span>
                <span>Quantity and balance</span>
              </li>
              {movements.map((movement) => (
                <li
                  key={movement.id}
                  className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(12rem,auto)] sm:items-center"
                >
                  <div className="min-w-0 break-words">
                    <strong className="text-sm font-semibold">
                      {movement.type === 'RECEIPT'
                        ? 'Receipt'
                        : movement.type === 'SALE'
                          ? 'Sale'
                          : movement.type === 'RETURN'
                            ? 'Return'
                            : 'Adjustment'}
                    </strong>
                    <p className="mt-1 text-sm">{movement.reason}</p>
                    <p className="mt-2 text-xs text-muted">
                      <time dateTime={movement.createdAt}>
                        {new Date(movement.createdAt).toLocaleString()}
                      </time>
                      {canWrite && 'createdById' in movement ? (
                        <>
                          <br />
                          Actor ID: {movement.createdById}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="text-sm tabular-nums">
                    <p className="font-semibold">
                      {movement.quantityChange > 0 ? '+' : ''}
                      {movement.quantityChange.toLocaleString()} units
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Balance after: {movement.quantityAfter.toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {olderError ? (
              <RequestError
                className="p-6"
                message={olderError}
                onRetry={() => void loadOlder()}
              />
            ) : null}
            {nextMovementCursor ? (
              <div className="border-t border-hairline p-6">
                <button
                  type="button"
                  className={buttonStyles({ variant: 'quiet' })}
                  disabled={olderLoading}
                  onClick={() => void loadOlder()}
                >
                  {olderLoading
                    ? 'Loading older movements…'
                    : 'Load older movements'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </OperationalPanel>
    </OperationalPage>
  );
}
