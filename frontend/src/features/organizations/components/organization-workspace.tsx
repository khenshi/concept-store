'use client';

import Link from 'next/link';
import { buttonStyles } from '@/shared/components/ui/button';
import { Icon, type IconName } from '@/shared/components/ui/icon';
import { OperationalPanel } from '@/shared/components/ui/operational-page';
import { PageHeader } from '@/shared/components/ui/page-header';
import { RequestError } from '@/shared/components/ui/request-error';
import { OrganizationPageFrame } from './organization-page-frame';
import { useOrganizationWorkspaceContext } from './organization-workspace-context';
import { organizationNavigationIcons } from './organization-navigation';

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
  if (organizationStatus === 'loading')
    return (
      <OrganizationPageFrame>
        <OrganizationOverviewSkeleton />
      </OrganizationPageFrame>
    );
  if (organizationStatus === 'error' || !organization)
    return (
      <OrganizationPageFrame>
        <PageHeader
          eyebrow="Organization unavailable"
          title="We could not open this workspace."
          description="Try again or select another organization you belong to."
        />
        <div className="mt-8 max-w-2xl py-6">
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
      </OrganizationPageFrame>
    );

  const canManage =
    organization.role === 'OWNER' ||
    organization.role === 'MANAGER' ||
    organization.role === 'MERCHANT';
  const destinations: {
    key: string;
    label: string;
    description: string;
    href: string;
    visible: boolean;
    icon: IconName;
    group: 'operations' | 'organization' | 'personal';
  }[] = [
    {
      key: 'reports',
      label: 'Reports',
      description: 'Sales, refunds, and performance.',
      href: `/app/organizations/${organizationId}/reports`,
      visible: canManage,
      icon: organizationNavigationIcons.reports,
      group: 'operations',
    },
    {
      key: 'inventory',
      label: 'Inventory',
      description: 'Stock and branch availability.',
      href: `/app/organizations/${organizationId}/inventory`,
      visible: organization.role !== 'CASHIER',
      icon: organizationNavigationIcons.inventory,
      group: 'operations',
    },
    {
      key: 'spaces',
      label: 'Spaces',
      description: 'Placements and occupancy.',
      href: `/app/organizations/${organizationId}/spaces`,
      visible: organization.role !== 'CASHIER',
      icon: organizationNavigationIcons.spaces,
      group: 'operations',
    },
    {
      key: 'pos',
      label: 'POS',
      description: 'Checkout and branch sales.',
      href: `/app/organizations/${organizationId}/pos`,
      visible: organization.role !== 'MERCHANT',
      icon: organizationNavigationIcons.pos,
      group: 'operations',
    },
    {
      key: 'sales',
      label: 'Sales',
      description: 'Your historical merchant sales.',
      href: `/app/organizations/${organizationId}/sales`,
      visible: organization.role === 'MERCHANT',
      icon: organizationNavigationIcons.sales,
      group: 'operations',
    },
    {
      key: 'branches',
      label: 'Branches',
      description: 'Locations in this organization.',
      href: `/app/organizations/${organizationId}/branches`,
      visible: true,
      icon: organizationNavigationIcons.branches,
      group: 'organization',
    },
    {
      key: 'merchants',
      label: 'Merchants',
      description:
        organization.role === 'MERCHANT'
          ? 'Your linked merchant profile.'
          : 'Merchant profiles and access.',
      href: `/app/organizations/${organizationId}/merchants`,
      visible: canManage,
      icon: organizationNavigationIcons.merchants,
      group: 'organization',
    },
    {
      key: 'members',
      label: 'Members',
      description: 'Team access and invitations.',
      href: `/app/organizations/${organizationId}/members`,
      visible: organization.role === 'OWNER',
      icon: organizationNavigationIcons.members,
      group: 'organization',
    },
    {
      key: 'products',
      label: 'Products',
      description: 'Products, prices, and stock.',
      href: `/app/organizations/${organizationId}/products`,
      visible: canManage,
      icon: organizationNavigationIcons.products,
      group: 'organization',
    },
    {
      key: 'account',
      label: 'Account settings',
      description: 'Profile, password, and account access.',
      href: '/app/account',
      visible: true,
      icon: 'account',
      group: 'personal',
    },
  ];
  const visibleDestinations = destinations.filter(
    (destination) => destination.visible,
  );
  const destinationCard = (destination: (typeof destinations)[number]) => (
    <li key={destination.key} className="h-full">
      <Link
        className="group flex h-full min-h-18 items-start gap-3 card-surface p-3 text-ink no-underline transition-colors hover:bg-subtle focus-visible:outline-offset-[-2px]"
        href={destination.href}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-control border border-hairline bg-subtle text-ink transition-colors group-hover:border-selected-border">
          <Icon name={destination.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="text-sm font-semibold">{destination.label}</strong>
          <span className="mt-1.5 block text-xs leading-5 text-muted">
            {destination.description}
          </span>
        </span>
        <Icon
          name="arrow"
          className="mt-1 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  );

  return (
    <OrganizationPageFrame>
      <PageHeader
        className=""
        eyebrow={organization.name}
        title="Workspace overview"
        description="Move between daily operations, organization management, and your account from one clear starting point."
        action={
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-subtle px-3 py-1.5 text-xs font-semibold text-muted">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-accent"
              />
              {organization.role.charAt(0) +
                organization.role.slice(1).toLowerCase()}{' '}
              access
            </span>
          </div>
        }
      />
      <div className="grid gap-5">
        <OperationalPanel
          className="mt-0"
          title="Branch operations"
          description="The tools used to run day-to-day work in your branches."
        >
          <ul className="m-0 grid list-none gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
            {visibleDestinations
              .filter((destination) => destination.group === 'operations')
              .map(destinationCard)}
          </ul>
        </OperationalPanel>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.6fr)]">
          <OperationalPanel
            className="mt-0"
            title="Organization"
            description="Manage the people, products, and places that make up this workspace."
          >
            <ul className="m-0 grid list-none gap-3 p-4 sm:grid-cols-2 sm:p-5">
              {visibleDestinations
                .filter((destination) => destination.group === 'organization')
                .map(destinationCard)}
            </ul>
          </OperationalPanel>
          <OperationalPanel
            className="mt-0"
            title="Personal"
            description="Keep your profile and account access up to date."
          >
            <ul className="m-0 list-none p-4 sm:p-5">
              {visibleDestinations
                .filter((destination) => destination.group === 'personal')
                .map(destinationCard)}
            </ul>
          </OperationalPanel>
        </div>
      </div>
    </OrganizationPageFrame>
  );
}

function OrganizationOverviewSkeleton() {
  return (
    <div
      className="animate-pulse"
      role="status"
      aria-label="Loading organization workspace"
      aria-busy="true"
    >
      <div aria-hidden="true">
        <div className="flex items-start justify-between gap-6 max-sm:flex-col">
          <div className="min-w-0 flex-1">
            <div className="h-3 w-32 rounded bg-selected" />
            <div className="mt-4 h-9 w-72 max-w-full rounded bg-selected" />
            <div className="mt-4 h-5 w-full max-w-xl rounded bg-selected" />
          </div>
          <div className="h-8 w-28 rounded-full bg-selected" />
        </div>
        <div className="mt-4 grid gap-5">
          <div className="card-surface p-4 sm:p-5">
            <div className="h-5 w-40 rounded bg-selected" />
            <div className="mt-2 h-4 w-80 max-w-full rounded bg-selected" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="h-24 rounded-panel bg-subtle" />
              <div className="h-24 rounded-panel bg-subtle" />
              <div className="h-24 rounded-panel bg-subtle" />
              <div className="h-24 rounded-panel bg-subtle" />
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
            <div className="card-surface p-4 sm:p-5">
              <div className="h-5 w-32 rounded bg-selected" />
              <div className="mt-2 h-4 w-80 max-w-full rounded bg-selected" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="h-24 rounded-panel bg-subtle" />
                <div className="h-24 rounded-panel bg-subtle" />
                <div className="h-24 rounded-panel bg-subtle" />
                <div className="h-24 rounded-panel bg-subtle" />
              </div>
            </div>
            <div className="card-surface p-4 sm:p-5">
              <div className="h-5 w-24 rounded bg-selected" />
              <div className="mt-2 h-4 w-full rounded bg-selected" />
              <div className="mt-4 h-24 rounded-panel bg-subtle" />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Loading organization…</span>
    </div>
  );
}
