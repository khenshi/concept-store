'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { StaffDailyData } from './staff-analytics-dashboard';
import { MerchantDailyData } from './merchant-analytics-dashboard';
import { PaginationControls } from '@/shared/components/ui/pagination-controls';
import {
  parseReportLocation,
  reportLocationParams,
  reportTabFromPath,
  reportTabPath,
} from '../model/report-location';
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

const ReportViewContext = createContext<
  ((tab: SalesReportTab) => ReactNode) | null
>(null);
export function ReportView({ tab }: { tab: SalesReportTab }) {
  const renderView = useContext(ReportViewContext);
  return renderView?.(tab) ?? null;
}
type ReportLocation = ReturnType<typeof parseReportLocation>;
type ReportNavigation = (
  patch: Record<string, string | undefined>,
  options?: { tab?: SalesReportTab; replace?: boolean },
) => boolean;

function ReportDailyContent({
  report,
  organizationId,
  branchId,
  page,
  onPageChange,
}: {
  report: StaffSalesAnalytics | MerchantSalesAnalytics;
  organizationId: string;
  branchId: string;
  page: number;
  onPageChange(page: number): void;
}) {
  if (report.granularity && report.granularity !== 'DAY')
    return (
      <DailyDataTab
        key={page}
        organizationId={organizationId}
        branchId={branchId}
        from={report.from}
        until={report.until}
        merchant={report.scope === 'MERCHANT'}
        currentPage={page}
        onPageChange={onPageChange}
      />
    );
  const total = report.dailyTrends.length;
  const pagination = (
    <PaginationControls
      ariaLabel="Daily data pagination"
      currentPage={page}
      totalPages={Math.ceil(total / 15)}
      hasNext={page * 15 < total}
      summary={`${total} days`}
      onPrevious={() => onPageChange(page - 1)}
      onNext={() => onPageChange(page + 1)}
    />
  );
  return report.scope === 'STAFF' ? (
    <StaffDailyData
      rows={report.dailyTrends.slice((page - 1) * 15, page * 15)}
      pagination={pagination}
    />
  ) : (
    <MerchantDailyData
      rows={report.dailyTrends.slice((page - 1) * 15, page * 15)}
      pagination={pagination}
    />
  );
}

function ReportContextBar({
  activeTab,
  loading,
  validDraft,
  onTabChange,
  tabHref,
  onRefresh,
}: {
  activeTab: SalesReportTab;
  loading: boolean;
  validDraft: boolean;
  onTabChange(tab: SalesReportTab): void;
  tabHref(tab: SalesReportTab): string;
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
            <Link
              key={value}
              id={`sales-report-tab-${value}`}
              href={tabHref(value)}
              role="tab"
              aria-current={activeTab === value ? 'page' : undefined}
              aria-selected={activeTab === value}
              aria-controls={`sales-${value}-panel`}
              className={`relative min-h-10 shrink-0 rounded-none border-b px-2 text-sm font-semibold transition-colors sm:flex sm:h-full sm:items-center ${
                activeTab === value
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                onTabChange(value);
              }}
            >
              {label}
            </Link>
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
  children?: ReactNode;
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
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { reportPeriod, setReportPeriod } = useOrganizationWorkspaceContext();
  const [selection, setSelection] = useState<PeriodSelection>(() => ({
    dates: todayInPhilippines(),
    preset: 'TODAY',
  }));
  const location = parseReportLocation(
    new URLSearchParams(params.toString()),
    reportPeriod ?? selection,
    props.merchant,
  );
  const activeTab = reportTabFromPath(pathname);
  const appliedSelectionKey = JSON.stringify(location.selection);
  const rememberedSelectionKey = JSON.stringify(reportPeriod);
  useEffect(() => {
    if (
      appliedSelectionKey !== rememberedSelectionKey &&
      params.has('fromDay') &&
      params.has('throughDay')
    )
      setReportPeriod?.(JSON.parse(appliedSelectionKey));
  }, [appliedSelectionKey, rememberedSelectionKey, params, setReportPeriod]);
  const base = `/app/organizations/${props.organizationId}/branches/${props.branchId}/reports`;
  const makeHref = (
    tab: SalesReportTab,
    patch: Record<string, string | undefined> = {},
  ) => {
    const next = new URLSearchParams(params.toString());
    reportLocationParams(location.selection).forEach((value, key) =>
      next.set(key, value),
    );
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return `${base}/${reportTabPath(tab)}?${next}`;
  };
  const canonicalHref = makeHref(activeTab);
  const canonicalPeriod = reportLocationParams(location.selection);
  const needsCanonicalPeriod = [...canonicalPeriod].some(
    ([key, value]) => params.get(key) !== value,
  );
  const canonicalizedHref = useRef<string | null>(null);
  useEffect(() => {
    if (
      !needsCanonicalPeriod ||
      canonicalizedHref.current === canonicalHref ||
      !allowPosNavigation(canonicalHref)
    )
      return;
    canonicalizedHref.current = canonicalHref;
    router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, needsCanonicalPeriod, router]);
  const navigate: ReportNavigation = (patch, options = {}) => {
    const href = makeHref(options.tab ?? activeTab, patch);
    if (!allowPosNavigation(href)) return false;
    if (options.replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
    return true;
  };
  return (
    <ScopedBranchReports
      key={`${props.branchId}:${JSON.stringify(location.selection)}`}
      {...props}
      selection={location.selection}
      location={location}
      activeTab={activeTab}
      navigate={navigate}
      tabHref={(tab) => makeHref(tab)}
      onSelectionChange={(next) => {
        const period = Object.fromEntries(reportLocationParams(next));
        if (
          !navigate({
            ...period,
            transactionPage: undefined,
            transactionType: undefined,
            transactionQ: undefined,
            rankingPage: undefined,
            rankingSort: undefined,
            rankingMerchant: undefined,
            dailyPage: undefined,
          })
        )
          return;
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
  location,
  activeTab,
  navigate,
  tabHref,
  children,
}: {
  organizationId: string;
  branchId: string;
  merchant: boolean;
  role: 'OWNER' | 'MANAGER' | 'MERCHANT';
  selection: PeriodSelection;
  onSelectionChange(value: PeriodSelection): void;
  location: ReportLocation;
  activeTab: SalesReportTab;
  navigate: ReportNavigation;
  tabHref(tab: SalesReportTab): string;
  children?: ReactNode;
}) {
  const { request, user } = useAuth();
  const { refreshOrganization, setSelectedBranchId } =
    useOrganizationWorkspaceContext();
  const router = useRouter();
  const [draft, setDraft] = useState(selection.dates);
  const [preset, setPreset] = useState<ReportPreset>(selection.preset);
  const appliedPreset = selection.preset;
  const allTimeRange = useRef<{ from: string; until: string } | null>(null);
  const [resolvedRange, setResolvedRange] = useState<{
    from: string;
    until: string;
  } | null>(null);
  const [emptyAllTime, setEmptyAllTime] = useState(false);
  const [applied] = useState<ReportDateRange>(selection.dates);
  const [branches, setBranches] = useState<ReportBranch[] | null>(null);
  const [report, setReport] = useState<
    StaffSalesAnalytics | MerchantSalesAnalytics | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [transactions, setTransactions] = useState<
    StaffTransactionsPage | MerchantTransactionsPage | null
  >(null);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionRevision, setTransactionRevision] = useState(0);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionOutcomeKey, setTransactionOutcomeKey] = useState('');
  const transactionPage = location.transaction.page;
  const transactionType = location.transaction.type;
  const transactionQueryKey = JSON.stringify([
    report?.from,
    report?.until,
    transactionPage,
    transactionType,
    location.transaction.q,
  ]);
  const [transactionInput, setTransactionInput] = useState({
    source: location.transaction.q,
    value: location.transaction.q,
  });
  if (transactionInput.source !== location.transaction.q)
    setTransactionInput({
      source: location.transaction.q,
      value: location.transaction.q,
    });
  const transactionSearch =
    transactionInput.source === location.transaction.q
      ? transactionInput.value
      : location.transaction.q;
  const normalizedTransactionSearch = transactionSearch.trim();
  const debouncedTransactionSearch = useDebouncedValue(
    normalizedTransactionSearch,
  );
  const currentTransactions =
    transactionOutcomeKey === transactionQueryKey &&
    normalizedTransactionSearch === location.transaction.q
      ? transactions
      : null;
  const currentTransactionError =
    transactionOutcomeKey === transactionQueryKey &&
    normalizedTransactionSearch === location.transaction.q
      ? transactionError
      : null;
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);
  useEffect(() => {
    if (
      transactionInput.source === location.transaction.q &&
      debouncedTransactionSearch === transactionInput.value.trim() &&
      debouncedTransactionSearch !== location.transaction.q
    )
      navigateRef.current(
        {
          transactionQ: debouncedTransactionSearch || undefined,
          transactionPage: undefined,
        },
        { replace: true },
      );
  }, [debouncedTransactionSearch, location.transaction.q, transactionInput]);
  const [ranking, setRanking] = useState<
    StaffSalesRankingPage | MerchantSalesRankingPage | null
  >(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [rankingErrorPage, setRankingErrorPage] = useState<number | null>(null);
  const [rankingOutcomeKey, setRankingOutcomeKey] = useState('');
  const rankingControls = useMemo<ReportRankingControls>(
    () => ({
      sortBy: location.ranking.sortBy,
      merchantId: location.ranking.merchantId,
    }),
    [location.ranking.sortBy, location.ranking.merchantId],
  );
  const rankingQueryKey = JSON.stringify([
    report?.from,
    report?.until,
    location.ranking.page,
    rankingControls.sortBy,
    rankingControls.merchantId,
  ]);
  const currentRankingError =
    rankingOutcomeKey === rankingQueryKey ? rankingError : null;
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
    setMerchantOptions(null);
    setMerchantOptionsError(null);
    setTransactions(null);
    setTransactionLoading(false);
    setTransactionError(null);
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
    if (
      activeTab !== 'transactions' ||
      !report ||
      normalizedTransactionSearch !== debouncedTransactionSearch ||
      debouncedTransactionSearch !== location.transaction.q
    )
      return;
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
        setTransactionOutcomeKey(transactionQueryKey);
        setTransactionError(null);
      })
      .catch((cause) => {
        if (
          !active ||
          current !== generation.current ||
          currentRequest !== transactionRequest.current
        )
          return;
        setTransactions(null);
        setTransactionOutcomeKey(transactionQueryKey);
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
    normalizedTransactionSearch,
    location.transaction.q,
    transactionQueryKey,
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
  const loadRankingPage = useCallback(
    async (page: number, controls: ReportRankingControls = rankingControls) => {
      if (page < 1) return;
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
          : await getStaffSalesRankings(
              request,
              organizationId,
              branchId,
              query,
            );
        if (
          current !== generation.current ||
          currentRequest !== rankingRequest.current
        )
          return;
        setRanking(result);
        setRankingOutcomeKey(
          JSON.stringify([
            query.from,
            query.until,
            page,
            controls.sortBy,
            controls.merchantId,
          ]),
        );
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
        setRankingOutcomeKey(
          JSON.stringify([
            report?.from,
            report?.until,
            page,
            controls.sortBy,
            controls.merchantId,
          ]),
        );
      } finally {
        if (
          current === generation.current &&
          currentRequest === rankingRequest.current
        )
          setRankingLoading(false);
      }
    },
    [
      rankingControls,
      report,
      applied,
      merchant,
      request,
      organizationId,
      branchId,
    ],
  );
  useEffect(() => {
    if (activeTab !== 'rankings' || !report) return;
    let active = true;
    const requestCounter = rankingRequest;
    void Promise.resolve().then(() => {
      if (active) void loadRankingPage(location.ranking.page, rankingControls);
    });
    return () => {
      active = false;
      requestCounter.current++;
    };
  }, [
    activeTab,
    report,
    location.ranking.page,
    rankingControls,
    loadRankingPage,
  ]);
  function changeRankingControls(next: ReportRankingControls) {
    if (
      next.sortBy === rankingControls.sortBy &&
      next.merchantId === rankingControls.merchantId
    )
      return;
    rankingRequest.current++;
    setRanking(null);
    setRankingError(null);
    setRankingErrorPage(null);
    navigate({
      rankingSort: next.sortBy,
      rankingMerchant: next.merchantId ?? undefined,
      rankingPage: undefined,
    });
  }
  const displayedRanking =
    ranking &&
    ranking.page === location.ranking.page &&
    ranking.sortBy === rankingControls.sortBy &&
    ranking.merchantId === rankingControls.merchantId
      ? ranking
      : null;
  function changeRankingPage(page: number) {
    if (page === location.ranking.page) {
      void loadRankingPage(page, rankingControls);
      return;
    }
    rankingRequest.current++;
    setRanking(null);
    setRankingError(null);
    setRankingErrorPage(null);
    navigate({ rankingPage: String(page) });
  }
  const validDraft =
    preset === 'ALL_TIME' || reportDateRangeSchema.safeParse(draft).success;
  const renderView = (tab: SalesReportTab) =>
    loading ? (
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
          <p role="alert">{error} Correct the report dates before retrying.</p>
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
      tab === 'transactions' ? (
        <TransactionsTab
          organizationId={organizationId}
          branchId={branchId}
          merchant={merchant}
          page={currentTransactions}
          loading={
            transactionLoading ||
            (currentTransactions === null && currentTransactionError === null)
          }
          error={currentTransactionError}
          filterType={transactionType}
          search={transactionSearch}
          onTypeChange={(next) => {
            if (next === transactionType) return;
            transactionRequest.current++;
            setTransactions(null);
            setTransactionError(null);
            navigate({
              transactionPage: undefined,
              transactionType: next === 'ALL' ? undefined : next,
            });
          }}
          onSearchChange={(next) => {
            if (next.slice(0, 254).trim() !== normalizedTransactionSearch) {
              transactionRequest.current++;
              setTransactions(null);
              setTransactionError(null);
            }
            setTransactionInput({
              source: location.transaction.q,
              value: next.slice(0, 254),
            });
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
            navigate({ transactionPage: String(next) });
          }}
        />
      ) : tab === 'daily' ? (
        <ReportDailyContent
          key={`${report.scope}:${branchId}:${report.from}:${report.until}:${revision}`}
          report={report}
          organizationId={organizationId}
          branchId={branchId}
          page={location.dailyPage}
          onPageChange={(page) => navigate({ dailyPage: String(page) })}
        />
      ) : report.scope === 'MERCHANT' ? (
        <MerchantAnalyticsDashboard
          report={report}
          activeTab={tab}
          ranking={
            displayedRanking?.scope === 'MERCHANT'
              ? displayedRanking
              : undefined
          }
          rankingControls={rankingControls}
          onRankingControlsChange={changeRankingControls}
          rankingLoading={
            rankingLoading || (!displayedRanking && location.ranking.page !== 1)
          }
          rankingError={currentRankingError}
          rankingErrorPage={currentRankingError ? rankingErrorPage : null}
          onRankingPageChange={changeRankingPage}
        />
      ) : (
        <StaffAnalyticsDashboard
          report={report}
          activeTab={tab}
          ranking={
            displayedRanking?.scope === 'STAFF' ? displayedRanking : undefined
          }
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
          rankingLoading={
            rankingLoading || (!displayedRanking && location.ranking.page !== 1)
          }
          rankingError={currentRankingError}
          rankingErrorPage={currentRankingError ? rankingErrorPage : null}
          onRankingPageChange={changeRankingPage}
        />
      )
    ) : null;
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
              const period = reportLocationParams({
                dates: applied,
                preset: appliedPreset,
              });
              const href = `/app/organizations/${organizationId}/branches/${next}/reports/${reportTabPath(activeTab)}?${period}`;
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
              if (
                next === appliedPreset &&
                dates.fromDay === applied.fromDay &&
                dates.throughDay === applied.throughDay
              ) {
                invalidate();
                setRevision((value) => value + 1);
              }
              onSelectionChange({ dates, preset: next });
            }}
            onChange={setDraft}
            onApply={(next) => {
              const dates = preset === 'ALL_TIME' ? todayInPhilippines() : next;
              if (
                preset === appliedPreset &&
                dates.fromDay === applied.fromDay &&
                dates.throughDay === applied.throughDay
              ) {
                invalidate();
                setRevision((value) => value + 1);
              }
              onSelectionChange({ dates, preset });
            }}
          />
        </div>
      </section>
      <ReportContextBar
        activeTab={activeTab}
        loading={loading}
        validDraft={validDraft}
        onTabChange={(tab) => navigate({}, { tab })}
        tabHref={tabHref}
        onRefresh={() => {
          invalidate();
          setRevision((value) => value + 1);
        }}
      />
      <ReportViewContext.Provider value={renderView}>
        {children ?? <ReportView tab={activeTab} />}
      </ReportViewContext.Provider>
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
