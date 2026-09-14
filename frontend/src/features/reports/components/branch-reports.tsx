'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { buttonStyles } from '@/shared/components/ui/button';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import {
  getStaffSalesReport,
  getMerchantSalesReport,
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
  StaffSalesReport,
  MerchantSalesReport,
} from '../model/report.schemas';
import { ReportAccess } from './report-access';
import { ReportBranchPicker } from './report-branch-picker';
import { ReportDateFilter } from './report-date-filter';
import { StaffReportSummary } from './staff-report-summary';
import { MerchantReportSummary } from './merchant-report-summary';
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
    StaffSalesReport | MerchantSalesReport | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  function invalidate() {
    generation.current++;
    setReport(null);
    setBranches(null);
    setError(null);
    setDenied(false);
    setLoading(true);
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
          merchant ? getMerchantSalesReport : getStaffSalesReport
        )(request, organizationId, branchId, reportUtcRange(applied));
        if (!active || current !== generation.current) return;
        setBranches(items);
        setReport(result);
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
  const validDraft = reportDateRangeSchema.safeParse(draft).success;
  return (
    <OperationalPage>
      <PageHeader
        title={merchant ? 'Own-sales reports' : 'Sales reports'}
        description={
          merchant
            ? 'Gross recorded sales of your own items only, not whole-branch sales. Transactions count distinct sales containing your items.'
            : 'Gross recorded sales for one branch. These totals are not profit, net sales or merchant payouts.'
        }
      />
      {merchant ? <MerchantReportGuidance /> : null}
      <ReportBranchPicker
        branches={branches}
        loading={loading}
        branchId={branchId}
        onChange={(next) => {
          const checkout =
            user &&
            getCheckoutAttempt(checkoutAttemptKey(organizationId, user.id));
          const refund =
            user && getRefundAttempt(refundAttemptKey(organizationId, user.id));
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
      />
      <OperationalPanel
        title="Report period"
        description="Philippines calendar dates (Asia/Manila, UTC+08:00). From and Through are inclusive."
      >
        <ReportDateFilter
          value={draft}
          onChange={setDraft}
          onApply={(next) => {
            invalidate();
            setApplied(next);
          }}
        />
      </OperationalPanel>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Applied period (Philippines): {applied.fromDay} through{' '}
          {applied.throughDay}
        </p>
        <button
          type="button"
          className={buttonStyles({ variant: 'secondary' })}
          disabled={loading || !validDraft}
          onClick={() => {
            invalidate();
            setRevision((value) => value + 1);
          }}
        >
          Refresh report
        </button>
      </div>
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
          <MerchantReportSummary report={report} />
        ) : (
          <StaffReportSummary report={report} />
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
