'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { CompletedSale } from '@/features/pos/model/checkout';
import type { MerchantSale } from '@/features/sales/model/sales.schemas';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { Button } from '@/shared/components/ui/button';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { listRefunds, type RefundScope } from '../api/refund-api';
import {
  getRefundAttempt,
  refundAttemptKey,
  setRefundAttempt,
  useRefundAttempt,
} from '../model/refund-attempt';
import { RefundDetailsDialog } from './refund-details-dialog';
import { RefundDialog } from './refund-dialog';
export function RefundHistory({
  scope,
  sale,
  role,
  onDenied,
  entry,
  initialRefundId,
  onEntryClose,
  onRecorded,
}: {
  scope: RefundScope;
  sale: CompletedSale | MerchantSale;
  role: OrganizationRole;
  onDenied(message: string): void;
  entry?: 'return' | 'detail';
  initialRefundId?: string;
  onEntryClose?(): void;
  onRecorded?(code: string): void;
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
  const [open, setOpen] = useState(entry === 'return');
  const [selected, setSelected] = useState<string | null>(
    initialRefundId ?? null,
  );
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
  const staff = role === 'OWNER' || role === 'MANAGER';
  if (role === 'CASHIER') return null;
  const recovering = staff && belongs && attempt?.state === 'unknown';
  const showDialog =
    staff &&
    (!attempt || belongs) &&
    attempt?.state !== 'completed' &&
    'organizationId' in sale &&
    (open || recovering) &&
    Boolean(result) &&
    (recovering ||
      !entry ||
      Boolean(
        result?.remainingItems.some((item) => item.remainingQuantity > 0),
      ));
  const canStartReturn = Boolean(
    result?.remainingItems.some((item) => item.remainingQuantity > 0),
  );
  return (
    <>
      {entry ? (
        <div className="p-5 sm:p-6">
          <p className="font-semibold">Original receipt: {sale.receiptCode}</p>
          {notice ? (
            <p role="status" className="mt-3 text-sm">
              {notice}
            </p>
          ) : null}
          {error ? (
            <RequestError
              message={error}
              onRetry={() => setRevision((n) => n + 1)}
            />
          ) : !result ? (
            <ListSkeleton label="Loading returnable quantities" />
          ) : entry === 'return' && !canStartReturn ? (
            <EmptyState
              title="No items available to return."
              description="All items in this sale have already been returned. Choose another sale."
            />
          ) : null}
          {unresolved && !belongs ? (
            <p role="alert" className="mt-3 text-sm">
              Another sale has an unresolved refund.{' '}
              <Link
                className="underline"
                href={`/app/organizations/${organizationId}/branches/${attempt!.scope.branchId}/pos/sales/${attempt!.scope.saleId}`}
              >
                Resolve the original refund
              </Link>
            </p>
          ) : null}
          <Button variant="quiet" disabled={unresolved} onClick={onEntryClose}>
            Back to refund history
          </Button>
        </div>
      ) : null}
      {!entry ? (
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
              Refund recorded. Refresh remaining quantities before another
              return; do not refund money again.
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
                      Review what can still be returned before starting a
                      return.
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
              <div
                className="mt-8 border-t border-hairline"
                aria-hidden="true"
              />
              <section
                className="pt-6"
                aria-labelledby="recorded-refunds-title"
              >
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
                    <li className="data-column-header hidden grid-cols-[minmax(15rem,1.3fr)_minmax(7rem,1fr)_minmax(8rem,auto)_auto] gap-x-6 gap-y-3 text-xs font-normal sm:grid">
                      <span>Refund</span>
                      <span>Date</span>
                      <span>Amount</span>
                      <span>Action</span>
                    </li>
                    {result.items.map((row) => (
                      <li
                        key={row.id}
                        className="data-row grid min-w-0 gap-x-6 gap-y-3 px-4 py-4 text-sm font-normal text-ink sm:grid-cols-[minmax(15rem,1.3fr)_minmax(7rem,1fr)_minmax(8rem,auto)_auto] sm:items-center"
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
                            className="text-sm text-ink"
                            dateTime={row.completedAt}
                          >
                            {new Date(row.completedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              timeZone: 'Asia/Manila',
                            })}
                          </time>
                        </div>
                        <div className="flex items-center justify-between gap-3 tabular-nums sm:block">
                          <span className="text-xs font-medium text-muted sm:hidden">
                            Amount
                          </span>
                          <span className="text-sm font-normal">
                            {'total' in row
                              ? `PHP ${row.total}`
                              : `PHP ${row.ownItemsSubtotal}`}
                          </span>
                        </div>
                        <Button
                          variant="quiet"
                          className="w-fit px-3 text-sm font-semibold text-ink"
                          disabled={unresolved}
                          onClick={() => {
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
      ) : null}
      {showDialog && 'organizationId' in sale && result ? (
        <RefundDialog
          request={request}
          scope={scope}
          sale={sale}
          remaining={result.remainingItems}
          attemptKey={key}
          onClose={() => {
            setOpen(false);
            onEntryClose?.();
          }}
          onCompleted={() => {
            const recorded = getRefundAttempt(key)?.refund;
            setOpen(false);
            setSelected(null);
            setResult(null);
            setNotice(
              'Refund recorded; money is not processed by this system.',
            );
            setPage(1);
            setRevision((n) => n + 1);
            if (recorded) onRecorded?.(recorded.refundCode);
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
        <RefundDetailsDialog
          key={selected}
          scope={scope}
          sale={sale}
          role={role}
          refundId={selected}
          onClose={() => {
            setSelected(null);
            onEntryClose?.();
          }}
          onDenied={(message) => denied.current(message)}
        />
      ) : null}
    </>
  );
}
