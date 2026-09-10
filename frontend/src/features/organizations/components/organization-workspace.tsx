'use client';

import Link from 'next/link';
import {
  OperationalPage,
  OperationalPanel,
} from '@/shared/components/ui/operational-page';
import { OrganizationPageHeader } from './organization-page-header';
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
  if (organizationStatus === 'error' || !organization) {
    return (
      <section className="mx-auto mt-12 w-full max-w-3xl" role="alert">
        <p className="mb-4 text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
          Organization unavailable
        </p>
        <h1 className="text-[clamp(2rem,5vw,3rem)] leading-[1.05] font-bold tracking-[-0.04em] text-slate-950">
          We could not open this workspace.
        </h1>
        <p className="mt-4 leading-7 text-slate-500">
          {organizationError ?? 'The organization could not be loaded.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-4">
          <button
            className="cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
            type="button"
            onClick={() => void refreshOrganization()}
          >
            Try again
          </button>
          <Link
            className="font-bold text-emerald-700 underline underline-offset-3"
            href="/app"
          >
            Choose another organization
          </Link>
        </div>
      </section>
    );
  }

  const canViewMembers =
    organization.role === 'OWNER' || organization.role === 'MANAGER';
  const destinations = [
    {
      label: 'Branches',
      description:
        'Create and maintain the physical locations in this organization.',
      href: `/app/organizations/${organizationId}/branches`,
      visible: true,
    },
    {
      label: 'Members',
      description:
        'Review organization access, roles, and pending invitations.',
      href: `/app/organizations/${organizationId}/members`,
      visible: canViewMembers,
    },
    {
      label: 'Account settings',
      description: 'Update your profile, password, and account preferences.',
      href: '/app/account',
      visible: true,
    },
  ].filter((destination) => destination.visible);

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Workspace overview"
        description="Manage the secure organization foundation before adding future business modules."
      />
      <OperationalPanel
        title="Foundation"
        description={`Your current organization role is ${organization.role.toLowerCase()}.`}
      >
        <ul className="list-none px-5 py-2 sm:px-6">
          {destinations.map((destination) => (
            <li
              className="border-b border-slate-200 last:border-0"
              key={destination.label}
            >
              <Link
                className="group flex items-center justify-between gap-5 py-4 text-slate-950 no-underline"
                href={destination.href}
              >
                <span>
                  <strong className="text-sm">{destination.label}</strong>
                  <span className="mt-1 block text-sm leading-6 text-slate-500">
                    {destination.description}
                  </span>
                </span>
                <span
                  className="text-emerald-700 transition group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
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
    <section
      className="mx-auto mt-12 w-full animate-pulse"
      role="status"
      aria-label="Loading organization workspace"
      aria-busy="true"
    >
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="mt-8 h-3 w-40 rounded bg-emerald-100" />
      <div className="mt-3 h-10 w-72 max-w-full rounded bg-slate-200" />
      <div className="mt-4 h-5 w-full max-w-xl rounded bg-slate-200" />
      <div className="mt-8 h-56 rounded-xl border border-slate-200 bg-white" />
      <span className="sr-only">Loading organization…</span>
    </section>
  );
}
