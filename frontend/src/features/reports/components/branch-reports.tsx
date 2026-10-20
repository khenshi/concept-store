'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { listMerchants } from '@/features/merchants/api/merchant-api';
import { buttonStyles } from '@/shared/components/ui/button';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
import {
  getStaffSalesAnalytics,
  getMerchantSalesAnalytics,
  getStaffSalesRankings,
  getMerchantSalesRankings,
  getStaffTransactions,
  getMerchantTransactions,
  listReportBranches,
  resolveReportPeriod,
} from '../api/report-api';
import {
  reportDateRangeSchema,
  reportUtcRange,
  todayInPhilippines,
  reportPresetDates,
  reportPresets,
  reportCalendarRange,
  type ReportPreset,
  type ReportDateRange,
} from '../model/report-dates';
import type {
  ReportBranch,
  StaffSalesAnalytics,
  MerchantSalesAnalytics,
  StaffSalesRankingPage,
  MerchantSalesRankingPage,
  ReportMerchantOption,
  ReportRankingControls,
  ReportTransactionType,
  StaffTransactionsPage,
  MerchantTransactionsPage,
} from '../model/report.schemas';
import { ReportAccess } from './report-access';
import { ReportBranchPicker } from './report-branch-picker';
import { ReportDateFilter } from './report-date-filter';
import { StaffAnalyticsDashboard } from './staff-analytics-dashboard';
import type { SalesReportTab } from './staff-analytics-dashboard';
import { MerchantAnalyticsDashboard } from './merchant-analytics-dashboard';
import { MerchantReportGuidance } from './merchant-report-guidance';
import { TransactionsTab } from './transactions-tab';
import { DailyDataTab } from './daily-data-tab';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { allowPosNavigation } from '@/features/pos/model/pos-navigation';
import {
  getCheckoutAttempt,
  checkoutAttemptKey,
} from '@/features/pos/model/checkout-attempt';
import {
  getRefundAttempt,
  refundAttemptKey,
} from '@/features/refunds/model/refund-attempt';

const salesReportTabs: { value: SalesReportTab; label: string }[] = [
  ['overview', 'Overview'],
  ['transactions', 'Transactions'],
  ['daily', 'Daily Data'],
  ['rankings', 'Rankings'],
].map(([value, label]) => ({
  value: value as SalesReportTab,
  label,
}));

function ReportContextBar({
  activeTab,
  loading,
  validDraft,
  onTabChange,
  onRefresh,
}: {
  activeTab: SalesReportTab;
  loading: boolean;
  validDraft: boolean;
  onTabChange(tab: SalesReportTab): void;
  onRefresh(): void;
}) {
  return (
    <div
      role="region"
      aria-label="Report context"
      className="top-17 z-30 -mx-4 px-4 mb-4 mt-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10"
    >
      <div className="grid gap-y-2 sm:min-h-12 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-x-4">
        <div
          className="order-2 min-w-0 text-center sm:order-2 sm:justify-self-center"
          aria-live="polite"
          aria-label="Applied report scope"
        ></div>
        <div
          className="order-1 flex min-w-0 items-center gap-2 overflow-x-auto pt-2 sm:order-1 sm:self-stretch sm:justify-self-start"
          role="tablist"
          aria-label="Report views"
        >
          {salesReportTabs.map(({ value, label }) => (
            <button
              key={value}
              id={`sales-report-tab-${value}`}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              aria-controls={`sales-${value}-panel`}
              className={`relative min-h-10 shrink-0 rounded-none border-b px-2 text-sm font-semibold transition-colors sm:flex sm:h-full sm:items-center ${
                activeTab === value
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
              onClick={() => onTabChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={buttonStyles({
            variant: 'quiet',
            className:
              'order-3 w-fit border-0 sm:min-h-10 sm:self-end sm:justify-self-end',
          })}
          disabled={loading || !validDraft}
          onClick={onRefresh}
        >
          Refresh Report
        </button>
      </div>
    </div>
  );
}

export function BranchReports(props: {
  organizationId: string;
  branchId: string;
}) {
  return (
    <ReportAccess organizationId={props.organizationId}>
      {(scope, role) => (
        <PeriodBranchReports
          key={scope}
          {...props}
          role={role}
          merchant={role === 'MERCHANT'}
        />
      )}
    </ReportAccess>
  );
}
type PeriodSelection = { dates: ReportDateRange; preset: ReportPreset };
function PeriodBranchReports(props: {
  organizationId: string;
  branchId: string;
  merchant: boolean;
  role: 'OWNER' | 'MANAGER' | 'MERCHANT';
}) {
  const { reportPeriod, setReportPeriod } = useOrganizationWorkspaceContext();
  const [selection, setSelection] = useState<PeriodSelection>(() => ({
    dates: todayInPhilippines(),
    preset: 'TODAY',
  }));
  return (
    <ScopedBranchReports
      key={props.branchId}
      {...props}
      selection={reportPeriod ?? selection}
      onSelectionChange={(next) => {
        setSelection(next);
        setReportPeriod?.(next);
      }}
    />
  );
}
function ScopedBranchReports({
  organizationId,
  branchId,
  merchant,
  role,
  selection,
  onSelectionChange,
}: {
  organizationId: string;
  branchId: string;
  merchant: boolean;
  role: 'OWNER' | 'MANAGER' | 'MERCHANT';
  selection: PeriodSelection;
  onSelectionChange(value: PeriodSelection): void;
}) {
  const { request, user } = useAuth();
  const { refreshOrganization, setSelectedBranchId } =
    useOrganizationWorkspaceContext();
  const router = useRouter();
  const [draft, setDraft] = useState(selection.dates);
  const [preset, setPreset] = useState<ReportPreset>(selection.preset);
  const [appliedPreset, setAppliedPreset] = useState<ReportPreset>(
    selection.preset,
  );
  const allTimeRange = useRef<{ from: string; until: string } | null>(null);
  const [resolvedRange, setResolvedRange] = useState<{
    from: string;
    until: string;
  } | null>(null);
  const [emptyAllTime, setEmptyAllTime] = useState(false);
  const [applied, setApplied] = useState<ReportDateRange>(draft);
  const [branches, setBranches] = useState<ReportBranch[] | null>(null);
  const [report, setReport] = useState<
    StaffSalesAnalytics | MerchantSalesAnalytics | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<SalesReportTab>('overview');
  const [transactions, setTransactions] = useState<
    StaffTransactionsPage | MerchantTransactionsPage | null
  >(null);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionRevision, setTransactionRevision] = useState(0);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionType, setTransactionType] = useState<
    ReportTransactionType | 'ALL'
  >('ALL');
  const [transactionSearch, setTransactionSearch] = useState('');
  const debouncedTransactionSearch = useDebouncedValue(transactionSearch);
  const [ranking, setRanking] = useState<
    StaffSalesRankingPage | MerchantSalesRankingPage | null
  >(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [rankingErrorPage, setRankingErrorPage] = useState<number | null>(null);
  const [rankingControls, setRankingControls] = useState<ReportRankingControls>(
    {
      sortBy: 'GROSS_SALES',
      merchantId: null,
    },
  );
  const [merchantOptions, setMerchantOptions] = useState<
    ReportMerchantOption[] | null
  >(null);
  const [merchantOptionsError, setMerchantOptionsError] = useState<
    string | null
  >(null);
  const [merchantOptionsRevision, setMerchantOptionsRevision] = useState(0);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const rankingRequest = useRef(0);
  const transactionRequest = useRef(0);
  function invalidate() {
    generation.current++;
    rankingRequest.current++;
    transactionRequest.current++;
    setTransactionRevision((value) => value + 1);
    setReport(null);
    setEmptyAllTime(false);
    setBranches(null);
    setError(null);
    setDenied(false);
    setLoading(true);
    setRanking(null);
    setRankingLoading(false);
    setRankingError(null);
    setRankingErrorPage(null);
    setRankingControls({ sortBy: 'GROSS_SALES', merchantId: null });
    setMerchantOptions(null);
    setMerchantOptionsError(null);
    setTransactions(null);
    setTransactionLoading(false);
    setTransactionError(null);
    setTransactionPage(1);
    setTransactionType('ALL');
    setTransactionSearch('');
  }
  useEffect(() => {
    let active = true;
    const current = ++generation.current;
    async function load() {
      try {
        const items = await listReportBranches(request, organizationId);
        if (!active || current !== generation.current) return;
        if (!items.some((branch) => branch.id === branchId))
          throw new ApiError(
            404,
            'This branch is no longer available to your Reports access.',
          );
        let query = reportUtcRange(applied);
        if (appliedPreset === 'ALL_TIME') {
          if (!allTimeRange.current || merchant) {
            const period = await resolveReportPeriod(
              request,
              organizationId,
              branchId,
              query.until,
              merchant,
            );
            if (!active || current !== generation.current) return;
            if (period.from === null) {
              setBranches(items);
              setEmptyAllTime(true);
              setSelectedBranchId(branchId);
              return;
            }
            allTimeRange.current = { from: period.from, until: period.until };
            setResolvedRange(allTimeRange.current);
          }
          query = allTimeRange.current;
        }
        const result = await (
          merchant ? getMerchantSalesAnalytics : getStaffSalesAnalytics
        )(request, organizationId, branchId, query);
        if (!active || current !== generation.current) return;
        setBranches(items);
        setReport(result);
        setRanking(null);
        setRankingError(null);
        setRankingErrorPage(null);
        setSelectedBranchId(branchId);
      } catch (cause) {
        if (!active || current !== generation.current) return;
        setReport(null);
        setBranches(null);
        setDenied(
          cause instanceof ApiError && [401, 403, 404].includes(cause.status),
        );
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'The sales report could not be loaded.',
        );
      } finally {
        if (active && current === generation.current) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [
    request,
    organizationId,
    branchId,
    applied,
    appliedPreset,
    revision,
    merchant,
    setSelectedBranchId,
  ]);
  useEffect(() => {
    if (activeTab !== 'transactions' || !report) return;
    let active = true;
    const current = generation.current;
    const currentRequest = ++transactionRequest.current;
    const query = {
      from: report.from,
      until: report.until,
      page: transactionPage,
      limit: 15,
      ...(transactionType !== 'ALL' ? { type: transactionType } : {}),
      ...(debouncedTransactionSearch ? { q: debouncedTransactionSearch } : {}),
    };
    void (
      merchant
        ? getMerchantTransactions(request, organizationId, branchId, query)
        : getStaffTransactions(request, organizationId, branchId, query)
    )
      .then((result) => {
        if (
          !active ||
          current !== generation.current ||
          currentRequest !== transactionRequest.current
        )
          return;
        setTransactions(result);
      })
      .catch((cause) => {
        if (
          !active ||
          current !== generation.current ||
          currentRequest !== transactionRequest.current
        )
          return;
        setTransactions(null);
        setTransactionError(
          cause instanceof ApiError
            ? cause.message
            : 'The transaction history could not be loaded.',
        );
      })
      .finally(() => {
        if (
          active &&
          current === generation.current &&
          currentRequest === transactionRequest.current
        )
          setTransactionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    activeTab,
    applied,
    branchId,
    debouncedTransactionSearch,
    merchant,
    organizationId,
    report,
    request,
    transactionPage,
    transactionRevision,
    transactionType,
  ]);
  useEffect(() => {
    if (
      merchant ||
      role === 'MERCHANT' ||
      activeTab !== 'rankings' ||
      !report ||
      merchantOptions !== null ||
      merchantOptionsError !== null
    )
      return;
    let active = true;
    void listMerchants(request, organizationId, {}, role)
      .then((items) => {
        if (!active) return;
        setMerchantOptions(items.map(({ id, name }) => ({ id, name })));
      })
      .catch((cause) => {
        if (!active) return;
        setMerchantOptionsError(
          cause instanceof ApiError
            ? cause.message
            : 'Merchant filters could not be loaded.',
        );
      });
    return () => {
      active = false;
    };
  }, [
    activeTab,
    merchant,
    merchantOptions,
    merchantOptionsError,
    merchantOptionsRevision,
    organizationId,
    report,
    request,
    role,
  ]);
  const merchantOptionsLoading =
    !merchant && merchantOptions === null && merchantOptionsError === null;
  async function loadRankingPage(
    page: number,
    controls: ReportRankingControls = rankingControls,
    force = false,
  ) {
    if ((rankingLoading && !force) || page < 1) return;
    const current = generation.current;
    const currentRequest = ++rankingRequest.current;
    setRankingLoading(true);
    setRankingError(null);
    setRankingErrorPage(null);
    try {
      const query = {
        ...(report
          ? { from: report.from, until: report.until }
          : reportUtcRange(applied)),
        page,
        sortBy: controls.sortBy,
        ...(controls.merchantId ? { merchantId: controls.merchantId } : {}),
      };
      const result = merchant
        ? await getMerchantSalesRankings(
            request,
            organizationId,
            branchId,
            query,
          )
        : await getStaffSalesRankings(request, organizationId, branchId, query);
      if (
        current !== generation.current ||
        currentRequest !== rankingRequest.current
      )
        return;
      setRanking(result);
    } catch (cause) {
      if (
        current !== generation.current ||
        currentRequest !== rankingRequest.current
      )
        return;
      setRankingError(
        cause instanceof ApiError
          ? cause.message
          : 'The product ranking page could not be loaded.',
      );
      setRankingErrorPage(page);
    } finally {
      if (
        current === generation.current &&
        currentRequest === rankingRequest.current
      )
        setRankingLoading(false);
    }
  }
  function changeRankingControls(next: ReportRankingControls) {
    rankingRequest.current++;
    setRankingControls(next);
    setRanking(null);
    setRankingError(null);
    setRankingErrorPage(null);
    void loadRankingPage(1, next, true);
  }
  const validDraft =
    preset === 'ALL_TIME' || reportDateRangeSchema.safeParse(draft).success;
  return (
    <OrganizationPageFrame wide>
      <PageHeader
        title={merchant ? 'Own-sales reports' : 'Sales reports'}
        description={
          merchant
            ? 'Gross recorded sales of your own items only, not whole-branch sales. Transactions count distinct sales containing your items.'
            : 'Recorded sales and refunds for one branch, with daily trends and top products. Net recorded sales is not profit or merchant payouts.'
        }
        action={
          <ReportBranchPicker
            branches={branches}
            loading={loading}
            branchId={branchId}
            onChange={(next) => {
              const checkout =
                user &&
                getCheckoutAttempt(checkoutAttemptKey(organizationId, user.id));
              const refund =
                user &&
                getRefundAttempt(refundAttemptKey(organizationId, user.id));
              if (
                (checkout && checkout.state !== 'completed') ||
                (refund && refund.state !== 'completed')
              )
                return;
              const href = `/app/organizations/${organizationId}/branches/${next}/reports`;
              if (!allowPosNavigation(href)) return;
              setSelectedBranchId(next);
              invalidate();
              router.push(href);
            }}
            compact
          />
        }
      />
      {merchant ? <MerchantReportGuidance /> : null}
      <section
        aria-labelledby="report-period-heading"
        className="mt-5 card-surface px-5 py-5 text-ink sm:px-6"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <h2
              id="report-period-heading"
              className="text-base font-semibold text-ink"
            >
              Report period
            </h2>
            <p className="mt text-sm leading-6 text-muted">
              Dates use Philippine time. Both the start and end dates are
              included.
            </p>
          </div>
          <ReportDateFilter
            value={
              preset === 'ALL_TIME' && resolvedRange
                ? reportCalendarRange(resolvedRange.from, resolvedRange.until)
                : draft
            }
            preset={preset}
            onPresetChange={(next) => {
              setPreset(next);
              if (next === 'CUSTOM') return;
              const dates =
                next === 'ALL_TIME'
                  ? todayInPhilippines()
                  : reportPresetDates(next);
              setDraft(dates);
              invalidate();
              allTimeRange.current = null;
              setResolvedRange(null);
              setRevision((value) => value + 1);
              setApplied(dates);
              setAppliedPreset(next);
              onSelectionChange({ dates, preset: next });
            }}
            onChange={setDraft}
            onApply={(next) => {
              invalidate();
              allTimeRange.current = null;
              setResolvedRange(null);
              setRevision((value) => value + 1);
              const dates = preset === 'ALL_TIME' ? todayInPhilippines() : next;
              setApplied(dates);
              setAppliedPreset(preset);
              onSelectionChange({ dates, preset });
            }}
          />
        </div>
      </section>
      <ReportContextBar
        activeTab={activeTab}
        loading={loading}
        validDraft={validDraft}
        onTabChange={setActiveTab}
        onRefresh={() => {
          invalidate();
          setRevision((value) => value + 1);
        }}
      />
      {loading ? (
        <ListSkeleton label="Loading sales report" />
      ) : error ? (
        <>
          {validDraft ? (
            <RequestError
              message={error}
              onRetry={() => {
                invalidate();
                setRevision((value) => value + 1);
              }}
            />
          ) : (
            <p role="alert">
              {error} Correct the report dates before retrying.
            </p>
          )}
          {denied && !merchant ? (
            <button
              type="button"
              className={buttonStyles({
                variant: 'secondary',
                className: 'mt-3',
              })}
              onClick={() => void refreshOrganization()}
            >
              Refresh access
            </button>
          ) : null}
        </>
      ) : emptyAllTime ? (
        <div className="card-surface p-6">
          <EmptyState
            title="No completed sales or refunds yet."
            description="All-time sales, refunds and net recorded sales are PHP 0.00. Transactions and units are 0 for this branch and your current access."
          />
        </div>
      ) : report ? (
        activeTab === 'transactions' ? (
          <TransactionsTab
            organizationId={organizationId}
            branchId={branchId}
            merchant={merchant}
            page={transactions}
            loading={
              transactionLoading ||
              (transactions === null && transactionError === null)
            }
            error={transactionError}
            filterType={transactionType}
            search={transactionSearch}
            onTypeChange={(next) => {
              transactionRequest.current++;
              setTransactions(null);
              setTransactionError(null);
              setTransactionPage(1);
              setTransactionType(next);
            }}
            onSearchChange={(next) => {
              transactionRequest.current++;
              setTransactions(null);
              setTransactionError(null);
              setTransactionPage(1);
              setTransactionSearch(next);
            }}
            onRetry={() => {
              setTransactions(null);
              setTransactionError(null);
              setTransactionRevision((value) => value + 1);
            }}
            onPageChange={(next) => {
              if (next < 1) return;
              transactionRequest.current++;
              setTransactions(null);
              setTransactionError(null);
              setTransactionPage(next);
            }}
          />
        ) : activeTab === 'daily' &&
          report.granularity &&
          report.granularity !== 'DAY' ? (
          <DailyDataTab
            key={`${report.scope}:${branchId}:${report.from}:${report.until}:${revision}`}
            organizationId={organizationId}
            branchId={branchId}
            from={report.from}
            until={report.until}
            merchant={merchant}
          />
        ) : report.scope === 'MERCHANT' ? (
          <MerchantAnalyticsDashboard
            report={report}
            activeTab={activeTab}
            ranking={ranking?.scope === 'MERCHANT' ? ranking : undefined}
            rankingControls={rankingControls}
            onRankingControlsChange={changeRankingControls}
            rankingLoading={rankingLoading}
            rankingError={rankingError}
            rankingErrorPage={rankingErrorPage}
            onRankingPageChange={loadRankingPage}
          />
        ) : (
          <StaffAnalyticsDashboard
            report={report}
            activeTab={activeTab}
            ranking={ranking?.scope === 'STAFF' ? ranking : undefined}
            rankingControls={rankingControls}
            merchantOptions={merchantOptions ?? []}
            merchantOptionsLoading={merchantOptionsLoading}
            merchantOptionsError={merchantOptionsError}
            onMerchantOptionsRetry={() => {
              setMerchantOptions(null);
              setMerchantOptionsError(null);
              setMerchantOptionsRevision((value) => value + 1);
            }}
            onRankingControlsChange={changeRankingControls}
            rankingLoading={rankingLoading}
            rankingError={rankingError}
            rankingErrorPage={rankingErrorPage}
            onRankingPageChange={loadRankingPage}
          />
        )
      ) : null}
      {merchant ? (
        <button
          type="button"
          className={buttonStyles({ variant: 'secondary', className: 'mt-4' })}
          onClick={() => void refreshOrganization()}
        >
          Refresh access
        </button>
      ) : null}
    </OrganizationPageFrame>
  );
}
