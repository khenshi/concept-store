'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { OperationalPage } from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { listReportBranches } from '../api/report-api';
import type { ReportBranch } from '../model/report.schemas';
import { ReportAccess } from './report-access';
import { ReportBranchPicker } from './report-branch-picker';
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

export function ReportsEntry({ organizationId }: { organizationId: string }) {
  return (
    <ReportAccess organizationId={organizationId}>
      {(scope, role) => (
        <ScopedReportsEntry
          key={scope}
          organizationId={organizationId}
          merchant={role === 'MERCHANT'}
        />
      )}
    </ReportAccess>
  );
}
function ScopedReportsEntry({
  organizationId,
  merchant,
}: {
  organizationId: string;
  merchant: boolean;
}) {
  const { request, user } = useAuth();
  const { refreshOrganization, selectedBranchId, setSelectedBranchId } =
    useOrganizationWorkspaceContext();
  const router = useRouter();
  const [branches, setBranches] = useState<ReportBranch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const resumed = useRef<string | null>(null);
  function navigate(branchId: string) {
    const checkout =
      user && getCheckoutAttempt(checkoutAttemptKey(organizationId, user.id));
    const refund =
      user && getRefundAttempt(refundAttemptKey(organizationId, user.id));
    if (
      (checkout && checkout.state !== 'completed') ||
      (refund && refund.state !== 'completed')
    )
      return;
    const href = `/app/organizations/${organizationId}/branches/${branchId}/reports`;
    if (!allowPosNavigation(href)) return;
    resumed.current = branchId;
    setSelectedBranchId(branchId);
    router.push(href);
  }
  useEffect(() => {
    const current = ++generation.current;
    let active = true;
    void listReportBranches(request, organizationId)
      .then((items) => {
        if (active && current === generation.current) setBranches(items);
      })
      .catch((cause) => {
        if (active && current === generation.current) {
          setBranches(null);
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Accessible report branches could not be loaded.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [request, organizationId, revision]);
  useEffect(() => {
    if (
      selectedBranchId &&
      branches?.some((branch) => branch.id === selectedBranchId) &&
      !error &&
      resumed.current !== selectedBranchId
    )
      navigate(selectedBranchId);
  });
  return (
    <OperationalPage>
      <PageHeader
        title="Reports"
        description={
          merchant
            ? 'Choose one branch to view your own gross recorded sales, matching transactions and units sold.'
            : 'Choose one branch to view its gross recorded sales, transaction count, units sold and payment summary.'
        }
      />
      {merchant ? <MerchantReportGuidance /> : null}
      <ReportBranchPicker
        branches={branches}
        loading={branches === null && error === null}
        onChange={navigate}
      />
      {selectedBranchId &&
      branches &&
      !error &&
      !branches.some((branch) => branch.id === selectedBranchId) ? (
        <p role="status" className="text-sm text-muted">
          The selected branch is unavailable in Reports. Choose an accessible
          branch.
        </p>
      ) : null}
      {branches?.length === 0 ? (
        <p role="status" className="text-sm text-muted">
          {merchant
            ? 'No assigned or historical own-selling branches are available. Ask an owner to check your merchant profile link and branch assignments.'
            : 'No accessible report branches. Ask an owner to check your branch assignments or create a branch.'}
        </p>
      ) : null}
      {error ? (
        <RequestError
          message={error}
          onRetry={() => {
            generation.current++;
            setBranches(null);
            setError(null);
            setRevision((value) => value + 1);
          }}
        />
      ) : null}
      {merchant || error || branches?.length === 0 ? (
        <button
          type="button"
          className="mt-4 text-sm underline"
          onClick={() => void refreshOrganization()}
        >
          Refresh access
        </button>
      ) : null}
    </OperationalPage>
  );
}
