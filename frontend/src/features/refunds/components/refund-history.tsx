'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { CompletedSale } from '@/features/pos/model/checkout';
import type { MerchantSale } from '@/features/sales/model/sales.schemas';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { Button } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { getRefund, listRefunds, type RefundScope } from '../api/refund-api';
import {
  getRefundAttempt,
  refundAttemptKey,
  setRefundAttempt,
  useRefundAttempt,
} from '../model/refund-attempt';
import type { StaffRefund, MerchantRefund } from '../model/refund.schemas';
import { RefundDialog } from './refund-dialog';
export function RefundHistory({
  scope,
  sale,
  role,
  onDenied,
}: {
  scope: RefundScope;
  sale: CompletedSale | MerchantSale;
  role: OrganizationRole;
  onDenied(message: string): void;
}) {
  const { request, user } = useAuth();
  const { organizationId, branchId, saleId } = scope;
  const key = refundAttemptKey(scope.organizationId, user?.id ?? '');
  const attempt = useRefundAttempt(key);
  const belongs =
    attempt?.scope.branchId === scope.branchId &&
    attempt?.scope.saleId === scope.saleId;
  const unresolved = Boolean(attempt && attempt.state !== 'completed');
  const completedId =
    belongs && attempt?.state === 'completed'
      ? (attempt.refund?.id ?? null)
      : null;
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof listRefunds>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
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
      if (!active || role === 'CASHIER') return;
      setResult(null);
      setError(null);
      try {
        const response = await listRefunds(
          request,
          { organizationId, branchId, saleId },
          role,
          sale,
          {
            page,
            limit: 15,
          },
        );
        if (active) {
          setResult(response);
          if (
            completedId &&
            getRefundAttempt(key)?.state === 'completed' &&
            getRefundAttempt(key)?.refund?.id === completedId
          )
            setRefundAttempt(key, null);
        }
      } catch (cause) {
        if (!active) return;
        const message =
          cause instanceof ApiError
            ? cause.message
            : 'Refund history could not be refreshed. Retry this read; no refund will be sent again.';
        setError(message);
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status))
          denied.current(message);
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
    sale,
    page,
    revision,
    key,
    completedId,
  ]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setDetail(null);
      setDetailError(null);
      try {
        const row = await getRefund(
          request,
          { organizationId, branchId, saleId },
          role,
          sale,
          selected,
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
          denied.current(message);
      }
    });
    return () => {
      active = false;
    };
  }, [
    selected,
    request,
    organizationId,
    branchId,
    saleId,
    role,
    sale,
    detailRevision,
  ]);
  const staff = role === 'OWNER' || role === 'MANAGER';
  if (role === 'CASHIER') return null;
  const recovering = staff && belongs && attempt?.state === 'unknown';
  const showDialog =
    staff &&
    'organizationId' in sale &&
    (open || recovering) &&
    Boolean(result);
  const canStartReturn = Boolean(
    result?.remainingItems.some((item) => item.remainingQuantity > 0),
  );
  return (
    <>
      <OperationalPanel
        variant="open"
        className="data-surface pt-5"
        headerClassName="border-b border-hairline px-5 pb-4 sm:px-6"
        title={role === 'MERCHANT' ? 'Own returned items' : 'Return refunds'}
        description="Original sales stay unchanged. Remaining quantities include every completed return, not just this page."
        action={
          <Button
            variant="quiet"
            disabled={unresolved}
            onClick={() => {
              setResult(null);
              setSelected(null);
              setRevision((n) => n + 1);
            }}
          >
            Refresh refunds
          </Button>
        }
      >
        {notice ? (
          <p role="status" className="p-5 text-sm">
            {notice}
          </p>
        ) : null}
        {attempt?.state === 'completed' && belongs ? (
          <p role="status" className="p-5 text-sm">
            Refund recorded. Refresh remaining quantities before another return;
            do not refund money again.
          </p>
        ) : null}
        {attempt?.state === 'completed' && !belongs && staff ? (
          <p role="status" className="p-5 text-sm">
            A previous refund was recorded. Refresh its original sale before
            starting another return.{' '}
            <Link
              className="underline"
              href={`/app/organizations/${scope.organizationId}/branches/${attempt.scope.branchId}/pos/sales/${attempt.scope.saleId}`}
            >
              Review the recorded refund
            </Link>
          </p>
        ) : null}
        {attempt?.state === 'pending' && belongs ? (
          <p role="status" className="p-5 text-sm">
            Recording this refund. Wait for its outcome; do not refund money
            again.
          </p>
        ) : null}
        {unresolved && !belongs ? (
          <p role="alert" className="p-5 text-sm">
            Another sale has an unresolved refund.{' '}
            {staff ? (
              <Link
                className="underline"
                href={`/app/organizations/${scope.organizationId}/branches/${attempt!.scope.branchId}/pos/sales/${attempt!.scope.saleId}`}
              >
                Resolve the original refund
              </Link>
            ) : (
              'Ask an owner to check access before recovery.'
            )}
          </p>
        ) : null}
        {error ? (
          <RequestError
            className="p-5"
            message={error}
            onRetry={() => setRevision((n) => n + 1)}
          />
        ) : !result ? (
          <ListSkeleton className="p-5" label="Loading refund history" />
        ) : (
          <div className="p-5 sm:p-6">
            <section aria-labelledby="returnable-quantities-title">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3
                    id="returnable-quantities-title"
                    className="font-semibold"
                  >
                    Returnable quantities
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Review what can still be returned before starting a return.
                  </p>
                </div>
                {staff ? (
                  <Button
                    disabled={
                      unresolved ||
                      attempt?.state === 'completed' ||
                      !canStartReturn
                    }
                    onClick={() => setOpen(true)}
                  >
                    Return items
                  </Button>
                ) : null}
              </div>
              <ul
                aria-label="Returnable quantities"
                className="mt-4 list-none p-0"
              >
                <li className="data-column-header hidden grid-cols-[minmax(0,1fr)_10rem_8rem_8rem] gap-x-6 gap-y-3 sm:grid">
                  <span>Product</span>
                  <span>Available to return</span>
                  <span>Returned</span>
                  <span>Restocked</span>
                </li>
                {result.remainingItems.map((item) => (
                  <li
                    key={item.saleItemId}
                    className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_10rem_8rem_8rem] sm:items-center"
                  >
                    <span className="break-words font-semibold">
                      {
                        sale.items.find((line) => line.id === item.saleItemId)
                          ?.productName
                      }
                    </span>
                    <span className="flex items-center justify-between gap-3 tabular-nums sm:block">
                      <span className="text-xs font-medium text-muted sm:hidden">
                        Available to return
                      </span>
                      {item.remainingQuantity}
                    </span>
                    <span className="flex items-center justify-between gap-3 tabular-nums sm:block">
                      <span className="text-xs font-medium text-muted sm:hidden">
                        Returned
                      </span>
                      {item.returnedQuantity}
                    </span>
                    <span className="flex items-center justify-between gap-3 tabular-nums sm:block">
                      <span className="text-xs font-medium text-muted sm:hidden">
                        Restocked
                      </span>
                      {item.restockedQuantity}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <div className="mt-8 border-t border-hairline" aria-hidden="true" />
            <section className="pt-6" aria-labelledby="recorded-refunds-title">
              <div className="min-w-0">
                <h3 id="recorded-refunds-title" className="font-semibold">
                  Recorded refunds
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Review completed returns without changing the original sale.
                </p>
              </div>
              {!result.items.length ? (
                <EmptyState
                  className="mt-4"
                  title={
                    result.total === 0
                      ? role === 'MERCHANT'
                        ? 'No own refunds recorded yet.'
                        : 'No refunds recorded yet.'
                      : 'No refunds on this page.'
                  }
                  description={
                    result.total === 0
                      ? role === 'MERCHANT'
                        ? 'Refunds containing your items will appear here after a return is completed.'
                        : 'Completed refunds for this sale will appear here.'
                      : 'Try the previous page to continue reviewing the refund history.'
                  }
                />
              ) : (
                <ul className="mt-4 list-none p-0">
                  <li className="data-column-header hidden grid-cols-[minmax(15rem,1.3fr)_minmax(7rem,1fr)_minmax(8rem,auto)_auto] gap-x-6 gap-y-3 sm:grid">
                    <span>Refund</span>
                    <span>Date</span>
                    <span>Amount</span>
                    <span>Action</span>
                  </li>
                  {result.items.map((row) => (
                    <li
                      key={row.id}
                      className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(15rem,1.3fr)_minmax(7rem,1fr)_minmax(8rem,auto)_auto] sm:items-center"
                    >
                      <div className="min-w-0 break-words">
                        <h3 className="text-sm font-semibold">
                          {row.refundCode}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block">
                        <span className="text-xs font-medium text-muted sm:hidden">
                          Date
                        </span>
                        <time
                          className="text-sm text-muted"
                          dateTime={row.completedAt}
                        >
                          {new Date(row.completedAt).toLocaleString()}
                        </time>
                      </div>
                      <div className="flex items-center justify-between gap-3 tabular-nums sm:block">
                        <span className="text-xs font-medium text-muted sm:hidden">
                          Amount
                        </span>
                        <span className="text-sm font-semibold">
                          {'total' in row
                            ? `PHP ${row.total}`
                            : `PHP ${row.ownItemsSubtotal}`}
                        </span>
                      </div>
                      <Button
                        variant="quiet"
                        className="w-fit px-3"
                        disabled={unresolved}
                        onClick={() => {
                          setDetail(null);
                          setDetailError(null);
                          setSelected(row.id);
                        }}
                      >
                        View
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <PaginationControls
                className="px-0 py-4"
                ariaLabel="Refund history pagination"
                currentPage={result.page}
                totalPages={result.totalPages}
                pending={unresolved}
                summary={`${result.total} ${role === 'MERCHANT' ? 'refunds containing own items' : 'refunds'}`}
                hasNext={page < result.totalPages}
                previousLabel="Previous refunds"
                nextLabel="Next refunds"
                onPrevious={() => {
                  setResult(null);
                  setPage((n) => n - 1);
                }}
                onNext={() => {
                  setResult(null);
                  setPage((n) => n + 1);
                }}
              />
            </section>
          </div>
        )}
      </OperationalPanel>
      {showDialog && 'organizationId' in sale && result ? (
        <RefundDialog
          request={request}
          scope={scope}
          sale={sale}
          remaining={result.remainingItems}
          attemptKey={key}
          onClose={() => setOpen(false)}
          onCompleted={() => {
            setOpen(false);
            setSelected(null);
            setResult(null);
            setNotice(
              'Refund recorded; money is not processed by this system.',
            );
            setPage(1);
            setRevision((n) => n + 1);
          }}
          onIssue={(message, access) => {
            setNotice(message);
            setResult(null);
            setRevision((n) => n + 1);
            if (access) denied.current(message);
          }}
        />
      ) : null}
      {selected ? (
        <FormDialog
          title="Refund details"
          description={
            role === 'MERCHANT'
              ? 'Review the returned items and branch where this refund was recorded.'
              : 'Immutable manual refund record. Review the saved amount, payment details and returned items.'
          }
          size="medium"
          onClose={() => {
            setSelected(null);
            setDetail(null);
            setDetailError(null);
          }}
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
                      Completed
                    </dt>
                    <dd className="mt-1 text-sm text-muted">
                      {new Date(detail.completedAt).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                      {detail.scope === 'STAFF'
                        ? 'Refund total'
                        : 'Own returned items subtotal'}
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                      PHP{' '}
                      {detail.scope === 'STAFF'
                        ? detail.total
                        : detail.ownItemsSubtotal}
                    </dd>
                  </div>
                </dl>
              </div>
              {detail.scope === 'STAFF' ? (
                <dl className="grid gap-4 border-b border-hairline py-5 sm:grid-cols-2">
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
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted">
                      Reason
                    </dt>
                    <dd className="mt-1">{detail.reason}</dd>
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
              <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
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
              <ul className="mt-4 overflow-hidden rounded-panel border border-hairline divide-y divide-hairline">
                {detail.items.map((item) => (
                  <li
                    key={item.id}
                    className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(17rem,auto)] sm:items-start"
                  >
                    <div className="min-w-0">
                      <h4 className="font-semibold">{item.productName}</h4>
                      <p className="mt-1 text-sm text-muted">
                        {item.merchantName} · SKU {item.sku ?? 'not set'} ·
                        Barcode {item.barcode ?? 'not set'}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm tabular-nums">
                      <div>
                        <dt className="text-xs font-medium text-muted">
                          Returned
                        </dt>
                        <dd className="mt-1 font-semibold">{item.quantity}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted">
                          Restocked
                        </dt>
                        <dd className="mt-1 font-semibold">
                          {item.restockQuantity}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted">
                          Unit price
                        </dt>
                        <dd className="mt-1">PHP {item.unitPrice}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-muted">
                          Line total
                        </dt>
                        <dd className="mt-1 font-semibold">
                          PHP {item.lineTotal}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="mt-6 flex justify-end border-t border-hairline pt-5">
            <Button
              variant="quiet"
              onClick={() => {
                setSelected(null);
                setDetail(null);
              }}
            >
              Close refund
            </Button>
          </div>
        </FormDialog>
      ) : null}
    </>
  );
}
