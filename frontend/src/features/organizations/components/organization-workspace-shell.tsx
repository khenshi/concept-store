'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsSidebarCollapsed(
        window.localStorage.getItem('kapwesto.sidebar.collapsed') === 'true',
      );
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const navigation = (collapsed = false) =>
    organization ? (
      <OrganizationNavigation
        organizationId={organizationId}
        showMembers={canManage}
        showMerchants={canManage}
        collapsed={collapsed}
        onNavigate={() => setIsMenuOpen(false)}
      />
    ) : null;

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('kapwesto.sidebar.collapsed', String(next));
      return next;
    });
  }

  return (
    <div
      className={`w-full print:block lg:grid ${isSidebarCollapsed ? 'lg:grid-cols-[4.5rem_minmax(0,1fr)]' : 'lg:grid-cols-[15.5rem_minmax(0,1fr)]'}`}
    >
      <aside
        className={`hidden min-w-0 border-r border-slate-200 bg-white print:hidden lg:sticky lg:top-17 lg:flex lg:h-[calc(100vh-4.25rem)] lg:flex-col lg:self-start lg:overflow-hidden ${isSidebarCollapsed ? 'px-3' : 'px-5'}`}
      >
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pt-6 pb-4 ${isSidebarCollapsed ? '' : 'pr-1'}`}
        >
          {isSidebarCollapsed ? null : (
            <OrganizationSwitcher
              organizationId={organizationId}
              organizationName={organization?.name}
            />
          )}
          {organizationStatus === 'loading' ? (
            <div
              className="mt-5 h-10 animate-pulse rounded-lg bg-slate-200"
              role="status"
              aria-label="Loading organization navigation"
            />
          ) : (
            navigation(isSidebarCollapsed)
          )}
        </div>
        <div className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-white py-4">
          <button
            aria-label={
              isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
            className="grid min-h-10 w-full cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            <span aria-hidden="true">{isSidebarCollapsed ? '›' : '‹'}</span>
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="border-b border-slate-200 bg-white px-5 py-3 print:hidden lg:hidden">
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
            <div id="mobile-organization-navigation">{navigation()}</div>
          ) : null}
        </div>
        <div className="min-w-0 px-5 pb-10 print:p-0 sm:px-8 lg:px-8 xl:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
