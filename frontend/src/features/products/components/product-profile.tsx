'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { getMerchant } from '@/features/merchants/api/merchant-api';
import type { MerchantView } from '@/features/merchants/model/merchant.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BackLink } from '@/shared/components/ui/back-link';
import { buttonStyles } from '@/shared/components/ui/button';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPanel,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import {
  getProduct,
  getProductPlacements,
  updateProductStatus,
} from '../api/product-api';
import type {
  Product,
  ProductPlacement,
  ProductStatus,
} from '../model/product.types';
import { inventoryStockStatusLabel } from '@/features/inventory/components/inventory-stock-status';
import { ProductForm } from './product-form';

export function ProductProfile(props: {
  organizationId: string;
  productId: string;
}) {
  const { organization } = useOrganizationWorkspaceContext();
  return (
    <ScopedProductProfile
      key={`${props.organizationId}:${props.productId}:${organization?.role}`}
      {...props}
    />
  );
}

function ScopedProductProfile({
  organizationId,
  productId,
}: {
  organizationId: string;
  productId: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const allowed =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'MERCHANT';
  const canEdit = organization?.role === 'OWNER';
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [product, setProduct] = useState<Product | null>(null);
  const [merchant, setMerchant] = useState<MerchantView | null>(null);
  const [placements, setPlacements] = useState<ProductPlacement[]>([]);
  const [status, setStatus] = useState<ProductStatus>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const statusLock = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);
      setProduct(null);
      setMerchant(null);
      setPlacements([]);
      try {
        const item = await getProduct(request, organizationId, productId);
        const [profile, inventory] = await Promise.all([
          getMerchant(
            request,
            organizationId,
            item.merchantId,
            organization?.role,
          ),
          getProductPlacements(request, organizationId, productId),
        ]);
        if (active) {
          setProduct(item);
          setMerchant(profile);
          setPlacements(inventory);
          setStatus(item.status);
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'The product profile could not be loaded.',
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [allowed, organization, request, organizationId, productId, revision]);
  async function changeStatus() {
    if (
      !canEdit ||
      !product ||
      pending ||
      statusLock.current ||
      status === product.status
    )
      return;
    statusLock.current = true;
    const nextStatus = status;
    try {
      if (
        !(await confirm({
          title: `Make ${product.name} ${nextStatus.toLowerCase()}?`,
          description:
            'This changes only product status. Branch prices, quantities, and movement history are preserved. Inactive products cannot receive new stock or placements.',
          confirmLabel: 'Change status',
          tone: nextStatus === 'INACTIVE' ? 'danger' : 'primary',
        }))
      )
        return;
      setPending(true);
      setError(null);
      setSuccess(null);
      const saved = await updateProductStatus(
        request,
        organizationId,
        product.id,
        nextStatus,
      );
      setProduct(saved);
      setStatus(saved.status);
      setSuccess(`${saved.name} is now ${saved.status.toLowerCase()}.`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Product status could not be changed.',
      );
    } finally {
      statusLock.current = false;
      setPending(false);
    }
  }
  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading product profile" />;
  if (!allowed)
    return (
      <p role="alert" className="mt-8">
        Your organization role cannot view or manage products.
      </p>
    );
  const back = (
    <BackLink href={`/app/organizations/${organizationId}/products`}>
      Back to products
    </BackLink>
  );
  if (loading)
    return (
      <section className="mt-6">
        {back}
        <ListSkeleton label="Loading product profile" className="mt-6" />
      </section>
    );
  if (!product || !merchant)
    return (
      <section className="mt-6">
        {back}
        <RequestError
          className="mt-6"
          message={error ?? 'Product unavailable.'}
          onRetry={() => setRevision((value) => value + 1)}
        />
      </section>
    );
  return (
    <section className="mx-auto mt-6 grid max-w-5xl gap-6">
      {back}
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5">
        <div className="min-w-0 break-words">
          <h1 className="text-page font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {merchant.name} ·{' '}
            {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className={buttonStyles({ variant: 'primary' })}
            disabled={pending}
            onClick={() => {
              setEditing(true);
              setSuccess(null);
            }}
          >
            Edit profile
          </button>
        ) : null}
      </header>
      {success ? <StatusNotice>{success}</StatusNotice> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <OperationalPanel title="Product identity">
        <dl className="grid gap-5 break-words p-6 sm:grid-cols-2 [&>div]:min-w-0">
          {[
            ['Merchant', merchant.name],
            ['Product name', product.name],
            ['SKU', product.sku ?? 'Not set'],
            ['Barcode', product.barcode ?? 'Not set'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-muted">{label}</dt>
              <dd className="mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="px-6 pb-6 text-sm text-muted">
          Each product has one fixed merchant. Branch prices and stock are
          independent.
        </p>
      </OperationalPanel>
      {canEdit ? (
        <OperationalPanel
          title="Lifecycle status"
          description="Status changes require confirmation and do not modify inventory."
        >
          <div className="flex flex-wrap items-end gap-3 p-6">
            <label
              htmlFor="product-lifecycle"
              className="grid w-full max-w-xs gap-2 text-label font-semibold"
            >
              Status
              <SelectControl
                id="product-lifecycle"
                value={status}
                disabled={pending}
                onValueChange={(value) => setStatus(value as ProductStatus)}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </SelectControl>
            </label>
            <button
              type="button"
              className={buttonStyles({ variant: 'secondary' })}
              disabled={pending || status === product.status}
              aria-busy={pending}
              onClick={() => void changeStatus()}
            >
              {pending ? 'Changing…' : 'Change status'}
            </button>
          </div>
        </OperationalPanel>
      ) : null}
      <OperationalPanel
        title="Branch placements"
        description="PHP selling price and whole-unit stock for each branch. Placing a product elsewhere does not transfer existing stock."
      >
        {!placements.length ? (
          <p className="p-6 text-sm text-muted">
            This product has no branch placements yet.
          </p>
        ) : (
          <ul
            aria-label="Branch placements"
            className="m-0 list-none divide-y divide-hairline p-0"
          >
            {placements.map((placement) => (
              <li
                key={placement.id}
                className="grid min-w-0 gap-3 p-6 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <Link
                  className="min-w-0 break-words"
                  href={`/app/organizations/${organizationId}/branches/${placement.branchId}/inventory/${placement.id}`}
                >
                  {placement.branch.name}
                  {placement.branch.code ? ` · ${placement.branch.code}` : ''}
                </Link>
                <span className="text-sm tabular-nums">
                  PHP {placement.sellingPrice}
                </span>
                <span className="text-sm tabular-nums">
                  {placement.quantity.toLocaleString()} units ·{' '}
                  {inventoryStockStatusLabel(placement.stockStatus)} · threshold{' '}
                  {placement.lowStockThreshold.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </OperationalPanel>
      {editing && canEdit ? (
        <FormDialog
          title="Edit product profile"
          description="Update product identity without changing merchant ownership, lifecycle, price, or stock."
          pending={pending}
          onClose={() => setEditing(false)}
        >
          <ProductForm
            organizationId={organizationId}
            merchants={[merchant]}
            product={product}
            onPendingChange={setPending}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              setProduct(saved);
              setStatus(saved.status);
              setEditing(false);
              setSuccess(`${saved.name} was updated successfully.`);
            }}
          />
        </FormDialog>
      ) : null}
      {confirmationDialog}
    </section>
  );
}
