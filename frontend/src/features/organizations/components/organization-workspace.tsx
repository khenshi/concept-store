'use client';

import Link from 'next/link';
import { buttonStyles } from '@/shared/components/ui/button';
import { Icon, type IconName } from '@/shared/components/ui/icon';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { useOrganizationWorkspaceContext } from './organization-workspace-context';

export function OrganizationWorkspace({
  organizationId,
}: {
  organizationId: string;
}) {
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
  } = useOrganizationWorkspaceContext();
  if (organizationStatus === 'loading') return <OrganizationOverviewSkeleton />;
  if (organizationStatus === 'error' || !organization)
    return (
      <OperationalPage>
        <PageHeader
          eyebrow="Organization unavailable"
          title="We could not open this workspace."
          description="Try again or select another organization you belong to."
        />
        <div className="mt-6 max-w-2xl rounded-panel border border-hairline bg-surface p-6">
          <RequestError
            message={
              organizationError ?? 'The organization could not be loaded.'
            }
            onRetry={() => void refreshOrganization()}
          />
          <Link
            className={buttonStyles({ variant: 'quiet', className: 'mt-3' })}
            href="/app"
          >
            Choose another organization
          </Link>
        </div>
      </OperationalPage>
    );

  const canManage =
    organization.role === 'OWNER' ||
    organization.role === 'MANAGER' ||
    organization.role === 'MERCHANT';
  const destinations: {
    label: string;
    description: string;
    href: string;
    visible: boolean;
    icon: IconName;
  }[] = [
    {
      label: 'Branches',
      description:
        'View and maintain the physical locations in this organization.',
      href: `/app/organizations/${organizationId}/branches`,
      visible: true,
      icon: 'building',
    },
    {
      label: 'Merchants',
      description:
        organization.role === 'MERCHANT'
          ? 'View your linked merchant profile.'
          : 'View merchant profiles available to your role and branches.',
      href: `/app/organizations/${organizationId}/merchants`,
      visible: canManage,
      icon: 'store',
    },
    {
      label: 'Members',
      description:
        'Review team access and roles. Owners can also manage invitations.',
      href: `/app/organizations/${organizationId}/members`,
      visible: organization.role === 'OWNER',
      icon: 'users',
    },
    {
      label: 'Products',
      description: 'View available products and their branch prices and stock.',
      href: `/app/organizations/${organizationId}/products`,
      visible: canManage,
      icon: 'store',
    },
    {
      label: 'Account settings',
      description:
        'Update your personal profile, password, and account settings.',
      href: '/app/account',
      visible: true,
      icon: 'account',
    },
    {
      label: 'Sales',
      description:
        'View historical sales involving only your linked merchant business.',
      href: `/app/organizations/${organizationId}/sales`,
      visible: organization.role === 'MERCHANT',
      icon: 'store',
    },
  ];

  return (
    <OperationalPage>
      <PageHeader
        eyebrow={organization.name}
        title="Workspace overview"
        description="The people and places behind your concept store, organized in one workspace."
      />
      <OperationalPanel
        title="Your workspace"
        description={`Your current organization role is ${organization.role.toLowerCase()}.`}
      >
        <ul className="m-0 list-none divide-y divide-hairline p-0">
          {destinations
            .filter((destination) => destination.visible)
            .map((destination) => (
              <li key={destination.label}>
                <Link
                  className="group flex min-h-24 w-full items-center gap-4 px-5 py-5 text-ink no-underline hover:bg-subtle sm:px-6"
                  href={destination.href}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-control border border-hairline bg-subtle text-muted">
                    <Icon name={destination.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="text-sm font-semibold">
                      {destination.label}
                    </strong>
                    <span className="mt-1 block text-sm leading-6 text-muted">
                      {destination.description}
                    </span>
                  </span>
                  <Icon name="arrow" className="size-4 text-muted" />
                </Link>
              </li>
            ))}
        </ul>
      </OperationalPanel>
    </OperationalPage>
  );
}

function OrganizationOverviewSkeleton() {
  return (
    <OperationalPage>
      <div
        className="animate-pulse"
        role="status"
        aria-label="Loading organization workspace"
        aria-busy="true"
      >
        <div aria-hidden="true">
          <div className="h-3 w-32 rounded bg-selected" />
          <div className="mt-4 h-9 w-72 max-w-full rounded bg-selected" />
          <div className="mt-4 h-5 w-full max-w-xl rounded bg-selected" />
          <div className="mt-8 h-64 rounded-panel border border-hairline bg-surface" />
        </div>
        <span className="sr-only">Loading organization…</span>
      </div>
    </OperationalPage>
  );
}
