'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { listOrganizations } from './organization-api';
import type { OrganizationAccess } from './organization.types';

const roleLabels = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
} as const;

export function OrganizationSwitcher({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName?: string;
}) {
  const router = useRouter();
  const { request } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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
    function closeOnOutsideClick(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  function navigate(href: string) {
    setIsOpen(false);
    router.push(href);
  }

  return (
    <div className="relative grid gap-2" ref={containerRef}>
      <span className="text-xs font-bold tracking-[0.08em] text-slate-500 uppercase">
        Organization
      </span>
      <button
        className="flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:border-emerald-600"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls="organization-switcher-menu"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">
          {currentOrganization?.name ??
            organizationName ??
            'Current organization'}
        </span>
        <span
          className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>
      {isOpen ? (
        <div
          className="absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 lg:min-w-64"
          id="organization-switcher-menu"
          role="menu"
          aria-label="Switch organization"
        >
          <div className="max-h-72 overflow-y-auto">
            {organizations.map((organization) => {
              const isCurrent = organization.id === organizationId;
              return (
                <button
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-[0.55rem] border-0 px-3 py-2.5 text-left hover:bg-slate-50 ${isCurrent ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-slate-900'}`}
                  key={organization.id}
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    navigate(`/app/organizations/${organization.id}`)
                  }
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">
                      {organization.name}
                    </strong>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {roleLabels[organization.role]}
                    </span>
                  </span>
                  {isCurrent ? (
                    <span className="text-xs font-bold" aria-hidden="true">
                      Current
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-slate-200 pt-1">
            <button
              className="flex w-full cursor-pointer items-center justify-between rounded-[0.55rem] border-0 bg-white px-3 py-2.5 text-left text-sm font-bold text-emerald-700 hover:bg-slate-50"
              type="button"
              role="menuitem"
              onClick={() => navigate('/app')}
            >
              All organizations
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : null}
      {isLoading ? (
        <span className="text-xs text-slate-500" role="status">
          Loading organizations…
        </span>
      ) : hasError ? (
        <button
          className="w-fit cursor-pointer border-0 bg-transparent p-0 text-xs font-bold text-emerald-700 underline underline-offset-3"
          type="button"
          onClick={() => void load()}
        >
          Retry organization list
        </button>
      ) : null}
    </div>
  );
}
