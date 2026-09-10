'use client';

import { useCallback, useEffect, useState } from 'react';
import { BackLink } from '@/components/ui/back-link';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { useAuth } from '@/features/auth/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { getBranch } from './branch-api';
import { BranchForm } from './branch-management';
import type { Branch } from './branch.types';

function addressFor(branch: Branch): string {
  return [
    branch.addressLine1,
    branch.addressLine2,
    branch.city,
    branch.province,
    branch.postalCode,
    branch.countryCode,
  ]
    .filter(Boolean)
    .join(', ');
}

export function BranchDetail({
  organizationId,
  branchId,
}: {
  organizationId: string;
  branchId: string;
}) {
  const { request } = useAuth();
  const { organization, upsertBranch } = useOrganizationWorkspaceContext();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBranch(await getBranch(request, organizationId, branchId));
    } catch {
      setError('The branch details could not be loaded.');
    }
  }, [branchId, organizationId, request]);

  useEffect(() => {
    let active = true;
    void getBranch(request, organizationId, branchId)
      .then((result) => {
        if (active) setBranch(result);
      })
      .catch(() => {
        if (active) setError('The branch details could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [branchId, organizationId, request]);

  if (!organization) return <ListSkeleton label="Loading branch" />;
  if (!branch) {
    return (
      <section className="mx-auto mt-5 w-full max-w-7xl sm:mt-6">
        <BackLink href={`/app/organizations/${organizationId}/branches`}>
          Back to branches
        </BackLink>
        {error ? (
          <RequestError
            className="mt-6"
            message={error}
            onRetry={() => void load()}
          />
        ) : (
          <ListSkeleton
            className="mt-6"
            label="Loading branch details"
            rows={5}
          />
        )}
      </section>
    );
  }

  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';
  return (
    <section className="mx-auto mt-5 w-full max-w-4xl sm:mt-6">
      <BackLink href={`/app/organizations/${organizationId}/branches`}>
        Back to branches
      </BackLink>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-bold tracking-wider text-emerald-700 uppercase">
            {branch.code ?? 'Branch'}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {branch.name}
          </h1>
          <address className="mt-2 text-sm not-italic text-slate-500">
            {addressFor(branch)}
          </address>
        </div>
        {canManage ? (
          <button
            className="min-h-11 cursor-pointer rounded-lg bg-emerald-600 px-4 font-bold text-white"
            onClick={() => setEditing(true)}
            type="button"
          >
            Edit branch
          </button>
        ) : null}
      </header>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold">Branch information</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold text-slate-500 uppercase">Code</dt>
            <dd className="mt-1 text-slate-900">{branch.code ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-slate-500 uppercase">
              Country
            </dt>
            <dd className="mt-1 text-slate-900">{branch.countryCode}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold text-slate-500 uppercase">
              Address
            </dt>
            <dd className="mt-1 text-slate-900">{addressFor(branch)}</dd>
          </div>
        </dl>
      </section>

      {editing ? (
        <BranchForm
          branch={branch}
          organizationId={organizationId}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            upsertBranch(saved);
            setBranch(saved);
            setEditing(false);
          }}
        />
      ) : null}
    </section>
  );
}
