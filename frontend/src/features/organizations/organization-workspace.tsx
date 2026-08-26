'use client';

import Link from 'next/link';
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

  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';
  const destinations = [
    {
      label: 'Branches',
      description: 'Manage the physical locations in this organization.',
      href: `/app/organizations/${organizationId}/branches`,
      visible: true,
    },
    {
      label: 'Spaces',
      description: 'Organize racks, shelves, booths, and selling areas.',
      href: `/app/organizations/${organizationId}/spaces`,
      visible: canManage,
    },
    {
      label: 'Merchants',
      description: 'Review independent brands and branch participation.',
      href: `/app/organizations/${organizationId}/merchants`,
      visible: canManage,
    },
    {
      label: 'Products',
      description: 'Maintain merchant-owned products and selling codes.',
      href: `/app/organizations/${organizationId}/products`,
      visible: canManage,
    },
    {
      label: 'Inventory',
      description: 'Review current stock across branches and merchants.',
      href: `/app/organizations/${organizationId}/inventory`,
      visible: canManage,
    },
    {
      label: 'Members',
      description: 'Manage the people and roles operating this workspace.',
      href: `/app/organizations/${organizationId}/members`,
      visible: canManage,
    },
  ].filter((destination) => destination.visible);

  return (
    <section className="mx-auto mt-8 w-full sm:mt-12">
      <OrganizationPageHeader
        organization={organization}
        title="Workspace overview"
        description="Choose an operational area to continue managing this concept store."
      />

      <section
        className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
        aria-labelledby="workspace-sections-title"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold" id="workspace-sections-title">
              Store operations
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Available areas reflect your organization role.
            </p>
          </div>
          <span className="min-w-7 rounded-full bg-emerald-100 px-2 py-1 text-center text-xs font-bold text-emerald-700">
            {destinations.length}
          </span>
        </div>
        <ul className="mt-5 grid list-none gap-3 p-0 sm:grid-cols-2">
          {destinations.map((destination) => (
            <li key={destination.label}>
              <Link
                className="group flex h-full items-start justify-between gap-4 rounded-[0.6rem] border border-slate-200 p-4 text-slate-950 no-underline transition-colors hover:border-emerald-600"
                href={destination.href}
              >
                <span>
                  <strong className="text-sm">{destination.label}</strong>
                  <span className="mt-1 block text-sm leading-6 text-slate-500">
                    {destination.description}
                  </span>
                </span>
                <span className="text-emerald-700" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
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
      <div className="mt-8 h-12 border-b border-slate-200" />
      <div className="mt-6 h-56 rounded-xl border border-slate-200 bg-white" />
      <span className="sr-only">Loading organization…</span>
    </section>
  );
}
