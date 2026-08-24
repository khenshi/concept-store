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
      <section className="workspace-state" role="alert">
        <p className="eyebrow">Organization unavailable</p>
        <h1>We could not open this workspace.</h1>
        <p>{error}</p>
        <Link className="text-link" href="/app">
          Choose another organization
        </Link>
      </section>
    );
  }

  if (!organization) {
    return (
      <p className="workspace-state" role="status">
        Loading organization…
      </p>
    );
  }

  return (
    <section className="workspace-state" aria-labelledby="workspace-title">
      <Link className="back-link" href="/app">
        ← All organizations
      </Link>
      <div className="workspace-heading workspace-heading-overview">
        <div>
          <p className="workspace-context">
            {roleLabels[organization.role]} workspace
          </p>
          <h1 id="workspace-title">{organization.name}</h1>
        </div>
        <span className="role-badge">{organization.role.toLowerCase()}</span>
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
      <p>
        Organization access is confirmed. Continue to branches to manage this
        concept store&apos;s physical locations.
      </p>
      <Link
        className="primary-link"
        href={`/app/organizations/${organizationId}/branches`}
      >
        View branches
      </Link>
      {organization.role === 'OWNER' || organization.role === 'MANAGER' ? (
        <>
          <Link
            className="secondary-link"
            href={`/app/organizations/${organizationId}/merchants`}
          >
            View merchants
          </Link>
          <Link
            className="secondary-link"
            href={`/app/organizations/${organizationId}/members`}
          >
            View members
          </Link>
        </>
      ) : null}
    </section>
  );
}
