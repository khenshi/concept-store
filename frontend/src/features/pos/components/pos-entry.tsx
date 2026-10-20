'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/model/auth-context';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { PageHeader } from '@/shared/components/ui/page-header';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { RequestError } from '@/shared/components/ui/request-error';
import {
  checkoutAttemptKey,
  useCheckoutAttempt,
} from '../model/checkout-attempt';
import { PosBranchSelector } from './pos-branch-selector';
import { PosLoadingHeader } from './pos-loading-header';

export function PosEntry({ organizationId }: { organizationId: string }) {
  const { user } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
    selectedBranchId,
    setSelectedBranchId,
  } = useOrganizationWorkspaceContext();
  const attempt = useCheckoutAttempt(
    checkoutAttemptKey(organizationId, user?.id ?? ''),
  );
  if (!organization || organization.id !== organizationId)
    return (
      <OrganizationPageFrame wide>
        <PosLoadingHeader
          loading={organizationStatus !== 'error'}
          description="Choose an authorized branch to start a branch-specific cart."
        />
        {organizationStatus === 'error' ? (
          <RequestError
            message={organizationError ?? 'Organization could not be loaded.'}
            onRetry={() => void refreshOrganization()}
          />
        ) : (
          <ListSkeleton label="Loading POS access" />
        )}
      </OrganizationPageFrame>
    );
  if (organization.role === 'MERCHANT')
    return (
      <OrganizationPageFrame wide>
        <p role="alert">Merchants cannot access POS.</p>
      </OrganizationPageFrame>
    );
  const unresolved = attempt && attempt.state !== 'completed';
  return (
    <OrganizationPageFrame wide>
      <PageHeader
        title="POS"
        description="Choose an authorized branch to start a branch-specific cart."
        action={
          <PosBranchSelector
            key={`${organizationId}:${user?.id}:${organization.role}`}
            organizationId={organizationId}
            role={organization.role}
            disabled={Boolean(unresolved)}
            preferredBranchId={selectedBranchId}
            rememberBranch={setSelectedBranchId}
            compact
          />
        }
      />
      {unresolved ? (
        <p role="alert">
          Resolve your pending or unconfirmed checkout before changing branches.{' '}
          <Link
            href={`/app/organizations/${organizationId}/branches/${attempt.scope.branchId}/pos`}
          >
            Return to unresolved checkout
          </Link>
        </p>
      ) : null}
    </OrganizationPageFrame>
  );
}
