'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { OrganizationNavigation } from './organization-navigation';
import { useOrganizationWorkspaceContext } from './organization-workspace-context';

export function OrganizationWorkspaceShell({
  organizationId,
  children,
}: {
  organizationId: string;
  children: ReactNode;
}) {
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const canManage =
    organization?.role === 'OWNER' || organization?.role === 'MANAGER';

  return (
    <div className="w-full lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-7">
      <aside className="mt-8 min-w-0 lg:sticky lg:top-24 lg:self-start sm:mt-12">
        <Link
          className="text-sm font-bold text-emerald-700 underline underline-offset-3"
          href="/app"
        >
          ← All organizations
        </Link>
        {organizationStatus === 'loading' ? (
          <div
            className="mt-5 h-10 animate-pulse rounded-lg bg-slate-200"
            role="status"
            aria-label="Loading organization navigation"
          />
        ) : organization ? (
          <OrganizationNavigation
            organizationId={organizationId}
            showMembers={canManage}
            showMerchants={canManage}
            showSpaces={canManage}
          />
        ) : null}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
