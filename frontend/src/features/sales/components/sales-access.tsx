'use client';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { OperationalPage } from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';

export function SalesAccess({
  organizationId,
  children,
}: {
  organizationId: string;
  children(role: OrganizationRole, scopeKey: string): ReactNode;
}) {
  const { user } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
  } = useOrganizationWorkspaceContext();
  if (!organization || organization.id !== organizationId)
    return (
      <OperationalPage>
        {organizationStatus === 'error' ? (
          <RequestError
            message={organizationError ?? 'Sales access could not be loaded.'}
            onRetry={() => void refreshOrganization()}
          />
        ) : (
          <ListSkeleton label="Loading sales access" />
        )}
      </OperationalPage>
    );
  return children(
    organization.role,
    `${organizationId}:${organization.role}:${user?.id}`,
  );
}
