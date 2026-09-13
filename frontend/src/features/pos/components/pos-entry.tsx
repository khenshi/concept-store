'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { OperationalPage } from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { RequestError } from '@/shared/components/ui/request-error';
import {
  checkoutAttemptKey,
  useCheckoutAttempt,
} from '../model/checkout-attempt';
import { PosBranchSelector } from './pos-branch-selector';

export function PosEntry({ organizationId }: { organizationId: string }) {
  const { user } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
  } = useOrganizationWorkspaceContext();
  const attempt = useCheckoutAttempt(
    checkoutAttemptKey(organizationId, user?.id ?? ''),
  );
  if (!organization || organization.id !== organizationId)
    return (
      <OperationalPage>
        {organizationStatus === 'error' ? (
          <RequestError
            message={organizationError ?? 'Organization could not be loaded.'}
            onRetry={() => void refreshOrganization()}
          />
        ) : (
          <ListSkeleton label="Loading POS access" />
        )}
      </OperationalPage>
    );
  if (organization.role === 'MERCHANT')
    return (
      <OperationalPage>
        <p role="alert">Merchants cannot access POS.</p>
      </OperationalPage>
    );
  const unresolved = attempt && attempt.state !== 'completed';
  return (
    <OperationalPage>
      <PageHeader
        title="POS"
        description="Choose an authorized branch to start a branch-specific cart."
      />
      <PosBranchSelector
        key={`${organizationId}:${user?.id}:${organization.role}`}
        organizationId={organizationId}
        role={organization.role}
        disabled={Boolean(unresolved)}
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
    </OperationalPage>
  );
}
