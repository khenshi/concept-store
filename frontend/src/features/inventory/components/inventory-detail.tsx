'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BackLink } from '@/shared/components/ui/back-link';
import { buttonStyles } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
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
import { InventoryThresholdForm } from './inventory-threshold-form';
import { InventoryStockForm } from './inventory-stock-form';
import { InventoryBranchSelector } from './inventory-branch-selector';

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
    'threshold' | 'receipt' | 'adjustment' | null
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
      className="min-h-9 min-w-0 px-3 py-1 text-xs"
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
  const movementGrid = canWrite
    ? 'lg:grid-cols-[minmax(10rem,1.15fr)_minmax(7rem,0.7fr)_minmax(12rem,1.4fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_minmax(12rem,1.25fr)]'
    : 'lg:grid-cols-[minmax(10rem,1.15fr)_minmax(7rem,0.7fr)_minmax(12rem,1.4fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)]';
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
  const stockActions = canWrite ? (
    <div
      className="inventory-detail-actions grid min-w-0 gap-x-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
      onChangeCapture={() => {
        dirty.current = true;
      }}
    >
      <section className="mt-10 min-w-0 bg-surface text-ink">
        <div className="grid min-w-0 gap-6 md:grid-cols-2">
          <section className="min-w-0">
            <header className="pb-4">
              <h2 className="text-base font-semibold">Receive stock</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Record positive whole units entering this branch.
              </p>
            </header>
            <fieldset
              className="min-w-0 border-0 p-0"
              disabled={
                pendingOperation !== null && pendingOperation !== 'receipt'
              }
            >
              <InventoryStockForm
                inlineReceiptAction
                onAccessLost={accessLost}
                mode="receipt"
                scope={scope}
                inventory={inventory}
                branchName={branch.name}
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
          </section>
          <section className="min-w-0 md:border-l md:border-hairline md:pl-6">
            <header className="pb-4">
              <h2 className="text-base font-semibold">Low-stock threshold</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                Warn at or below this stock level.
              </p>
            </header>
            <fieldset
              className="min-w-0 border-0 p-0"
              disabled={
                pendingOperation !== null && pendingOperation !== 'threshold'
              }
            >
              <InventoryThresholdForm
                inlineAction
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
          </section>
        </div>
      </section>
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
            branchName={branch.name}
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
  ) : null;
  return (
    <OperationalPage>
      <div className="mb-4">{back}</div>
      <PageHeader
        title={inventory.product.name}
        description={`${branch.name} · ${inventory.product.merchant.name} · ${inventory.product.status === 'ACTIVE' ? 'Active' : 'Inactive'} product`}
        action={branchSelector}
      />
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      <section className="inventory-placement-panel mt-3 mb-1 pb-3 border-b border-hairline bg-surface text-ink">
        <dl className="inventory-placement-summary grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
          <div className="inventory-placement-stat flex items-center justify-start gap-3 px-4 py-5 lg:py-6">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-subtle">
              <Icon name="tag" className="size-5 text-muted" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted">Branch price</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                PHP {inventory.sellingPrice}
              </dd>
            </div>
          </div>
          <div className="inventory-placement-stat flex items-center justify-start gap-3 px-4 py-5 lg:py-6">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-subtle">
              <Icon name="box" className="size-5 text-muted" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted">Current stock</dt>
              <dd
                className={`mt-1 font-semibold tabular-nums ${
                  inventory.stockStatus === 'IN_STOCK'
                    ? 'text-success-ink'
                    : inventory.stockStatus === 'LOW_STOCK'
                      ? 'text-warning'
                      : 'text-danger'
                }`}
              >
                {inventory.quantity.toLocaleString()} units
              </dd>
            </div>
          </div>
          <div className="inventory-placement-stat flex items-center justify-start gap-3 px-4 py-5 lg:py-6">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-subtle">
              <Icon name="bell" className="size-5 text-muted" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted">Product threshold</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {inventory.lowStockThreshold.toLocaleString()} units
              </dd>
            </div>
          </div>
          <div className="inventory-placement-stat flex items-center justify-start gap-3 px-4 py-5 lg:py-6">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-subtle">
              <Icon name="file" className="size-5 text-muted" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-muted">Product profile</dt>
              <dd className="mt-1">
                <Link
                  className="inline-flex items-center gap-2 font-medium text-ink"
                  href={`/app/organizations/${organizationId}/products/${inventory.productId}`}
                >
                  View profile
                  <Icon name="arrow" className="size-4 -rotate-45" />
                </Link>
              </dd>
            </div>
          </div>
        </dl>
      </section>
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
              <li
                className={`data-column-header inventory-movement-header hidden gap-x-6 gap-y-3 lg:grid ${movementGrid}`}
              >
                <span>Date & time</span>
                <span>Type</span>
                <span>Description</span>
                <span>Change</span>
                <span>Balance after</span>
                {canWrite ? <span>Actor ID</span> : null}
              </li>
              {movements.map((movement) => (
                <li
                  key={movement.id}
                  className={`data-row inventory-movement-row grid min-w-0 gap-x-6 gap-y-3 px-3 py-4 sm:px-4 lg:items-center ${movementGrid}`}
                >
                  <time
                    className="text-sm text-muted"
                    dateTime={movement.createdAt}
                  >
                    {new Date(movement.createdAt).toLocaleString()}
                  </time>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon
                      name={
                        movement.type === 'ADJUSTMENT'
                          ? 'pencil'
                          : movement.type === 'SALE'
                            ? 'minus'
                            : 'plus'
                      }
                      className="size-4 text-muted"
                    />
                    {movement.type === 'RECEIPT'
                      ? 'Receipt'
                      : movement.type === 'SALE'
                        ? 'Sale'
                        : movement.type === 'RETURN'
                          ? 'Return'
                          : 'Adjustment'}
                  </span>
                  <span className="min-w-0 break-words text-sm">
                    {movement.reason}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {movement.quantityChange > 0 ? '+' : ''}
                    {movement.quantityChange.toLocaleString()} units
                  </span>
                  <span className="text-sm tabular-nums">
                    {movement.quantityAfter.toLocaleString()}
                  </span>
                  {canWrite && 'createdById' in movement ? (
                    <span className="min-w-0 break-all text-xs text-muted">
                      Actor ID: {movement.createdById}
                    </span>
                  ) : null}
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
      {stockActions}
    </OperationalPage>
  );
}
