'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Icon } from '@/shared/components/ui/icon';
import { RequestError } from '@/shared/components/ui/request-error';
import { TextField } from '@/shared/components/ui/text-field';
import { listOrganizations } from '../api/organization-api';
import type { OrganizationAccess } from '../model/organization.types';

const roleLabels = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
} as const;

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function organizationInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words.length === 1
    ? words[0].slice(0, 1).toUpperCase()
    : `${words[0][0]}${words.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function OrganizationGridSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading organizations"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="min-h-40 animate-pulse card-surface p-4"
          key={index}
          aria-hidden="true"
        >
          <div className="size-8 rounded-control bg-selected" />
          <div className="mt-6 h-4 w-3/4 rounded bg-selected" />
          <div className="mt-3 h-3 w-1/2 rounded bg-selected" />
          <div className="mt-7 h-3 w-2/5 rounded bg-selected" />
        </div>
      ))}
    </div>
  );
}

export function OrganizationEntry() {
  const { request } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const filteredOrganizations = organizations.filter((organization) =>
    organization.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setOrganizations(await listOrganizations(request));
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
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
      .catch((cause: unknown) => {
        if (active) setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request]);

  return (
    <section
      className="min-h-[calc(100dvh-4.25rem)] bg-surface"
      aria-labelledby="organization-title"
    >
      <div className="mx-auto w-full max-w-[68rem] px-5 py-10 sm:px-8 lg:py-14">
        <header className="flex items-end justify-between gap-8 max-sm:flex-col max-sm:items-start">
          <div className="min-w-0">
            <h1
              id="organization-title"
              className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.045em] text-ink"
            >
              Your organizations
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
              Switch between the teams and workspaces you belong to. New
              organizations are provisioned by the platform operator.
            </p>
          </div>
        </header>

        <div className="mt-10 flex items-center justify-between gap-5 max-sm:items-stretch max-sm:flex-col">
          <TextField
            containerClassName="w-full max-w-sm"
            id="organization-search"
            label="Search organizations"
            type="search"
            value={search}
            placeholder="Find an organization by name"
            onChange={(event) => setSearch(event.target.value)}
          />
          {!isLoading && !loadError ? (
            <span
              className="shrink-0 text-xs text-muted sm:pb-1"
              aria-label={`${filteredOrganizations.length} organizations`}
            >
              {filteredOrganizations.length}{' '}
              {filteredOrganizations.length === 1
                ? 'organization'
                : 'organizations'}
            </span>
          ) : null}
        </div>

        <div className="mt-7">
          {isLoading ? (
            <OrganizationGridSkeleton />
          ) : loadError ? (
            <RequestError
              className="max-w-xl py-8"
              message={loadError}
              onRetry={() => void loadOrganizations()}
            />
          ) : organizations.length === 0 ? (
            <EmptyState
              className="my-6"
              title="No organizations yet"
              description="You do not belong to an organization yet. Ask the platform operator to provision your workspace or invite you to an existing one."
            />
          ) : filteredOrganizations.length === 0 ? (
            <EmptyState
              className="my-6"
              title="No organizations found"
              description="Try a different organization name."
            />
          ) : (
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOrganizations.map((organization) => (
                <li key={organization.id} className="min-w-0">
                  <Link
                    className="group flex min-h-40 w-full flex-col card-surface p-4 text-ink no-underline transition-colors duration-150 hover:bg-subtle"
                    href={`/app/organizations/${organization.id}`}
                  >
                    <span className="flex items-start justify-between gap-4">
                      <span className="grid size-8 place-items-center rounded-control bg-accent-soft text-sm font-semibold text-accent">
                        {organizationInitials(organization.name)}
                      </span>
                      <Icon
                        name="arrow"
                        className="mt-1 size-4 text-muted group-hover:text-accent"
                      />
                    </span>
                    <span className="mt-6 min-w-0">
                      <strong className="block break-words text-base font-semibold">
                        {organization.name}
                      </strong>
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="rounded-full bg-accent-soft px-2 py-1 font-medium text-accent">
                          {roleLabels[organization.role]}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
