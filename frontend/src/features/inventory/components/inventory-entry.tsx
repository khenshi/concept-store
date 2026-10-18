'use client';

import { useAuth } from '@/features/auth/model/auth-context';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import { PageHeader } from '@/shared/components/ui/page-header';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { RequestError } from '@/shared/components/ui/request-error';
import { InventoryBranchSelector } from './inventory-branch-selector';

export function InventoryEntry({ organizationId }: { organizationId: string }) {
  const { user } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
    selectedBranchId,
    setSelectedBranchId,
  } = useOrganizationWorkspaceContext();
  if (!organization || organization.id !== organizationId)
    return (
      <OrganizationPageFrame wide>
        {organizationStatus === 'error' ? (
          <RequestError
            message={
              organizationError ?? 'Inventory access could not be loaded.'
            }
            onRetry={() => void refreshOrganization()}
          />
        ) : (
          <ListSkeleton label="Loading inventory access" />
        )}
      </OrganizationPageFrame>
    );
  if (organization.role === 'CASHIER')
    return (
      <OrganizationPageFrame wide>
        <p role="alert">
          Your organization role cannot view or manage inventory.
        </p>
      </OrganizationPageFrame>
    );
  return (
    <OrganizationPageFrame wide>
      <PageHeader
        title="Inventory"
        description={
          organization.role === 'MERCHANT'
            ? 'Choose a branch to view only your merchant’s inventory.'
            : 'Choose a branch to manage its independent prices, stock and movement history.'
        }
        action={
          <InventoryBranchSelector
            key={`${organizationId}:${user?.id}:${organization.role}`}
            organizationId={organizationId}
            role={organization.role}
            preferredBranchId={selectedBranchId}
            rememberBranch={setSelectedBranchId}
            compact
          />
        }
      />
    </OrganizationPageFrame>
  );
}
