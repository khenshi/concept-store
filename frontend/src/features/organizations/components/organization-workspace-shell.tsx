'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button, buttonStyles } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { OrganizationNavigation } from './organization-navigation';
import { OrganizationSwitcher } from './organization-switcher';
import { MobileOrganizationDrawer } from './mobile-organization-drawer';
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
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'MERCHANT';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerId = useId();
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        setIsSidebarCollapsed(
          window.localStorage.getItem('kapwesto.sidebar.collapsed') === 'true',
        );
      } catch {
        // Storage may be unavailable; navigation still works without persistence.
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function toggleSidebar() {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      window.localStorage.setItem('kapwesto.sidebar.collapsed', String(next));
    } catch {
      // Keep the in-session preference when browser storage is unavailable.
    }
  }

  const navigation = (collapsed = false) =>
    organization ? (
      <OrganizationNavigation
        organizationId={organizationId}
        showMembers={organization.role === 'OWNER'}
        showMerchants={canManage}
        showProducts={canManage}
        collapsed={collapsed}
        onNavigate={closeMenu}
      />
    ) : organizationStatus === 'loading' ? (
      <div
        className="mt-5 h-11 animate-pulse rounded-control bg-selected"
        role="status"
        aria-label="Loading organization navigation"
      />
    ) : null;

  return (
    <div
      className={`w-full print:block lg:grid ${isSidebarCollapsed ? 'lg:grid-cols-[4.5rem_minmax(0,1fr)]' : 'lg:grid-cols-[15.5rem_minmax(0,1fr)]'}`}
    >
      <aside
        className={`hidden min-w-0 border-r border-hairline bg-surface print:hidden lg:sticky lg:top-17 lg:flex lg:h-[calc(100dvh-4.25rem)] lg:flex-col lg:self-start ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}
        aria-label="Workspace sidebar"
      >
        <div className="shrink-0 pt-5">
          <OrganizationSwitcher
            organizationId={organizationId}
            organizationName={organization?.name}
            collapsed={isSidebarCollapsed}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-5">
          {navigation(isSidebarCollapsed)}
        </div>
        <div className="grid shrink-0 gap-2 border-t border-hairline py-3">
          <Link
            href="/app"
            className={buttonStyles({
              variant: 'quiet',
              className: isSidebarCollapsed ? 'px-2' : 'justify-start px-3',
            })}
            title={isSidebarCollapsed ? 'All organizations' : undefined}
          >
            <Icon name="building" />
            <span className={isSidebarCollapsed ? 'sr-only' : ''}>
              All organizations
            </span>
          </Link>
          <Button
            variant="quiet"
            aria-label={
              isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
            }
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleSidebar}
            className={
              isSidebarCollapsed
                ? 'w-full px-2'
                : 'justify-start px-3 text-muted'
            }
          >
            <Icon name={isSidebarCollapsed ? 'expand' : 'collapse'} />
            <span className={isSidebarCollapsed ? 'sr-only' : ''}>
              Collapse sidebar
            </span>
          </Button>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center gap-3 border-b border-hairline bg-surface px-4 py-3 print:hidden sm:px-6 lg:hidden">
          <div className="min-w-0 flex-1">
            <OrganizationSwitcher
              organizationId={organizationId}
              organizationName={organization?.name}
              compact
            />
          </div>
          <Button
            ref={menuTriggerRef}
            variant="secondary"
            aria-expanded={isMenuOpen}
            aria-controls={drawerId}
            aria-haspopup="dialog"
            onClick={() => setIsMenuOpen(true)}
            className="shrink-0 px-3"
          >
            <Icon name="menu" className="size-4" />
            Menu
          </Button>
        </div>
        {isMenuOpen ? (
          <MobileOrganizationDrawer
            id={drawerId}
            organizationName={organization?.name}
            onClose={closeMenu}
            triggerRef={menuTriggerRef}
          >
            {navigation()}
            <Link
              href="/app"
              onClick={closeMenu}
              className={buttonStyles({
                variant: 'quiet',
                className: 'mt-6 w-full justify-start',
              })}
            >
              <Icon name="building" />
              All organizations
            </Link>
          </MobileOrganizationDrawer>
        ) : null}
        <div className="mx-auto min-w-0 max-w-[90rem] px-4 pb-10 print:p-0 sm:px-6 lg:px-8 xl:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
