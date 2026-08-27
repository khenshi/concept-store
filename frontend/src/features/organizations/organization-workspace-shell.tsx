'use client';

import { useState, type ReactNode } from 'react';
import { OrganizationNavigation } from './organization-navigation';
import { OrganizationSwitcher } from './organization-switcher';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigation = organization ? (
    <OrganizationNavigation
      organizationId={organizationId}
      showMembers={canManage}
      showMerchants={canManage}
      showProducts={canManage}
      showInventory={canManage}
      showSpaces={canManage}
      onNavigate={() => setIsMenuOpen(false)}
    />
  ) : null;

  return (
    <div className="w-full lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="hidden min-h-[calc(100vh-4.25rem)] min-w-0 border-r border-slate-200 bg-white px-5 py-6 lg:sticky lg:top-17 lg:block lg:self-start">
        <OrganizationSwitcher
          organizationId={organizationId}
          organizationName={organization?.name}
        />
        {organizationStatus === 'loading' ? (
          <div
            className="mt-5 h-10 animate-pulse rounded-lg bg-slate-200"
            role="status"
            aria-label="Loading organization navigation"
          />
        ) : (
          navigation
        )}
      </aside>
      <div className="min-w-0">
        <div className="border-b border-slate-200 bg-white px-5 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <OrganizationSwitcher
                organizationId={organizationId}
                organizationName={organization?.name}
                compact
              />
            </div>
            <button
              className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[0.6rem] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
              type="button"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-organization-navigation"
              onClick={() => setIsMenuOpen((current) => !current)}
            >
              <span aria-hidden="true">☰</span>
              Menu
            </button>
          </div>
          {isMenuOpen ? (
            <div id="mobile-organization-navigation">{navigation}</div>
          ) : null}
        </div>
        <div className="min-w-0 px-5 pb-10 sm:px-8 lg:px-8 xl:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
