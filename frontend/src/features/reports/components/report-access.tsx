'use client';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { OperationalPage } from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';

export function ReportAccess({
  organizationId,
  children,
}: {
  organizationId: string;
  children(scope: string): ReactNode;
}) {
  const { user } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
  } = useOrganizationWorkspaceContext();
  if (
    organizationStatus !== 'ready' ||
    !organization ||
    organization.id !== organizationId
  )
    return (
      <OperationalPage>
        {organizationStatus === 'error' ? (
          <RequestError
            message={organizationError ?? 'Reports access could not be loaded.'}
            onRetry={() => void refreshOrganization()}
          />
        ) : (
          <ListSkeleton label="Loading reports access" />
        )}
      </OperationalPage>
    );
  if (organization.role !== 'OWNER' && organization.role !== 'MANAGER')
    return (
      <OperationalPage>
        <p role="alert">
          {organization.role === 'MERCHANT'
            ? 'Merchant Reports are not available yet. Your own-sales history remains available in Sales.'
            : 'Your organization role cannot access Reports.'}
        </p>
      </OperationalPage>
    );
  return children(`${organizationId}:${organization.role}:${user?.id}`);
}
