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

export function ReportsEntry({ organizationId }: { organizationId: string }) {
  return (
    <ReportAccess organizationId={organizationId}>
      {(scope) => (
        <ScopedReportsEntry key={scope} organizationId={organizationId} />
      )}
    </ReportAccess>
  );
}
function ScopedReportsEntry({ organizationId }: { organizationId: string }) {
  const { request } = useAuth();
  const { refreshOrganization } = useOrganizationWorkspaceContext();
  const router = useRouter();
  const [branches, setBranches] = useState<ReportBranch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
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
  return (
    <OperationalPage>
      <PageHeader
        title="Reports"
        description="Choose one branch to view its gross recorded sales, transaction count, units sold and payment summary."
      />
      <ReportBranchPicker
        branches={branches}
        loading={branches === null && error === null}
        onChange={(branchId) =>
          router.push(
            `/app/organizations/${organizationId}/branches/${branchId}/reports`,
          )
        }
      />
      {branches?.length === 0 ? (
        <p role="status" className="text-sm text-muted">
          No accessible report branches. Ask an owner to check your branch
          assignments or create a branch.
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
      {error || branches?.length === 0 ? (
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
