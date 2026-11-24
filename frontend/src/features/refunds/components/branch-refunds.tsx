'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/model/auth-context';
import { ApiError } from '@/features/auth/api/auth-client';
import { SalesAccess } from '@/features/sales/components/sales-access';
import { getSale, listSales } from '@/features/sales/api/sales-api';
import type { PosScope } from '@/features/pos/model/pos.types';
import {
  useBranchPaymentAccounts,
  paymentAccountHistoryLabel,
} from '@/features/pos/model/use-branch-payment-accounts';
import type { PaymentAccount } from '@/features/payment-accounts/model/payment-account';
import { allowPosNavigation } from '@/features/pos/model/pos-navigation';
import { Button } from '@/shared/components/ui/button';
import { InputControl } from '@/shared/components/ui/input-control';
import { SelectControl } from '@/shared/components/ui/select-control';
import {
  DateRangePicker,
  type DateRangePickerValue,
} from '@/shared/components/ui/date-range-picker';
import { OperationalCollection } from '@/shared/components/ui/operational-page';
import {
  OperationalTable,
  OperationalTableFrame,
} from '@/shared/components/ui/operational-table';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { RequestError } from '@/shared/components/ui/request-error';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { listBranchRefunds } from '../api/branch-refund-api';
import {
  refundLocation,
  refundDateRangeSchema,
  type BranchRefundPage,
} from '../model/branch-refunds';
import { refundAttemptKey, useRefundAttempt } from '../model/refund-attempt';
import { useRefundNavigationGuard } from '../model/refund-navigation';
import { RefundHistory } from './refund-history';

type StaffRole = 'OWNER' | 'MANAGER';
type Navigate = (patch: Record<string, string | undefined>) => void;
const date = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
const message = (cause: unknown) =>
  cause instanceof ApiError
    ? cause.message
    : 'This record could not be loaded. Retry this read.';
const accessDenied = (cause: unknown) =>
  cause instanceof ApiError && [401, 403, 404].includes(cause.status);

export function BranchRefunds(scope: PosScope) {
  return (
    <SalesAccess organizationId={scope.organizationId}>
      {(role, key) =>
        role === 'OWNER' || role === 'MANAGER' ? (
          <ScopedRefunds
            key={`${key}:${scope.branchId}`}
            scope={scope}
            role={role}
          />
        ) : (
          <p role="alert" className="p-5">
            Your organization role cannot access POS refund history.
          </p>
        )
      }
    </SalesAccess>
  );
}

function ScopedRefunds({ scope, role }: { scope: PosScope; role: StaffRole }) {
  const { request, user } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const params = search.toString();
  const location = refundLocation(new URLSearchParams(params));
  const queryKey = JSON.stringify(location.query);
  const attemptKey = refundAttemptKey(scope.organizationId, user?.id ?? '');
  const attempt = useRefundAttempt(attemptKey);
  const locked = Boolean(attempt && attempt.state !== 'completed');
  const retainedSaleId =
    attempt?.scope.branchId === scope.branchId
      ? attempt.scope.saleId
      : undefined;
  const selectedSaleId = retainedSaleId ?? location.saleId;
  const selectedRefundId = retainedSaleId ? undefined : location.refundId;
  useRefundNavigationGuard(attemptKey, {
    ...scope,
    saleId: selectedSaleId ?? '',
  });
  const [loaded, setLoaded] = useState<{
    key: string;
    page: BranchRefundPage;
  } | null>(null);
  const [failure, setFailure] = useState<{ key: string; text: string } | null>(
    null,
  );
  const [denied, setDenied] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const { organizationId, branchId } = scope;
  const accountOptions = useBranchPaymentAccounts(
    request,
    organizationId,
    branchId,
    'REFUND',
    true,
  );
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const page = await listBranchRefunds(
          request,
          { organizationId, branchId },
          role,
          JSON.parse(queryKey),
        );
        if (active) {
          setLoaded({ key: queryKey, page });
          setFailure(null);
        }
      } catch (cause) {
        if (active) {
          setLoaded(null);
          setFailure({ key: queryKey, text: message(cause) });
          if (accessDenied(cause)) setDenied(message(cause));
        }
      }
    });
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, role, queryKey, revision]);
  const page = loaded?.key === queryKey ? loaded.page : null;
  const error = failure?.key === queryKey ? failure.text : null;
  const base = `/app/organizations/${organizationId}/branches/${branchId}/pos`;
  const navigate: Navigate = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const href = `${base}/refunds${next.size ? `?${next}` : ''}`;
    if (allowPosNavigation(href)) router.push(href, { scroll: false });
  };
  const closeEntry = () => navigate({ sale: undefined, refund: undefined });
  if (denied)
    return (
      <RequestError
        message={denied}
        onRetry={() => {
          setDenied(null);
          setRevision((n) => n + 1);
        }}
      />
    );
  return (
    <>
      {notice ? (
        <p role="status" className="mb-4 text-sm">
          {notice}
        </p>
      ) : null}
      {attempt && !location.saleId ? (
        <p role={locked ? 'alert' : 'status'} className="mb-4 text-sm">
          {locked
            ? 'An unresolved refund must be recovered before another return.'
            : 'Review the previous recorded refund before starting another return.'}{' '}
          <Link
            className="underline"
            href={`${base.replace(`/branches/${branchId}/`, `/branches/${attempt.scope.branchId}/`)}/sales/${attempt.scope.saleId}`}
          >
            Review original sale
          </Link>
        </p>
      ) : null}
      <div className="mb-6">
        <SaleSelection
          scope={scope}
          role={role}
          navigate={navigate}
          locked={locked || Boolean(attempt)}
          onDenied={setDenied}
        />
      </div>
      {selectedSaleId ? (
        <SelectedRefundSale
          key={`${selectedSaleId}:${selectedRefundId ?? 'return'}`}
          scope={scope}
          role={role}
          saleId={selectedSaleId}
          refundId={selectedRefundId}
          onClose={closeEntry}
          onDenied={setDenied}
          onRecorded={(code) => {
            setNotice(
              `Refund ${code} recorded. Current history filters are preserved.`,
            );
            setLoaded(null);
            setRevision((n) => n + 1);
            navigate({
              sale: undefined,
              refund: undefined,
              select: undefined,
              saleQ: undefined,
              salePage: undefined,
            });
          }}
        />
      ) : null}
      <OperationalCollection
        surface="data"
        title="Refund history"
        description="Completed refunds for this branch, newest first."
        controls={
          <RefundFilters
            key={`${location.query.q}:${location.query.paymentAccountId}:${location.dates.fromDay}:${location.dates.throughDay}`}
            accounts={accountOptions.accounts ?? []}
            location={location}
            navigate={navigate}
            locked={locked}
          />
        }
      >
        {accountOptions.error ? (
          <RequestError
            className="p-5"
            message={accountOptions.error}
            onRetry={accountOptions.refresh}
          />
        ) : null}
        {error ? (
          <RequestError
            className="p-5"
            message={error}
            onRetry={() => setRevision((n) => n + 1)}
          />
        ) : !page ? (
          <ListSkeleton className="p-5" label="Loading branch refund history" />
        ) : (
          <OperationalTableFrame
            empty={
              !page.items.length ? (
                <EmptyState
                  title={
                    page.total
                      ? 'No refunds on this page.'
                      : location.query.q ||
                          location.query.from ||
                          location.query.paymentAccountId
                        ? 'No matching refunds.'
                        : 'No refunds recorded yet.'
                  }
                  description="Choose another filter or find an original sale to record a return."
                />
              ) : undefined
            }
            footer={
              <PaginationControls
                ariaLabel="Branch refund pagination"
                currentPage={page.page}
                totalPages={page.totalPages}
                hasNext={page.page < page.totalPages}
                pending={locked}
                summary={`${page.total} refunds`}
                onPrevious={() => navigate({ page: String(page.page - 1) })}
                onNext={() => navigate({ page: String(page.page + 1) })}
              />
            }
          >
            <OperationalTable
              tableProps={{ 'aria-label': 'Branch refund history' }}
              className="min-w-[55rem]"
            >
              <thead>
                <tr>
                  {[
                    'Refund code',
                    'Original receipt',
                    'Refunded at',
                    'Account',
                    'Amount',
                    'Action',
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.items.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.refundCode}</td>
                    <td>{row.receiptCode}</td>
                    <td>
                      <time dateTime={row.completedAt}>
                        {date(row.completedAt)}
                      </time>
                    </td>
                    <td>{row.paymentAccountName}</td>
                    <td className="font-semibold tabular-nums">
                      PHP {row.total}
                    </td>
                    <td>
                      <Button
                        variant="quiet"
                        disabled={locked}
                        onClick={() =>
                          navigate({ sale: row.saleId, refund: row.id })
                        }
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </OperationalTable>
          </OperationalTableFrame>
        )}
      </OperationalCollection>
    </>
  );
}

function RefundFilters({
  accounts,
  location,
  navigate,
  locked,
}: {
  accounts: PaymentAccount[];
  location: ReturnType<typeof refundLocation>;
  navigate: Navigate;
  locked: boolean;
}) {
  const [q, setQ] = useState(location.query.q ?? '');
  const [dates, setDates] = useState<DateRangePickerValue>(location.dates);
  const debouncedQ = useDebouncedValue(q, 300);
  const lastNavigatedQ = useRef(location.query.q ?? '');
  useEffect(() => {
    const next = debouncedQ.trim();
    if (next === lastNavigatedQ.current || locked) return;
    lastNavigatedQ.current = next;
    navigate({ q: next, page: undefined });
  }, [debouncedQ, locked, navigate]);
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-48 flex-1">
        <label
          className="grid gap-2 text-xs font-medium text-muted"
          htmlFor="refund-search"
        >
          Search
          <InputControl
            id="refund-search"
            value={q}
            maxLength={254}
            disabled={locked}
            placeholder="e.g. refund code or receipt"
            onChange={(event) => setQ(event.target.value)}
          />
        </label>
      </div>
      <DateRangePicker
        id="refund-dates"
        label="Refund dates (PH)"
        filterLabel="Refund date filter"
        dialogLabel="Choose refund dates"
        applyLabel="Apply"
        value={dates}
        onChange={setDates}
        onApply={(value) => {
          if (!locked) navigate({ ...value, page: undefined });
        }}
        onClear={() => {
          setDates({ fromDay: '', throughDay: '' });
          if (!locked)
            navigate({
              fromDay: undefined,
              throughDay: undefined,
              page: undefined,
            });
        }}
        validate={(value) =>
          refundDateRangeSchema.safeParse(value).error?.issues[0]?.message
        }
      />
      <label
        className="grid gap-2 text-xs font-medium text-muted"
        htmlFor="refund-account"
      >
        Refund account
        <SelectControl
          id="refund-account"
          value={location.query.paymentAccountId ?? ''}
          disabled={locked}
          onValueChange={(value) =>
            navigate({ paymentAccountId: value, page: undefined })
          }
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {paymentAccountHistoryLabel(account)}
            </option>
          ))}
          {location.query.paymentAccountId &&
          !accounts.some(
            (account) => account.id === location.query.paymentAccountId,
          ) ? (
            <option value={location.query.paymentAccountId}>
              Historical account
            </option>
          ) : null}
        </SelectControl>
      </label>
    </div>
  );
}

function SaleSelection({
  scope,
  role,
  navigate,
  locked,
  onDenied,
}: {
  scope: PosScope;
  role: StaffRole;
  navigate: Navigate;
  locked: boolean;
  onDenied(message: string): void;
}) {
  const { request } = useAuth();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <OperationalCollection
      surface="data"
      title="Find sale to refund"
      description="Enter the complete original receipt code to start a return."
    >
      <form
        className="flex flex-wrap items-end gap-3 p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending || locked || !search.trim()) return;
          setPending(true);
          setError(null);
          try {
            const code = search.trim();
            const result = await listSales(request, scope, role, {
              page: 1,
              limit: 15,
              q: code,
            });
            const sale = result.page.items.find(
              (item) => item.receiptCode === code,
            );
            if (sale) navigate({ sale: sale.id, refund: undefined });
            else
              setError(
                'Receipt code not found or unavailable in this branch. Check the code and try again.',
              );
          } catch (cause) {
            setError(message(cause));
            if (accessDenied(cause)) onDenied(message(cause));
          } finally {
            setPending(false);
          }
        }}
      >
        <label
          className="grid flex-1 gap-2 text-xs font-medium text-muted"
          htmlFor="return-sale-search"
        >
          Receipt code
          <InputControl
            id="return-sale-search"
            maxLength={254}
            placeholder="Enter complete receipt code"
            value={search}
            disabled={locked || pending}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={locked || pending || !search.trim()}>
          {pending ? 'Selecting sale...' : 'Select sale'}
        </Button>
        {error ? (
          <p role="alert" className="w-full text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </OperationalCollection>
  );
}

function SelectedRefundSale({
  scope,
  role,
  saleId,
  refundId,
  onClose,
  onDenied,
  onRecorded,
}: {
  scope: PosScope;
  role: StaffRole;
  saleId: string;
  refundId?: string;
  onClose(): void;
  onDenied(message: string): void;
  onRecorded(code: string): void;
}) {
  const { request } = useAuth();
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof getSale>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const { organizationId, branchId } = scope;
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setResult(null);
      setError(null);
      try {
        const data = await getSale(
          request,
          { organizationId, branchId },
          role,
          saleId,
        );
        if (active) setResult(data);
      } catch (cause) {
        if (active) {
          setError(message(cause));
          if (accessDenied(cause)) onDenied(message(cause));
        }
      }
    });
    return () => {
      active = false;
    };
  }, [request, organizationId, branchId, saleId, role, revision, onDenied]);
  return (
    <section className="data-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-5">
        <h2 className="font-semibold">
          {refundId ? 'Saved refund' : 'Selected sale'}
        </h2>
        <Link
          className="text-sm font-semibold"
          href={`/app/organizations/${organizationId}/branches/${branchId}/pos/sales/${saleId}`}
        >
          View original sale
        </Link>
      </div>
      {error ? (
        <RequestError
          className="p-5"
          message={error}
          onRetry={() => setRevision((n) => n + 1)}
        />
      ) : !result ? (
        <ListSkeleton
          className="p-5"
          label="Loading authorized original sale"
        />
      ) : (
        <RefundHistory
          scope={{ ...scope, saleId }}
          sale={result.sale}
          role={role}
          entry={refundId ? 'detail' : 'return'}
          initialRefundId={refundId}
          onEntryClose={onClose}
          onDenied={onDenied}
          onRecorded={onRecorded}
        />
      )}
      {!result ? (
        <Button variant="quiet" onClick={onClose}>
          Back to refund history
        </Button>
      ) : null}
    </section>
  );
}
