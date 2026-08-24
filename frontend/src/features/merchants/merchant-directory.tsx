'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { getOrganization } from '@/features/organizations/organization-api';
import { OrganizationNavigation } from '@/features/organizations/organization-navigation';
import type { OrganizationAccess } from '@/features/organizations/organization.types';
import { listMerchants } from './merchant-api';
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
  const [organization, setOrganization] = useState<OrganizationAccess | null>(
    null,
  );
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filters, setFilters] = useState<MerchantFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const organizationResult = await getOrganization(request, organizationId);
      setOrganization(organizationResult);
      if (
        organizationResult.role === 'OWNER' ||
        organizationResult.role === 'MANAGER'
      ) {
        setMerchants(await listMerchants(request, organizationId, filters));
      }
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [filters, organizationId, request]);

  useEffect(() => {
    let active = true;
    void getOrganization(request, organizationId)
      .then(async (organizationResult) => {
        if (!active) return;
        setOrganization(organizationResult);
        if (
          organizationResult.role === 'OWNER' ||
          organizationResult.role === 'MANAGER'
        ) {
          const result = await listMerchants(request, organizationId);
          if (active) setMerchants(result);
        }
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
  }, [organizationId, request]);

  async function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchValue = String(formData.get('search') ?? '').trim();
    const statusValue = String(formData.get('status') ?? '') as
      MerchantStatus | '';
    const nextFilters: MerchantFilters = {
      search: searchValue || undefined,
      status: statusValue || undefined,
    };
    setFilters(nextFilters);
    setIsFiltering(true);
    setLoadError(null);
    try {
      setMerchants(await listMerchants(request, organizationId, nextFilters));
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsFiltering(false);
    }
  }

  if (isLoading) {
    return (
      <p
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-5xl"
        role="status"
      >
        Loading merchants…
      </p>
    );
  }

  if (loadError && !organization) {
    return (
      <section
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-3xl"
        role="alert"
      >
        <h1 className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]">
          We could not load the merchant directory.
        </h1>
        <p className="mt-4 leading-7 text-slate-500">{loadError}</p>
        <button
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
          type="button"
          onClick={() => void load()}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!organization) return null;
  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';

  return (
    <section
      className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-5xl"
      aria-labelledby="merchant-title"
    >
      <div className="flex items-start justify-between gap-6 max-sm:grid">
        <div>
          <p className="mb-2 text-sm font-bold text-emerald-700">
            {organization.name}
          </p>
          <h1
            className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]"
            id="merchant-title"
          >
            Merchants
          </h1>
          <p className="mt-4 leading-7 text-slate-500">
            Manage the independent brands operating in this concept store.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 capitalize">
          {organization.role.toLowerCase()}
        </span>
      </div>
      <OrganizationNavigation
        organizationId={organizationId}
        active="merchants"
        showMembers={canManage}
        showMerchants={canManage}
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
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4 max-sm:grid">
            <div>
              <h2 className="m-0 text-base font-bold">Merchant directory</h2>
              <p className="mt-2 text-sm text-slate-500">
                {merchants.length} matching merchants
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-[0.65rem] bg-emerald-600 px-4.5 py-3 font-bold text-white no-underline hover:bg-emerald-700"
              href={`/app/organizations/${organizationId}/merchants/new`}
            >
              Add merchant
            </Link>
          </div>

          <form
            className="mt-6 grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.4fr)_auto]"
            onSubmit={handleFilter}
          >
            <div className="grid gap-2">
              <label className="text-sm font-bold" htmlFor="merchant-search">
                Search
              </label>
              <input
                className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
                id="merchant-search"
                name="search"
                type="search"
                defaultValue={filters.search}
                placeholder="Name, code, or contact"
                maxLength={120}
              />
            </div>
            <div className="grid gap-2">
              <label
                className="text-sm font-bold"
                htmlFor="merchant-status-filter"
              >
                Status
              </label>
              <select
                className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
                id="merchant-status-filter"
                name="status"
                defaultValue={filters.status ?? ''}
              >
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="min-h-12 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-3.5 py-2.5 font-bold disabled:cursor-wait disabled:opacity-65"
              type="submit"
              disabled={isFiltering}
            >
              {isFiltering ? 'Applying…' : 'Apply filters'}
            </button>
          </form>

          {loadError ? (
            <p
              className="mt-4 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
              role="alert"
            >
              {loadError}
            </p>
          ) : null}

          {merchants.length === 0 ? (
            <div className="py-10 text-center">
              <h3 className="m-0 text-base font-bold">No merchants found</h3>
              <p className="mt-2 leading-7 text-slate-500">
                Adjust the filters or add the first merchant profile.
              </p>
            </div>
          ) : (
            <ul className="mt-5 list-none p-0">
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
        </section>
      )}
    </section>
  );
}
