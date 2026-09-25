'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { OperationalPage } from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import {
  getStaffSalesAnalytics,
  getMerchantSalesAnalytics,
  getStaffSalesRankings,
  getMerchantSalesRankings,
  listReportBranches,
} from '../api/report-api';
import {
  reportDateRangeSchema,
  reportUtcRange,
  todayInPhilippines,
  type ReportDateRange,
} from '../model/report-dates';
import type {
  ReportBranch,
  StaffSalesAnalytics,
  MerchantSalesAnalytics,
  StaffSalesRankingPage,
  MerchantSalesRankingPage,
} from '../model/report.schemas';
import { ReportAccess } from './report-access';
import { ReportBranchPicker } from './report-branch-picker';
import { ReportDateFilter } from './report-date-filter';
import { StaffAnalyticsDashboard } from './staff-analytics-dashboard';
import type { SalesReportTab } from './staff-analytics-dashboard';
import { MerchantAnalyticsDashboard } from './merchant-analytics-dashboard';
import { MerchantReportGuidance } from './merchant-report-guidance';
import { allowPosNavigation } from '@/features/pos/model/pos-navigation';
import {
  getCheckoutAttempt,
  checkoutAttemptKey,
} from '@/features/pos/model/checkout-attempt';
import {
  getRefundAttempt,
  refundAttemptKey,
} from '@/features/refunds/model/refund-attempt';

export function BranchReports(props: {
  organizationId: string;
  branchId: string;
}) {
  return (
    <ReportAccess organizationId={props.organizationId}>
      {(scope, role) => (
        <ScopedBranchReports
          key={`${scope}:${props.branchId}`}
          {...props}
          merchant={role === 'MERCHANT'}
        />
      )}
    </ReportAccess>
  );
}
function ScopedBranchReports({
  organizationId,
  branchId,
  merchant,
}: {
  organizationId: string;
  branchId: string;
  merchant: boolean;
}) {
  const { request, user } = useAuth();
  const { refreshOrganization, setSelectedBranchId } =
    useOrganizationWorkspaceContext();
  const router = useRouter();
  const [draft, setDraft] = useState(todayInPhilippines);
  const [applied, setApplied] = useState<ReportDateRange>(draft);
  const [branches, setBranches] = useState<ReportBranch[] | null>(null);
  const [report, setReport] = useState<
    StaffSalesAnalytics | MerchantSalesAnalytics | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<SalesReportTab>('overview');
  const [ranking, setRanking] = useState<
    StaffSalesRankingPage | MerchantSalesRankingPage | null
  >(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [rankingErrorPage, setRankingErrorPage] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  function invalidate() {
    generation.current++;
    setReport(null);
    setBranches(null);
    setError(null);
    setDenied(false);
    setLoading(true);
    setRanking(null);
    setRankingLoading(false);
    setRankingError(null);
    setRankingErrorPage(null);
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
        const result = await (
          merchant ? getMerchantSalesAnalytics : getStaffSalesAnalytics
        )(request, organizationId, branchId, reportUtcRange(applied));
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
    revision,
    merchant,
    setSelectedBranchId,
  ]);
  async function loadRankingPage(page: number) {
    if (rankingLoading || page < 1) return;
    const current = generation.current;
    setRankingLoading(true);
    setRankingError(null);
    setRankingErrorPage(null);
    try {
      const query = { ...reportUtcRange(applied), page };
      const result = merchant
        ? await getMerchantSalesRankings(
            request,
            organizationId,
            branchId,
            query,
          )
        : await getStaffSalesRankings(request, organizationId, branchId, query);
      if (current !== generation.current) return;
      setRanking(result);
    } catch (cause) {
      if (current !== generation.current) return;
      setRankingError(
        cause instanceof ApiError
          ? cause.message
          : 'The product ranking page could not be loaded.',
      );
      setRankingErrorPage(page);
    } finally {
      if (current === generation.current) setRankingLoading(false);
    }
  }
  const validDraft = reportDateRangeSchema.safeParse(draft).success;
  return (
    <OperationalPage>
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
        className="mt-10 bg-surface text-ink"
      >
        <div className="grid gap-5 py-5 sm:py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <h2
              id="report-period-heading"
              className="text-base font-semibold text-ink"
            >
              Report period
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              Dates use Philippine time. Both the start and end dates are
              included.
            </p>
          </div>
          <ReportDateFilter
            value={draft}
            onChange={setDraft}
            onApply={(next) => {
              invalidate();
              setApplied(next);
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline">
          <div
            className="flex min-w-0 flex-wrap items-center gap-1"
            role="tablist"
            aria-label="Sales report views"
          >
            {[
              ['overview', 'Overview'],
              ['daily', 'Daily Data'],
              ['rankings', 'Rankings'],
            ].map(([value, label]) => (
              <button
                key={value}
                id={`sales-report-tab-${value}`}
                type="button"
                role="tab"
                aria-selected={activeTab === value}
                aria-controls={`sales-${value}-panel`}
                className={`min-h-11 rounded-none border-b-2 px-3 text-sm font-semibold transition-colors ${
                  activeTab === value
                    ? 'border-ink text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
                onClick={() => setActiveTab(value as SalesReportTab)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={buttonStyles({ variant: 'secondary' })}
            disabled={loading || !validDraft}
            onClick={() => {
              invalidate();
              setRevision((value) => value + 1);
            }}
          >
            Refresh Report
          </button>
        </div>
      </section>
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
      ) : report ? (
        report.scope === 'MERCHANT' ? (
          <MerchantAnalyticsDashboard
            report={report}
            activeTab={activeTab}
            ranking={ranking?.scope === 'MERCHANT' ? ranking : undefined}
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
    </OperationalPage>
  );
}
