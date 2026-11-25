'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { getMerchant } from '@/features/merchants/api/merchant-api';
import type { MerchantView } from '@/features/merchants/model/merchant.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
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
  async function changeStatus(nextStatus = status) {
    if (
      !canEdit ||
      !product ||
      pending ||
      statusLock.current ||
      nextStatus === product.status
    )
      return;
    statusLock.current = true;
    setPending(true);
    try {
      if (
        !(await confirm({
          title: `Make ${product.name} ${nextStatus.toLowerCase()}?`,
          description:
            nextStatus === 'INACTIVE'
              ? 'This stops selling the product and prevents new placements or stock receipts. Branch prices, quantities, and movement history are preserved.'
              : 'This allows the product to be sold again. Branch prices, quantities, and movement history are preserved.',
          confirmLabel: 'Change status',
          tone: nextStatus === 'INACTIVE' ? 'danger' : 'primary',
        }))
      ) {
        setStatus(product.status);
        return;
      }
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
      setStatus(product.status);
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
    return (
      <OrganizationPageFrame>
        <ListSkeleton label="Loading product profile" />
      </OrganizationPageFrame>
    );
  if (!allowed)
    return (
      <OrganizationPageFrame>
        <p role="alert">
          Your organization role cannot view or manage products.
        </p>
      </OrganizationPageFrame>
    );
  const back = (
    <BackLink href={`/app/organizations/${organizationId}/products`}>
      Back to products
    </BackLink>
  );
  if (loading)
    return (
      <OrganizationPageFrame>
        {back}
        <ListSkeleton label="Loading product profile" className="mt-6" />
      </OrganizationPageFrame>
    );
  if (!product || !merchant)
    return (
      <OrganizationPageFrame>
        {back}
        <RequestError
          className="mt-6"
          message={error ?? 'Product unavailable.'}
          onRetry={() => setRevision((value) => value + 1)}
        />
      </OrganizationPageFrame>
    );
  return (
    <OrganizationPageFrame>
      <section className="grid gap-5">
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
            <div className="flex w-full flex-wrap items-end justify-end gap-3 sm:w-auto">
              <label
                className="grid min-w-48 gap-2 text-label font-semibold"
                htmlFor="product-lifecycle-status"
              >
                Status
                <SelectControl
                  disabled={pending}
                  id="product-lifecycle-status"
                  onValueChange={(value) => {
                    const nextStatus = value as ProductStatus;
                    setStatus(nextStatus);
                    void changeStatus(nextStatus);
                  }}
                  value={status}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </SelectControl>
              </label>
            </div>
          ) : null}
        </header>
        {success ? <StatusNotice>{success}</StatusNotice> : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <OperationalPanel
          className="mt-0"
          title="Product identity"
          action={
            canEdit ? (
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
            ) : undefined
          }
        >
          <dl className="grid gap-5 break-words p-5 sm:grid-cols-2 sm:p-6 [&>div]:min-w-0">
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
          <p className="px-5 pb-5 text-sm text-muted sm:px-6 sm:pb-6">
            Each product has one fixed merchant. Branch prices and stock are
            independent.
          </p>
        </OperationalPanel>
        <OperationalPanel
          className="mt-0"
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
              <li className="data-column-header hidden gap-x-6 gap-y-3 px-5 py-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
                <span>Branch</span>
                <span>Selling price</span>
                <span>Quantity</span>
                <span>Stock status</span>
                <span>Low-stock threshold</span>
              </li>
              {placements.map((placement) => (
                <li
                  key={placement.id}
                  className="data-row grid min-w-0 gap-x-6 gap-y-4 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] lg:items-start"
                >
                  <div className="min-w-0 break-words">
                    <span className="block text-xs font-medium text-muted lg:hidden">
                      Branch
                    </span>
                    <Link
                      className="mt-1 block min-w-0 text-sm text-ink lg:mt-0"
                      href={`/app/organizations/${organizationId}/branches/${placement.branchId}/inventory/${placement.id}`}
                    >
                      {placement.branch.name}
                      {placement.branch.code
                        ? ` · ${placement.branch.code}`
                        : ''}
                    </Link>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-muted lg:hidden">
                      Selling price
                    </span>
                    <span className="mt-1 block text-sm tabular-nums lg:mt-0">
                      PHP {placement.sellingPrice}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-muted lg:hidden">
                      Quantity
                    </span>
                    <span className="mt-1 block text-sm tabular-nums lg:mt-0">
                      {placement.quantity.toLocaleString()} units
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-muted lg:hidden">
                      Stock status
                    </span>
                    <span className="mt-1 block text-sm lg:mt-0">
                      {inventoryStockStatusLabel(placement.stockStatus)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-medium text-muted lg:hidden">
                      Low-stock threshold
                    </span>
                    <span className="mt-1 block text-sm tabular-nums lg:mt-0">
                      {placement.lowStockThreshold.toLocaleString()} units
                    </span>
                  </div>
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
    </OrganizationPageFrame>
  );
}
