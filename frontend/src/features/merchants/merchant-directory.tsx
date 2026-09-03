'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import {
  FilterField,
  OperationalPage,
  OperationalPanel,
  OperationalToolbar,
} from '@/components/ui/operational-page';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { useDebouncedValue } from '@/components/ui/use-debounced-value';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { listMerchants } from './merchant-api';
import { MerchantCreateModal } from './merchant-create-modal';
import type {
  Merchant,
  MerchantFilters,
  MerchantStatus,
} from './merchant.types';

const statusLabels: Record<MerchantStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  ENDED: 'Ended',
};

const statusStyles: Record<MerchantStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  SUSPENDED: 'bg-amber-100 text-amber-800',
  ENDED: 'bg-slate-200 text-slate-700',
};

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

export function MerchantDirectory({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const router = useRouter();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
    loadMerchants,
    branches,
    branchesStatus,
    loadBranches,
  } = useOrganizationWorkspaceContext();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filters, setFilters] = useState<MerchantFilters>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MerchantStatus | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const filterInitialized = useRef(false);
  const filterRequestId = useRef(0);

  async function load(selectedFilters: MerchantFilters = filters) {
    setIsLoading(true);
    setLoadError(null);
    try {
      setMerchants(
        await listMerchants(request, organizationId, selectedFilters),
      );
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!organization) return;
    if (organization.role !== 'OWNER' && organization.role !== 'MANAGER') {
      return;
    }
    let active = true;
    void loadMerchants()
      .then((result) => {
        if (active) setMerchants(result);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadMerchants, organization]);

  useEffect(() => {
    if (
      organization &&
      (organization.role === 'OWNER' || organization.role === 'MANAGER') &&
      branchesStatus === 'idle'
    ) {
      void loadBranches().catch(() => undefined);
    }
  }, [branchesStatus, loadBranches, organization]);

  useEffect(() => {
    if (
      !organization ||
      (organization.role !== 'OWNER' && organization.role !== 'MANAGER')
    )
      return;
    if (!filterInitialized.current) {
      filterInitialized.current = true;
      return;
    }
    const nextFilters: MerchantFilters = {
      search: debouncedSearch.trim() || undefined,
      status: status || undefined,
    };
    setFilters(nextFilters);
    setIsFiltering(true);
    setLoadError(null);
    const requestId = ++filterRequestId.current;
    void listMerchants(request, organizationId, nextFilters)
      .then((result) => {
        if (requestId === filterRequestId.current) setMerchants(result);
      })
      .catch((cause: unknown) => {
        if (requestId === filterRequestId.current)
          setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (requestId === filterRequestId.current) setIsFiltering(false);
      });
  }, [debouncedSearch, organization, organizationId, request, status]);

  if (organizationStatus === 'loading') {
    return (
      <p
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-5xl"
        role="status"
      >
        Loading organization…
      </p>
    );
  }

  if (organizationStatus === 'error' || !organization) {
    return (
      <section
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-3xl"
        role="alert"
      >
        <h1 className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]">
          We could not load the organization.
        </h1>
        <p className="mt-4 leading-7 text-slate-500">
          {organizationError ?? 'The organization could not be loaded.'}
        </p>
        <button
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
          type="button"
          onClick={() => void refreshOrganization()}
        >
          Try again
        </button>
      </section>
    );
  }

  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Merchants"
        description="Manage the independent brands operating in this concept store."
      />

      {!canManage ? (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="m-0 text-base font-bold">
            Merchant management is limited
          </h2>
          <p className="mt-3 leading-7 text-slate-500">
            Only organization owners and managers can manage merchants.
          </p>
        </section>
      ) : (
        <OperationalPanel
          title="Merchant directory"
          description={`${merchants.length} matching merchants · Independent brands participating in this store`}
          action={
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700"
              type="button"
              onClick={() => setIsCreateOpen(true)}
            >
              Add merchant
            </button>
          }
        >
          <OperationalToolbar>
            <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.4fr)_auto]">
              <FilterField label="Search" id="merchant-search">
                <input
                  className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
                  id="merchant-search"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    filterRequestId.current += 1;
                    setSearch(event.target.value);
                  }}
                  placeholder="Name, code, or contact"
                  maxLength={120}
                />
              </FilterField>
              <FilterField label="Status" id="merchant-status-filter">
                <SelectControl
                  className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
                  id="merchant-status-filter"
                  value={status}
                  onValueChange={(value) => {
                    filterRequestId.current += 1;
                    setStatus(value as MerchantStatus | '');
                  }}
                >
                  <option value="">All statuses</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectControl>
              </FilterField>
              {isFiltering ? (
                <span
                  className="pb-3 text-sm font-semibold text-slate-500"
                  role="status"
                >
                  Updating…
                </span>
              ) : null}
            </div>
          </OperationalToolbar>

          {loadError ? (
            <RequestError
              className="mt-4 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
              message={loadError}
              onRetry={() => void load()}
            />
          ) : null}

          {isLoading ? (
            <ListSkeleton label="Loading merchants" rowClassName="h-20" />
          ) : merchants.length === 0 ? (
            <div className="py-10 text-center">
              <h3 className="m-0 text-base font-bold">No merchants found</h3>
              <p className="mt-2 leading-7 text-slate-500">
                Adjust the filters or add the first merchant profile.
              </p>
            </div>
          ) : (
            <ul className="list-none px-5 py-1 sm:px-6">
              {merchants.map((merchant) => (
                <li
                  className="flex items-start justify-between gap-4 border-b border-slate-200 py-4 last:border-b-0 max-sm:grid max-sm:items-stretch"
                  key={merchant.id}
                >
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{merchant.name}</strong>
                      {merchant.code ? (
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                          {merchant.code}
                        </span>
                      ) : null}
                    </div>
                    <p className="m-0 text-sm text-slate-600">
                      {merchant.contactName}
                    </p>
                    <small className="text-slate-500">
                      {merchant.email} · {merchant.phone}
                    </small>
                    <small className="text-slate-500">
                      {merchant.branches
                        .map((branch) => branch.name)
                        .join(', ')}
                    </small>
                  </div>
                  <div className="flex items-center gap-4 max-sm:justify-between">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[merchant.status]}`}
                    >
                      {statusLabels[merchant.status]}
                    </span>
                    <Link
                      className="font-bold text-emerald-700 underline underline-offset-3"
                      href={`/app/organizations/${organizationId}/merchants/${merchant.id}`}
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </OperationalPanel>
      )}
      {isCreateOpen ? (
        <MerchantCreateModal
          organizationId={organizationId}
          branches={branches}
          onCancel={() => setIsCreateOpen(false)}
          onCreated={(merchant) => {
            setIsCreateOpen(false);
            router.push(
              `/app/organizations/${organizationId}/merchants/${merchant.id}`,
            );
          }}
        />
      ) : null}
    </OperationalPage>
  );
}
