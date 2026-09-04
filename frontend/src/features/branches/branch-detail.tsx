'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BackLink } from '@/components/ui/back-link';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { useAuth } from '@/features/auth/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { getBranchOverview } from './branch-api';
import { BranchForm } from './branch-management';
import type { Branch, BranchOverview } from './branch.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

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
  const [overview, setOverview] = useState<BranchOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await getBranchOverview(request, organizationId, branchId));
    } catch {
      setError('The branch details could not be loaded.');
    }
  }, [branchId, organizationId, request]);

  useEffect(() => {
    let active = true;
    void getBranchOverview(request, organizationId, branchId)
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch(() => {
        if (active) setError('The branch details could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [branchId, organizationId, request]);

  if (!organization) return <ListSkeleton label="Loading branch" />;
  if (!overview)
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

  const { branch, statistics } = overview;
  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';
  const base = `/app/organizations/${organizationId}`;
  const metrics = [
    ['Sales today', String(statistics.todaySaleCount)],
    ['Gross today', money.format(Number(statistics.todayGrossSales))],
    ['Inventory units', String(statistics.inventoryUnits)],
    ['Out of stock', String(statistics.outOfStockProducts)],
    [
      'Occupied spaces',
      `${statistics.occupiedSpaces} / ${statistics.totalSpaces}`,
    ],
    ['Vacant spaces', String(statistics.vacantSpaces)],
    ['Active merchants', String(statistics.activeMerchants)],
  ];

  return (
    <section className="mx-auto mt-5 w-full max-w-7xl sm:mt-6">
      <BackLink href={`${base}/branches`}>Back to branches</BackLink>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
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
            className="min-h-11 rounded-lg bg-emerald-600 px-4 font-bold text-white"
            onClick={() => setEditing(true)}
            type="button"
          >
            Edit branch
          </button>
        ) : null}
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div
            className="rounded-xl border border-slate-200 bg-white p-5"
            key={label}
          >
            <p className="text-xs font-bold uppercase text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-bold">Branch workspace</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <WorkspaceLink
            href={`${base}/spaces?branchId=${branch.id}`}
            label="Spaces and assignments"
          />
          <WorkspaceLink
            href={`${base}/inventory?branchId=${branch.id}`}
            label="Branch inventory"
          />
          <WorkspaceLink
            href={`${base}/pos/sales?branchId=${branch.id}`}
            label="Sales history"
          />
        </div>
      </section>

      {editing ? (
        <BranchForm
          branch={branch}
          organizationId={organizationId}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            upsertBranch(saved);
            setOverview((current) => current && { ...current, branch: saved });
            setEditing(false);
          }}
        />
      ) : null}
    </section>
  );
}

function WorkspaceLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="flex min-h-12 items-center justify-between rounded-lg border border-slate-200 px-4 font-bold text-slate-800 no-underline hover:bg-slate-50"
      href={href}
    >
      {label}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
