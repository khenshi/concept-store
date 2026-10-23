'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, buttonStyles } from '@/shared/components/ui/button';
import { SalesAccess } from '@/features/sales/components/sales-access';
import { reportReturnHref } from '@/features/sales/model/sale-return';
import { RefundDetailsDialog } from '@/features/refunds/components/refund-details-dialog';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { InputControl } from '@/shared/components/ui/input-control';
import { OperationalCollection } from '@/shared/components/ui/operational-page';
import {
  OperationalTable,
  OperationalTableFrame,
} from '@/shared/components/ui/operational-table';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { RequestError } from '@/shared/components/ui/request-error';
import { SelectControl } from '@/shared/components/ui/select-control';
import type {
  MerchantTransactionsPage,
  ReportTransactionType,
  StaffTransactionsPage,
} from '../model/report.schemas';

type TransactionsPage = StaffTransactionsPage | MerchantTransactionsPage;

function completedDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

function typeLabel(type: ReportTransactionType) {
  return type === 'SALE' ? 'Sale' : 'Refund';
}

function typeClass(type: ReportTransactionType) {
  return type === 'SALE' ? 'text-success-ink' : 'text-danger';
}

function transactionHref(
  organizationId: string,
  branchId: string,
  saleId: string,
  returnTo?: string,
) {
  const source = reportReturnHref(returnTo, { organizationId, branchId });
  return `/app/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/sales/${encodeURIComponent(saleId)}${source ? `?${new URLSearchParams({ returnTo: source })}` : ''}`;
}

function TransactionsSkeleton() {
  return (
    <div className="p-5 sm:p-6" role="status" aria-label="Loading transactions">
      <div className="grid gap-4" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="grid h-14 animate-pulse grid-cols-[1.1fr_0.65fr_1.2fr_1.25fr_0.8fr_0.5fr] items-center gap-4 border-b border-hairline last:border-0"
          >
            <span className="h-3 w-28 rounded bg-selected" />
            <span className="h-3 w-12 rounded bg-selected" />
            <span className="h-3 w-24 rounded bg-selected" />
            <span className="h-3 w-32 rounded bg-selected" />
            <span className="h-3 w-20 rounded bg-selected" />
            <span className="h-3 w-10 rounded bg-selected" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionsTab({
  organizationId,
  branchId,
  merchant,
  page,
  loading,
  error,
  filterType,
  search,
  onTypeChange,
  onSearchChange,
  onRetry,
  onPageChange,
  returnTo,
}: {
  organizationId: string;
  branchId: string;
  merchant: boolean;
  page: TransactionsPage | null;
  loading: boolean;
  error: string | null;
  filterType: ReportTransactionType | 'ALL';
  search: string;
  onTypeChange(type: ReportTransactionType | 'ALL'): void;
  onSearchChange(search: string): void;
  onRetry(): void;
  onPageChange(page: number): void;
  returnTo?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{
    saleId: string;
    refundId: string;
    page: TransactionsPage;
    organizationId: string;
    branchId: string;
    merchant: boolean;
  } | null>(null);

  return (
    <>
      <OperationalCollection
        surface="data"
        role="tabpanel"
        id="sales-transactions-panel"
        aria-labelledby="sales-report-tab-transactions"
        tabIndex={0}
        title={merchant ? 'Your transaction history' : 'Transaction history'}
        description={
          merchant
            ? 'Your own completed sales and refunds in this branch.'
            : 'Completed sales and refunds, newest first.'
        }
        controlsPlacement="inline"
        controls={
          <div className="grid gap-3 sm:grid-cols-[11rem_minmax(16rem,22rem)]">
            <label
              className="min-w-0 text-xs font-medium text-muted"
              htmlFor="sales-report-transaction-type"
            >
              <span className="block">Filter by</span>
              <SelectControl
                id="sales-report-transaction-type"
                aria-label="Transaction type"
                value={filterType}
                onValueChange={(value) => {
                  if (value === 'ALL' || value === 'SALE' || value === 'REFUND')
                    onTypeChange(value);
                }}
                className="mt-1 bg-subtle px-4 text-sm font-medium"
                icon="filter"
              >
                <option value="ALL">All types</option>
                <option value="SALE">Sales</option>
                <option value="REFUND">Refunds</option>
              </SelectControl>
            </label>
            <label
              className="min-w-0 text-xs font-medium text-muted"
              htmlFor="sales-report-transaction-search"
            >
              <span className="block">Search</span>
              <InputControl
                id="sales-report-transaction-search"
                type="search"
                aria-label="Search transactions"
                placeholder="Search receipt or refund code"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                icon="search"
                className="mt-1 bg-subtle px-4 text-sm font-medium"
              />
            </label>
          </div>
        }
      >
        <OperationalTableFrame
          empty={
            page && !loading && !error && !page.items.length ? (
              <EmptyState
                className="mt-6"
                title={
                  search || filterType !== 'ALL'
                    ? 'No transactions match these filters.'
                    : 'No completed transactions yet.'
                }
                description={
                  search || filterType !== 'ALL'
                    ? 'Try another code or show all transaction types.'
                    : 'Completed sales and refunds will appear here for the selected period.'
                }
              />
            ) : undefined
          }
          footer={
            page ? (
              <PaginationControls
                ariaLabel="Transactions pagination"
                currentPage={page.page}
                totalPages={page.totalPages}
                pending={loading}
                hasNext={page.page < page.totalPages}
                summary={`${page.total} ${page.total === 1 ? 'transaction' : 'transactions'}`}
                onPrevious={() => onPageChange(page.page - 1)}
                onNext={() => onPageChange(page.page + 1)}
              />
            ) : undefined
          }
        >
          {error ? (
            <RequestError
              className="p-5 sm:p-6"
              message={error}
              onRetry={onRetry}
            />
          ) : loading && !page ? (
            <TransactionsSkeleton />
          ) : page?.items.length ? (
            <OperationalTable className="min-w-[62rem]">
              <caption className="sr-only">
                {merchant ? 'Own transaction history' : 'Transaction history'}
              </caption>
              <thead className="border-b border-hairline bg-surface text-xs uppercase tracking-[0.08em] text-muted [&_th]:font-normal">
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Reference</th>
                  <th scope="col">{merchant ? 'Context' : 'Merchant'}</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm font-normal text-ink [&_th]:font-normal">
                {page.items.map((item) => {
                  const href = transactionHref(
                    organizationId,
                    branchId,
                    item.saleId,
                    returnTo,
                  );
                  const open = () => {
                    if (item.type === 'REFUND') {
                      setSelected({
                        saleId: item.saleId,
                        refundId: item.refundId,
                        page,
                        organizationId,
                        branchId,
                        merchant,
                      });
                    } else router.push(href);
                  };
                  return (
                    <tr
                      key={`${item.type}-${item.id}`}
                      tabIndex={0}
                      aria-label={`Open ${typeLabel(item.type).toLowerCase()} ${item.reference}`}
                      className="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
                      onClick={(event) => {
                        if (
                          event.target instanceof Element &&
                          event.target.closest('a,button')
                        )
                          return;
                        open();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        if (
                          event.target instanceof Element &&
                          event.target.closest('a,button')
                        )
                          return;
                        event.preventDefault();
                        open();
                      }}
                    >
                      <td className="whitespace-nowrap px-4 py-4 align-middle font-semibold tabular-nums">
                        {completedDate(item.completedAt)}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span
                          className={`font-normal ${typeClass(item.type)}`}
                        >
                          {typeLabel(item.type)}
                        </span>
                      </td>
                      <th
                        scope="row"
                        className="px-4 py-4 align-middle font-normal text-ink"
                      >
                        {item.reference}
                        {'actorName' in item ? (
                          <span className="mt-1 block text-xs font-normal text-muted">
                            {item.actorName}
                          </span>
                        ) : null}
                      </th>
                      <td className="max-w-64 px-4 py-4 align-middle text-ink">
                        {'merchantNames' in item
                          ? item.merchantNames.join(', ') ||
                            'No merchant recorded'
                          : 'Your items'}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-4 align-middle font-normal tabular-nums ${item.type === 'REFUND' ? 'text-danger' : 'text-success-ink'}`}
                      >
                        {item.type === 'REFUND' ? '− ' : '+ '}
                        {item.amount}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        {item.type === 'REFUND' ? (
                          <Button
                            variant="quiet"
                            className="min-h-0 px-0 text-sm font-semibold text-ink"
                            onClick={open}
                          >
                            View
                          </Button>
                        ) : (
                          <Link
                            href={href}
                            className={buttonStyles({
                              variant: 'quiet',
                              className: 'min-h-0 px-0 text-sm font-semibold text-ink',
                            })}
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </OperationalTable>
          ) : null}
        </OperationalTableFrame>
      </OperationalCollection>
      {selected &&
      selected.page === page &&
      selected.organizationId === organizationId &&
      selected.branchId === branchId &&
      selected.merchant === merchant &&
      !loading &&
      !error ? (
        <SalesAccess organizationId={organizationId}>
          {(role, key) => (
            <RefundDetailsDialog
              key={`${key}:${branchId}:${selected.refundId}`}
              scope={{ organizationId, branchId, saleId: selected.saleId }}
              role={role}
              refundId={selected.refundId}
              onClose={() => setSelected(null)}
            />
          )}
        </SalesAccess>
      ) : null}
    </>
  );
}
