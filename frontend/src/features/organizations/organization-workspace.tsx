'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { getOrganization } from './organization-api';
import { OrganizationNavigation } from './organization-navigation';
import type { OrganizationAccess } from './organization.types';

const roleLabels = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
} as const;

export function OrganizationWorkspace({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const [organization, setOrganization] = useState<OrganizationAccess | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getOrganization(request, organizationId)
      .then((result) => {
        if (active) setOrganization(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'The organization could not be loaded.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [organizationId, request]);

  if (error) {
    return (
      <section
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-3xl"
        role="alert"
      >
        <p className="mt-10 mb-4 text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
          Organization unavailable
        </p>
        <h1 className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]">
          We could not open this workspace.
        </h1>
        <p className="mt-4 leading-7 text-slate-500">{error}</p>
        <Link
          className="font-bold text-emerald-700 underline underline-offset-3"
          href="/app"
        >
          Choose another organization
        </Link>
      </section>
    );
  }

  if (!organization) {
    return (
      <p
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-3xl"
        role="status"
      >
        Loading organization…
      </p>
    );
  }

  return (
    <section
      className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-3xl"
      aria-labelledby="workspace-title"
    >
      <Link
        className="p-0 font-bold text-emerald-700 underline underline-offset-3"
        href="/app"
      >
        ← All organizations
      </Link>
      <div className="mt-10 flex items-start justify-between gap-6 max-sm:grid">
        <div>
          <p className="mb-2 text-sm font-bold text-emerald-700">
            {roleLabels[organization.role]} workspace
          </p>
          <h1
            className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]"
            id="workspace-title"
          >
            {organization.name}
          </h1>
        </div>
        <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 capitalize">
          {organization.role.toLowerCase()}
        </span>
      </div>
      <OrganizationNavigation
        organizationId={organizationId}
        active="overview"
        showMembers={
          organization.role === 'OWNER' || organization.role === 'MANAGER'
        }
        showMerchants={
          organization.role === 'OWNER' || organization.role === 'MANAGER'
        }
      />
      <p className="mt-6 leading-7 text-slate-500">
        Organization access is confirmed. Continue to branches to manage this
        concept store&apos;s physical locations.
      </p>
      <Link
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[0.65rem] bg-emerald-600 px-4.5 py-3 font-bold text-white no-underline hover:bg-emerald-700"
        href={`/app/organizations/${organizationId}/branches`}
      >
        View branches
      </Link>
      {organization.role === 'OWNER' || organization.role === 'MANAGER' ? (
        <>
          <Link
            className="mt-4 ml-3 inline-flex font-bold text-emerald-700 underline underline-offset-3 max-sm:ml-0"
            href={`/app/organizations/${organizationId}/merchants`}
          >
            View merchants
          </Link>
          <Link
            className="mt-4 ml-3 inline-flex font-bold text-emerald-700 underline underline-offset-3 max-sm:ml-0"
            href={`/app/organizations/${organizationId}/members`}
          >
            View members
          </Link>
        </>
      ) : null}
    </section>
  );
}
