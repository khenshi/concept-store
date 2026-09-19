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
            limit: 10,
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
  return (
    <>
      <OperationalPanel
        variant="open"
        className="data-surface"
        title={
          role === 'MERCHANT' ? 'Own returned items' : 'Returns and refunds'
        }
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
            <ul
              aria-label="Remaining returnable quantities"
              className="mb-5 list-none p-0"
            >
              <li className="data-column-header hidden grid-cols-[minmax(0,1.3fr)_minmax(13rem,auto)] gap-x-6 gap-y-3 sm:grid">
                <span>Product</span>
                <span>Returnable quantity</span>
              </li>
              {result.remainingItems.map((item) => (
                <li
                  key={item.saleItemId}
                  className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1.3fr)_minmax(13rem,auto)] sm:items-center"
                >
                  <span className="break-words">
                    {
                      sale.items.find((line) => line.id === item.saleItemId)
                        ?.productName
                    }
                  </span>
                  <span className="tabular-nums sm:text-right">
                    {item.remainingQuantity} remaining · {item.returnedQuantity}{' '}
                    returned · {item.restockedQuantity} restocked
                  </span>
                </li>
              ))}
            </ul>
            {staff ? (
              <Button
                disabled={
                  unresolved ||
                  attempt?.state === 'completed' ||
                  !result.remainingItems.some(
                    (item) => item.remainingQuantity > 0,
                  )
                }
                onClick={() => setOpen(true)}
              >
                Return items
              </Button>
            ) : null}
            {!result.items.length ? (
              <p className="mt-4 text-sm text-muted">
                {role === 'MERCHANT'
                  ? 'No matching own returns on this page.'
                  : 'No refunds on this page.'}
              </p>
            ) : (
              <ul className="mt-4 list-none p-0">
                <li className="data-column-header hidden grid-cols-[minmax(0,1.3fr)_minmax(13rem,auto)] gap-x-6 gap-y-3 sm:grid">
                  <span>Refund</span>
                  <span>Action</span>
                </li>
                {result.items.map((row) => (
                  <li
                    key={row.id}
                    className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(13rem,auto)] sm:items-center"
                  >
                    <div className="min-w-0 break-words">
                      <h3 className="font-semibold">{row.refundCode}</h3>
                      <p className="text-sm tabular-nums">
                        {'total' in row
                          ? `Refund: PHP ${row.total}`
                          : `Own returned items subtotal: PHP ${row.ownItemsSubtotal}`}
                      </p>
                      <time
                        className="text-xs text-muted"
                        dateTime={row.completedAt}
                      >
                        {new Date(row.completedAt).toLocaleString()}
                      </time>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={unresolved}
                      onClick={() => {
                        setDetail(null);
                        setDetailError(null);
                        setSelected(row.id);
                      }}
                    >
                      View refund {row.refundCode}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted">
                {result.total}{' '}
                {role === 'MERCHANT'
                  ? 'refunds containing own items'
                  : 'refunds'}{' '}
                · Page {result.page} of {Math.max(1, result.totalPages)}
              </p>
              <Button
                variant="secondary"
                disabled={unresolved || page <= 1}
                onClick={() => {
                  setResult(null);
                  setPage((n) => n - 1);
                }}
              >
                Previous refunds
              </Button>
              <Button
                variant="secondary"
                disabled={unresolved || page >= result.totalPages}
                onClick={() => {
                  setResult(null);
                  setPage((n) => n + 1);
                }}
              >
                Next refunds
              </Button>
            </div>
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
          title="Saved refund"
          description={
            role === 'MERCHANT'
              ? 'Only returned items belonging to your currently linked business.'
              : 'Immutable manual refund record. No payment provider was called.'
          }
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
            <section className="mt-5 min-w-0 break-words">
              <h3 className="font-semibold">{detail.refundCode}</h3>
              <p className="text-sm text-muted">
                Original receipt: {detail.receiptCode}
              </p>
              {detail.scope === 'STAFF' ? (
                <>
                  <p className="mt-3">
                    Actual refund method: {detail.paymentMethod} (manual)
                  </p>
                  {detail.paymentReference ? (
                    <p>Reference: {detail.paymentReference}</p>
                  ) : null}
                  <p>Reason: {detail.reason}</p>
                  <p className="font-semibold tabular-nums">
                    Refund: PHP {detail.total}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {detail.branchName}
                    {detail.branchCode ? ` · ${detail.branchCode}` : ''}
                  </p>
                  <p className="font-semibold tabular-nums">
                    Own returned items subtotal: PHP {detail.ownItemsSubtotal}
                  </p>
                </>
              )}
              <ul className="mt-4 divide-y divide-hairline">
                {detail.items.map((item) => (
                  <li key={item.id} className="py-3 text-sm">
                    <strong>{item.productName}</strong>
                    <p>
                      {item.merchantName} · SKU {item.sku ?? 'not set'} ·
                      Barcode {item.barcode ?? 'not set'}
                    </p>
                    <p className="tabular-nums">
                      {item.quantity} returned · {item.restockQuantity}{' '}
                      restocked · {item.quantity} × PHP {item.unitPrice} = PHP{' '}
                      {item.lineTotal}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="mt-6 flex justify-end">
            <Button
              variant="secondary"
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
