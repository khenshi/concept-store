'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import type { CompletedSale } from '@/features/pos/model/checkout';
import type { MerchantSale } from '@/features/sales/model/sales.schemas';
import { getSale } from '@/features/sales/api/sales-api';
import { Button } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { RequestError } from '@/shared/components/ui/request-error';
import { getRefund, type RefundScope } from '../api/refund-api';
import type { StaffRefund, MerchantRefund } from '../model/refund.schemas';

export function RefundDetailsDialog({
  scope,
  role,
  refundId,
  sale,
  onClose,
  onDenied,
}: {
  scope: RefundScope;
  role: OrganizationRole;
  refundId: string;
  sale?: CompletedSale | MerchantSale;
  onClose(): void;
  onDenied?(message: string): void;
}) {
  const { request } = useAuth();
  const { organizationId, branchId, saleId } = scope;
  const [detail, setDetail] = useState<StaffRefund | MerchantRefund | null>(
    null,
  );
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRevision, setDetailRevision] = useState(0);
  const denied = useRef(onDenied);
  useEffect(() => {
    denied.current = onDenied;
  }, [onDenied]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setDetail(null);
      setDetailError(null);
      try {
        if (role === 'CASHIER')
          throw new Error('Your organization role cannot read refunds.');
        const original =
          sale ??
          (await getSale(request, { organizationId, branchId }, role, saleId))
            .sale;
        if (!active) return;
        const row = await getRefund(
          request,
          { organizationId, branchId, saleId },
          role,
          original,
          refundId,
        );
        if (active) setDetail(row);
      } catch (cause) {
        if (!active) return;
        const message =
          cause instanceof ApiError
            ? cause.message
            : 'Refund detail could not be loaded.';
        setDetailError(message);
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status))
          denied.current?.(message);
      }
    });
    return () => {
      active = false;
    };
  }, [
    request,
    organizationId,
    branchId,
    saleId,
    role,
    refundId,
    sale,
    detailRevision,
  ]);
  return (
    <FormDialog
      title="Refund details"
      description={
        role === 'MERCHANT'
          ? 'Review the returned items and branch where this refund was recorded.'
          : 'Immutable manual refund record. Review the saved amount, payment details and returned items.'
      }
      size="large"
      onClose={onClose}
    >
      {detailError ? (
        <RequestError
          className="mt-5"
          message={detailError}
          onRetry={() => setDetailRevision((n) => n + 1)}
        />
      ) : !detail ? (
        <ListSkeleton className="mt-5" label="Loading saved refund" />
      ) : (
        <section className="mt-6 min-w-0 break-words">
          <div className="grid gap-5 border-b border-hairline pb-5 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:items-end">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                Refund code
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">
                {detail.refundCode}
              </h3>
              <p className="mt-1 text-sm text-muted">
                Original receipt: {detail.receiptCode}
              </p>
            </div>
            <dl className="grid gap-3 sm:text-right">
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                  {detail.scope === 'STAFF'
                    ? 'Refund total'
                    : 'Own returned items subtotal'}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {detail.scope === 'STAFF'
                    ? detail.total
                    : detail.ownItemsSubtotal}
                </dd>
              </div>
            </dl>
          </div>
          {detail.scope === 'STAFF' ? (
            <dl className="grid gap-5 border-b border-hairline py-5 sm:grid-cols-[minmax(12rem,0.85fr)_minmax(0,1.15fr)]">
              <div className="grid gap-4 sm:border-r sm:border-hairline sm:pr-5">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                    Date
                  </dt>
                  <dd className="mt-1 text-sm text-muted">
                    {new Date(detail.completedAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                    Status
                  </dt>
                  <dd className="mt-1 font-semibold text-success-ink">
                    Completed
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                    Actual refund method
                  </dt>
                  <dd className="mt-1 font-medium">{detail.paymentMethod}</dd>
                </div>
                {detail.paymentReference ? (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                      Reference
                    </dt>
                    <dd className="mt-1 break-words font-medium">
                      {detail.paymentReference}
                    </dd>
                  </div>
                ) : null}
              </div>
              <div className="min-w-0 sm:pl-1">
                <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                  Reason
                </dt>
                <dd className="mt-2 max-w-prose text-sm leading-6">
                  {detail.reason}
                </dd>
              </div>
            </dl>
          ) : (
            <dl className="border-b border-hairline py-5">
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                  Branch
                </dt>
                <dd className="mt-1 font-medium">
                  {detail.branchName}
                  {detail.branchCode ? ` · ${detail.branchCode}` : ''}
                </dd>
              </div>
            </dl>
          )}
          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline pb-4">
            <div>
              <h3 className="font-semibold">Returned items</h3>
              <p className="mt-1 text-sm text-muted">
                Saved quantities and amounts from this refund.
              </p>
            </div>
            <span className="text-sm text-muted">
              {detail.items.length}{' '}
              {detail.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="mt-4 overflow-x-auto rounded-control border border-hairline">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">
                Returned items and saved refund amounts
              </caption>
              <thead className="bg-subtle">
                <tr className="data-column-header">
                  <th scope="col" className="px-4 py-3 text-left">
                    Product
                  </th>
                  <th scope="col" className="w-28 px-4 py-3 text-left">
                    Returned
                  </th>
                  <th scope="col" className="w-28 px-4 py-3 text-left">
                    Restocked
                  </th>
                  <th scope="col" className="w-32 px-4 py-3 text-left">
                    Unit price
                  </th>
                  <th scope="col" className="w-36 px-4 py-3 text-left">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id} className="border-t border-hairline">
                    <th
                      scope="row"
                      className="max-w-0 px-4 py-4 text-left align-middle font-normal"
                    >
                      <p className="break-words font-semibold">
                        {item.productName}
                      </p>
                      <p className="mt-1 break-words text-xs text-muted">
                        {item.merchantName} · SKU {item.sku ?? 'not set'} ·
                        Barcode {item.barcode ?? 'not set'}
                      </p>
                    </th>
                    <td className="w-28 px-4 py-4 text-left align-middle font-semibold tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="w-28 px-4 py-4 text-left align-middle font-semibold tabular-nums">
                      {item.restockQuantity}
                    </td>
                    <td className="w-32 px-4 py-4 text-left align-middle tabular-nums">
                      {item.unitPrice}
                    </td>
                    <td className="w-36 px-4 py-4 text-left align-middle font-semibold tabular-nums">
                      {item.lineTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="mt-6 flex justify-end border-t border-hairline pt-5">
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>
    </FormDialog>
  );
}
