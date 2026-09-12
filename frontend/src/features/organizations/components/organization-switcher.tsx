'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/model/auth-context';
import { listOrganizations } from '../api/organization-api';
import type { OrganizationAccess } from '../model/organization.types';
import { Icon } from '@/shared/components/ui/icon';

const roleLabels = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
} as const;

export function OrganizationSwitcher({
  organizationId,
  organizationName,
  compact = false,
  collapsed = false,
}: {
  organizationId: string;
  organizationName?: string;
  compact?: boolean;
  collapsed?: boolean;
}) {
  const router = useRouter();
  const { request } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const currentOrganization = organizations.find(
    (organization) => organization.id === organizationId,
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      setOrganizations(await listOrganizations(request));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let active = true;
    void listOrganizations(request)
      .then((result) => {
        if (active) setOrganizations(result);
      })
      .catch(() => {
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    if (!isOpen) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
    };
  }, [isOpen]);

  function navigate(href: string) {
    setIsOpen(false);
    triggerRef.current?.focus();
    router.push(href);
  }

  return (
    <div
      className="relative grid gap-2"
      ref={containerRef}
      onKeyDown={(event) => {
        if (isOpen && event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      {!compact && !collapsed ? (
        <span className="px-1 text-xs font-medium text-muted">
          Organization
        </span>
      ) : null}
      <button
        ref={triggerRef}
        className={`flex min-h-11 w-full min-w-0 items-center gap-3 rounded-control border border-control-border bg-surface py-2 text-left text-sm font-semibold text-ink hover:bg-subtle ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}`}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={`Switch organization: ${currentOrganization?.name ?? organizationName ?? 'Current organization'}`}
        title={
          collapsed
            ? (currentOrganization?.name ??
              organizationName ??
              'Switch organization')
            : undefined
        }
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        {collapsed ? <Icon name="building" /> : null}
        <span className={collapsed ? 'sr-only' : 'min-w-0 truncate'}>
          {currentOrganization?.name ??
            organizationName ??
            'Current organization'}
        </span>
        {!collapsed ? (
          <Icon
            name="chevron"
            className={`size-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        ) : null}
      </button>
      {isOpen ? (
        <div
          ref={menuRef}
          className={`absolute top-full left-0 z-50 mt-2 max-h-[min(26rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain rounded-control border border-hairline bg-surface p-1.5 shadow-floating ${collapsed ? 'w-64' : 'right-0'}`}
          id={menuId}
          role="menu"
          aria-label="Switch organization"
          onKeyDown={(event) => {
            const items = Array.from(
              menuRef.current?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]',
              ) ?? [],
            );
            const index = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (!items.length) return;
            let next = index;
            if (event.key === 'ArrowDown') next = (index + 1) % items.length;
            else if (event.key === 'ArrowUp')
              next = (index - 1 + items.length) % items.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = items.length - 1;
            else if (event.key === 'Tab') {
              setIsOpen(false);
              triggerRef.current?.focus();
              return;
            } else return;
            event.preventDefault();
            items[next]?.focus();
          }}
        >
          <div className="max-h-72 overflow-y-auto">
            {organizations.map((organization) => {
              const isCurrent = organization.id === organizationId;
              return (
                <button
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-compact border-0 px-3 py-2.5 text-left text-ink hover:bg-subtle focus-visible:outline-offset-[-2px] ${isCurrent ? 'bg-selected' : 'bg-surface'}`}
                  key={organization.id}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() =>
                    navigate(`/app/organizations/${organization.id}`)
                  }
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-semibold">
                      {organization.name}
                    </strong>
                    <span className="mt-0.5 block text-xs text-muted">
                      {roleLabels[organization.role]}
                    </span>
                  </span>
                  {isCurrent ? <Icon name="check" className="size-4" /> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-hairline pt-1">
            <button
              className="flex min-h-11 w-full items-center justify-between rounded-compact border-0 bg-surface px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-subtle focus-visible:outline-offset-[-2px]"
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => navigate('/app')}
            >
              All organizations
              <Icon name="arrow" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
      {isLoading ? (
        <span
          className={`text-xs text-muted ${compact || collapsed ? 'sr-only' : ''}`}
          role="status"
        >
          Loading organizations…
        </span>
      ) : hasError ? (
        <button
          className={`min-h-11 border-0 bg-transparent text-xs font-semibold text-ink underline underline-offset-3 ${collapsed ? 'w-full text-center' : 'w-fit text-left'}`}
          type="button"
          onClick={() => void load()}
        >
          {collapsed ? 'Retry' : 'Retry organization list'}
        </button>
      ) : null}
    </div>
  );
}
