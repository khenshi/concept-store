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
      <p className="workspace-state" role="status">
        Loading merchants…
      </p>
    );
  }

  if (loadError && !organization) {
    return (
      <section className="workspace-state" role="alert">
        <h1>We could not load the merchant directory.</h1>
        <p>{loadError}</p>
        <button
          className="text-button"
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
    <section className="merchant-workspace" aria-labelledby="merchant-title">
      <div className="workspace-heading">
        <div>
          <p className="workspace-context">{organization.name}</p>
          <h1 id="merchant-title">Merchants</h1>
          <p>Manage the independent brands operating in this concept store.</p>
        </div>
        <span className="role-badge">{organization.role.toLowerCase()}</span>
      </div>
      <OrganizationNavigation
        organizationId={organizationId}
        active="merchants"
        showMembers={canManage}
        showMerchants={canManage}
      />

      {!canManage ? (
        <section className="merchant-panel permission-panel">
          <h2>Merchant management is limited</h2>
          <p>Only organization owners and managers can manage merchants.</p>
        </section>
      ) : (
        <section className="merchant-panel merchant-directory-panel">
          <div className="merchant-directory-heading">
            <div>
              <h2>Merchant directory</h2>
              <p>{merchants.length} matching merchants</p>
            </div>
            <Link
              className="primary-link"
              href={`/app/organizations/${organizationId}/merchants/new`}
            >
              Add merchant
            </Link>
          </div>

          <form className="merchant-filters" onSubmit={handleFilter}>
            <div className="field">
              <label htmlFor="merchant-search">Search</label>
              <input
                id="merchant-search"
                name="search"
                type="search"
                defaultValue={filters.search}
                placeholder="Name, code, or contact"
                maxLength={120}
              />
            </div>
            <div className="field">
              <label htmlFor="merchant-status-filter">Status</label>
              <select
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
              className="secondary-button"
              type="submit"
              disabled={isFiltering}
            >
              {isFiltering ? 'Applying…' : 'Apply filters'}
            </button>
          </form>

          {loadError ? (
            <p className="form-alert merchant-filter-error" role="alert">
              {loadError}
            </p>
          ) : null}

          {merchants.length === 0 ? (
            <div className="merchant-empty">
              <h3>No merchants found</h3>
              <p>Adjust the filters or add the first merchant profile.</p>
            </div>
          ) : (
            <ul className="merchant-list">
              {merchants.map((merchant) => (
                <li key={merchant.id}>
                  <div className="merchant-summary">
                    <div className="merchant-name-line">
                      <strong>{merchant.name}</strong>
                      {merchant.code ? <span>{merchant.code}</span> : null}
                    </div>
                    <p>{merchant.contactName}</p>
                    <small>
                      {merchant.email} · {merchant.phone}
                    </small>
                  </div>
                  <div className="merchant-list-actions">
                    <span
                      className={`status-badge status-${merchant.status.toLowerCase()}`}
                    >
                      {statusLabels[merchant.status]}
                    </span>
                    <Link
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
