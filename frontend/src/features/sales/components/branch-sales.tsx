'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { BackLink } from '@/shared/components/ui/back-link';
import { Button, buttonStyles } from '@/shared/components/ui/button';
import { TextField } from '@/shared/components/ui/text-field';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import type { PosScope } from '@/features/pos/model/pos.types';
import { salesQuerySchema, type SalesQuery } from '../model/sales.schemas';
import { listSales } from '../api/sales-api';
import { SalesAccess } from './sales-access';
import { SalesBranchSelector } from './sales-branch-selector';

export function BranchSales(
  props: PosScope & { embedded?: boolean; active?: boolean },
) {
  return (
    <SalesAccess organizationId={props.organizationId}>
      {(role, key) => (
        <ScopedBranchSales
          key={`${key}:${props.branchId}`}
          {...props}
          role={role}
        />
      )}
    </SalesAccess>
  );
}
function ScopedBranchSales({
  organizationId,
  branchId,
  role,
  embedded = false,
  active: visible = true,
}: PosScope & {
  role: OrganizationRole;
  embedded?: boolean;
  active?: boolean;
}) {
  const { request } = useAuth();
  const { refreshOrganization } = useOrganizationWorkspaceContext();
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof listSales>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState<SalesQuery>({ page: 1, limit: 50 });
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [filterError, setFilterError] = useState<string>();
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setResult(null);
      setError(null);
      if (!visible) return;
      try {
        const response = await listSales(
          request,
          { organizationId, branchId },
          role,
          query,
        );
        if (active) setResult(response);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Sales could not be loaded. Access may have changed; retry this read or refresh access.',
          );
      }
    });
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, role, query, revision, visible]);
  function applyDates() {
    const parsed = salesQuerySchema.safeParse({
      page: 1,
      limit: query.limit,
      ...(from.trim() ? { from: from.trim() } : {}),
      ...(until.trim() ? { until: until.trim() } : {}),
    });
    if (!parsed.success) {
      setFilterError(parsed.error.issues[0]?.message);
      return;
    }
    setFilterError(undefined);
    setQuery(parsed.data);
  }
  const merchant = role === 'MERCHANT';
  const branchName = result?.page.items[0]?.branchName;
  return (
    <OperationalPage>
      {!embedded ? (
        <>
          <BackLink
            href={
              merchant
                ? `/app/organizations/${organizationId}/sales`
                : `/app/organizations/${organizationId}/branches/${branchId}`
            }
          >
            {merchant ? 'Back to your selling branches' : 'Back to branch'}
          </BackLink>
          <PageHeader
            title={merchant ? 'Your branch sales' : 'Branch sales'}
            description={
              merchant
                ? 'Only your own product snapshots and own-items subtotal. This is not the whole receipt.'
                : role === 'CASHIER'
                  ? 'Your completed sales in this assigned branch.'
                  : 'Completed sales in this permitted branch.'
            }
            action={
              merchant ? (
                <SalesBranchSelector
                  organizationId={organizationId}
                  branchId={branchId}
                />
              ) : undefined
            }
          />
        </>
      ) : null}
      <OperationalPanel
        className="data-surface"
        title={branchName ?? (merchant ? 'Own sales' : 'Sales history')}
        description={`${role === 'CASHIER' ? 'Your completed sales in this assigned branch. ' : ''}Newest completion first. Amounts and names are saved transaction snapshots.`}
        action={
          <Button
            variant="quiet"
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh sales
          </Button>
        }
      >
        <form
          noValidate
          className="grid min-w-0 gap-4 border-b border-hairline bg-subtle px-5 py-5 sm:grid-cols-2 sm:px-6 sm:py-6"
          onSubmit={(event) => {
            event.preventDefault();
            applyDates();
          }}
        >
          <TextField
            label="From (UTC, inclusive)"
            placeholder="2026-09-13T00:00:00Z"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            hint="Optional timestamp ending in Z."
          />
          <TextField
            label="Until (UTC, exclusive)"
            placeholder="2026-09-14T00:00:00Z"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
            hint="Optional timestamp ending in Z; later than From."
          />
          {filterError ? (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {filterError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <Button type="submit" variant="secondary">
              Apply dates
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setFrom('');
                setUntil('');
                setFilterError(undefined);
                setQuery({ page: 1, limit: query.limit });
              }}
            >
              Clear dates
            </Button>
          </div>
        </form>
        {error ? (
          <RequestError
            className="p-6"
            message={error}
            onRetry={() => setRevision((value) => value + 1)}
          />
        ) : !result ? (
          <ListSkeleton className="p-6" label="Loading branch sales" />
        ) : !result.page.items.length ? (
          <p className="p-6 text-sm text-muted">
            {query.from || query.until
              ? 'No permitted sales in this UTC range.'
              : merchant
                ? 'No sales involving your currently linked business in this branch.'
                : 'No completed sales available to your role in this branch.'}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            <li className="data-column-header hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-4 sm:grid">
              <span>Sale</span>
              <span>Amount</span>
              <span className="sr-only">Action</span>
            </li>
            {result.page.items.map((sale) => (
              <li
                key={sale.id}
                className="data-row grid min-w-0 gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <div className="min-w-0 break-words">
                  <h2 className="font-semibold">{sale.receiptCode}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {sale.branchName}
                    {sale.branchCode ? ` · ${sale.branchCode}` : ''} ·{' '}
                    <time dateTime={sale.completedAt}>
                      {new Date(sale.completedAt).toLocaleString()}
                    </time>
                  </p>
                  {'cashierName' in sale ? (
                    <p className="mt-1 text-sm text-muted">
                      Cashier: {sale.cashierName} ·{' '}
                      {sale.paymentMethod === 'CASH'
                        ? 'Cash'
                        : `${sale.paymentMethod === 'GCASH' ? 'GCash' : 'Card'} (manual, unverified)`}
                    </p>
                  ) : null}
                </div>
                <p className="font-semibold tabular-nums">
                  {'ownItemsSubtotal' in sale
                    ? `Own items subtotal: PHP ${sale.ownItemsSubtotal}`
                    : `Total: PHP ${sale.total}`}
                </p>
                <Link
                  aria-label={`${merchant ? 'View own items' : 'View receipt'} ${sale.receiptCode}`}
                  className={buttonStyles({ variant: 'secondary' })}
                  href={`/app/organizations/${organizationId}/branches/${branchId}/${embedded && !merchant ? 'pos/sales' : 'sales'}/${sale.id}`}
                >
                  {merchant ? 'View own items' : 'View receipt'}
                  <span className="sr-only"> {sale.receiptCode}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {result ? (
          <nav
            className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-subtle p-5 sm:p-6"
            aria-label="Sales pagination"
          >
            <p className="text-sm text-muted">
              {result.page.total} permitted sales · Page {result.page.page} of{' '}
              {Math.max(1, result.page.totalPages)}
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                disabled={query.page <= 1}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                Previous page
              </Button>
              <Button
                variant="secondary"
                disabled={
                  query.page >= result.page.totalPages || query.page >= 21474836
                }
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                Next page
              </Button>
            </div>
          </nav>
        ) : null}
      </OperationalPanel>
      <Button
        variant="quiet"
        className="mt-4"
        onClick={() => void refreshOrganization()}
      >
        Refresh access
      </Button>
    </OperationalPage>
  );
}
