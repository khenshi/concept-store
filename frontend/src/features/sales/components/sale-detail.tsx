'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BackLink } from '@/shared/components/ui/back-link';
import { Button } from '@/shared/components/ui/button';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import type { PosScope } from '@/features/pos/model/pos.types';
import { SaleReceipt } from '@/features/pos/components/sale-receipt';
import type { MerchantSale } from '../model/sales.schemas';
import { getSale } from '../api/sales-api';
import { SalesAccess } from './sales-access';
import { SalesBranchSelector } from './sales-branch-selector';
import { RefundHistory } from '@/features/refunds/components/refund-history';
import { useRefundNavigationGuard } from '@/features/refunds/model/refund-navigation';
import {
  refundAttemptKey,
  useRefundAttempt,
} from '@/features/refunds/model/refund-attempt';

export function SaleDetail(
  props: PosScope & { saleId: string; embedded?: boolean },
) {
  return (
    <SalesAccess organizationId={props.organizationId}>
      {(role, key) => (
        <ScopedSaleDetail
          key={`${key}:${props.branchId}:${props.saleId}`}
          {...props}
          role={role}
        />
      )}
    </SalesAccess>
  );
}
function OwnSale({ sale }: { sale: MerchantSale }) {
  return (
    <section className="min-w-0 break-words">
      <h2 className="font-semibold">{sale.receiptCode}</h2>
      <p className="mt-1 text-sm text-muted">
        {sale.branchName}
        {sale.branchCode ? ` · ${sale.branchCode}` : ''}
      </p>
      <time className="text-sm text-muted" dateTime={sale.completedAt}>
        {new Date(sale.completedAt).toLocaleString()}
      </time>
      <ul aria-label="Own sale items" className="my-5 list-none p-0">
        <li className="data-column-header hidden grid-cols-[minmax(0,1fr)_auto] gap-4 sm:grid">
          <span>Product</span>
          <span>Line total</span>
        </li>
        {sale.items.map((item) => (
          <li
            key={item.id}
            className="data-row grid min-w-0 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0 break-words">
              <h3 className="font-semibold">{item.productName}</h3>
              <p className="text-sm text-muted">
                {item.merchantName} · SKU {item.sku ?? 'not set'} · Barcode{' '}
                {item.barcode ?? 'not set'}
              </p>
              <p className="mt-2 tabular-nums">
                {item.quantity} × PHP {item.unitPrice}
              </p>
            </div>
            <p className="font-semibold tabular-nums">PHP {item.lineTotal}</p>
          </li>
        ))}
      </ul>
      <p className="font-semibold tabular-nums">
        Own items subtotal: PHP {sale.ownItemsSubtotal}
      </p>
      <p className="mt-3 text-sm text-muted">
        Only your business’s items are shown. This is not a full customer
        receipt or the whole-sale total.
      </p>
    </section>
  );
}
function ScopedSaleDetail({
  organizationId,
  branchId,
  saleId,
  role,
  embedded = false,
}: PosScope & { saleId: string; role: OrganizationRole; embedded?: boolean }) {
  const { request, user } = useAuth();
  useRefundNavigationGuard(refundAttemptKey(organizationId, user?.id ?? ''), {
    organizationId,
    branchId,
    saleId,
  });
  const refundAttempt = useRefundAttempt(
    refundAttemptKey(organizationId, user?.id ?? ''),
  );
  const refundPending = refundAttempt?.state === 'pending';
  const refundUnresolved = refundPending || refundAttempt?.state === 'unknown';
  const { refreshOrganization } = useOrganizationWorkspaceContext();
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof getSale>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setResult(null);
      setError(null);
      try {
        const response = await getSale(
          request,
          { organizationId, branchId },
          role,
          saleId,
        );
        if (active) setResult(response);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Sale could not be loaded. Access may have changed; retry this read or refresh access.',
          );
      }
    });
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, saleId, role, revision]);
  return (
    <OperationalPage>
      <BackLink
        href={`/app/organizations/${organizationId}/branches/${branchId}/${embedded && role !== 'MERCHANT' ? 'pos/sales' : 'sales'}`}
      >
        {embedded ? 'Return to sales history' : 'Back to branch sales'}
      </BackLink>
      {!embedded ? (
        <PageHeader
          title={
            role === 'MERCHANT' ? 'Your sale items' : 'Internal sale receipt'
          }
          description={
            role === 'MERCHANT'
              ? 'Read-only historical items owned by your currently linked merchant business.'
              : 'Immutable completed transaction snapshots. Internal record, not a fiscal/tax invoice.'
          }
          action={
            role === 'MERCHANT' ? (
              <SalesBranchSelector
                organizationId={organizationId}
                branchId={branchId}
              />
            ) : undefined
          }
        />
      ) : null}
      <OperationalPanel
        className="data-surface"
        title={role === 'MERCHANT' ? 'Own items' : 'Saved receipt'}
        description="Refreshing retries only the authorized sale read."
        action={
          <Button
            variant="quiet"
            disabled={refundUnresolved}
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh sale
          </Button>
        }
      >
        {error ? (
          <RequestError
            className="p-6"
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : !result ? (
          <ListSkeleton className="p-6" label="Loading authorized sale" />
        ) : (
          <div className="p-5 sm:p-6">
            {result.kind === 'merchant' ? (
              <OwnSale sale={result.sale} />
            ) : (
              <SaleReceipt sale={result.sale} />
            )}
          </div>
        )}
      </OperationalPanel>
      {result && role !== 'CASHIER' ? (
        <RefundHistory
          scope={{ organizationId, branchId, saleId }}
          sale={result.sale}
          role={role}
          onDenied={(message) => {
            setResult(null);
            setError(message);
          }}
        />
      ) : null}
      <Button
        variant="quiet"
        className="mt-4"
        disabled={refundPending}
        onClick={() => void refreshOrganization()}
      >
        Refresh access
      </Button>
    </OperationalPage>
  );
}
