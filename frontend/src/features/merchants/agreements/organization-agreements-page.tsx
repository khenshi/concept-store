'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
} from '@/components/ui/operational-page';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { listOrganizationAgreements } from './merchant-agreement-api';
import type {
  AgreementStatus,
  MerchantAgreement,
} from './merchant-agreement.types';

const statuses: AgreementStatus[] = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'ACTIVE',
  'ENDED',
  'SUSPENDED',
];

const statusLabels: Record<AgreementStatus, string> = {
  DRAFT: 'Drafts',
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  ENDED: 'Ended',
  SUSPENDED: 'Suspended',
};

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The agreements could not be loaded.';
}

export function OrganizationAgreementsPage({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const [agreements, setAgreements] = useState<MerchantAgreement[]>([]);
  const [status, setStatus] = useState<AgreementStatus>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setAgreements(await listOrganizationAgreements(request, organizationId));
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, request]);

  useEffect(() => {
    let active = true;
    void listOrganizationAgreements(request, organizationId)
      .then((result) => {
        if (active) setAgreements(result);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const refreshWhenVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load, organizationId, request]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        statuses.map((item) => [
          item,
          agreements.filter((agreement) => agreement.status === item).length,
        ]),
      ) as Record<AgreementStatus, number>,
    [agreements],
  );
  const visibleAgreements = agreements.filter(
    (agreement) => agreement.status === status,
  );

  if (organizationStatus === 'loading' || !organization) {
    return (
      <ListSkeleton className="mt-8" label="Loading agreements" rows={5} />
    );
  }

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Agreements"
        description="Review merchant terms, space occupancy, and agreement status."
      />

      {organization.role === 'OWNER' && counts.PENDING > 0 ? (
        <button
          className="mt-5 w-full rounded-xl border border-amber-300 bg-amber-50 p-4 text-left font-bold text-amber-900"
          onClick={() => setStatus('PENDING')}
          type="button"
        >
          {counts.PENDING} agreement{counts.PENDING === 1 ? '' : 's'} need your
          review
        </button>
      ) : null}

      <OperationalPanel
        title="Agreement register"
        description="Pending agreements reserve spaces; drafts only check availability."
        action={
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-[0.65rem] bg-emerald-600 px-4.5 py-3 font-bold text-white no-underline hover:bg-emerald-700"
            href={`/app/organizations/${organizationId}/agreements/new`}
          >
            New draft
          </Link>
        }
      >
        <div
          className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2 sm:px-6"
          role="tablist"
          aria-label="Agreement status"
        >
          {statuses.map((item) => (
            <button
              className={`whitespace-nowrap border-0 border-b-2 bg-transparent px-3 py-3 font-bold ${status === item ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              key={item}
              onClick={() => setStatus(item)}
              role="tab"
              aria-selected={status === item}
            >
              {statusLabels[item]}{' '}
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                {counts[item]}
              </span>
            </button>
          ))}
        </div>

        {loadError ? (
          <RequestError
            className="m-5 sm:m-6"
            message={loadError}
            onRetry={() => void load()}
          />
        ) : isLoading ? (
          <ListSkeleton className="m-5 sm:m-6" label="Loading agreements" />
        ) : visibleAgreements.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-semibold text-slate-700">
              No {statusLabels[status].toLowerCase()}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Agreements in this stage will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[56rem]">
              <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_6rem] gap-5 border-b border-slate-200 bg-slate-50/70 px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                <span>Merchant</span>
                <span>Period</span>
                <span>Locations</span>
                <span>Commercial terms</span>
                <span className="text-center">Action</span>
              </div>
              <div className="divide-y divide-slate-200">
                {visibleAgreements.map((agreement) => (
                  <AgreementRow
                    key={agreement.id}
                    agreement={agreement}
                    organizationId={organizationId}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </OperationalPanel>
    </OperationalPage>
  );
}

function AgreementRow({
  agreement,
  organizationId,
}: {
  agreement: MerchantAgreement;
  organizationId: string;
}) {
  const branchCount = new Set(
    agreement.spaceReservations.map((item) => item.space.branchId),
  ).size;

  return (
    <article className="grid grid-cols-[1.3fr_1fr_1fr_1fr_6rem] items-center gap-5 px-6 py-5">
      <div className="min-w-0 text-sm text-slate-800">
        <strong className="text-slate-950">
          {agreement.merchant?.name ?? agreement.merchantId}
        </strong>
        {agreement.merchant?.code ? (
          <span className="mt-0.5 block text-xs text-slate-500">
            {agreement.merchant.code}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 text-sm text-slate-800">
        {displayDate(agreement.activationAt)}
        <span className="mt-0.5 block text-xs text-slate-500">
          {agreement.durationMonths} month
          {agreement.durationMonths === 1 ? '' : 's'}
        </span>
      </div>

      <div className="min-w-0 text-sm text-slate-800">
        {agreement.spaceReservations.length} space
        {agreement.spaceReservations.length === 1 ? '' : 's'}
        <span className="mt-0.5 block text-xs text-slate-500">
          {branchCount} branch{branchCount === 1 ? '' : 'es'}
        </span>
      </div>

      <div className="min-w-0 text-sm text-slate-800">
        {agreement.fixedRentAmount
          ? `${money.format(Number(agreement.fixedRentAmount))} rent`
          : 'No fixed rent'}
        <span className="mt-0.5 block text-xs text-slate-500">
          {agreement.commissionRate
            ? `${agreement.commissionRate}% commission`
            : 'No commission'}
        </span>
      </div>

      <Link
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 font-bold text-slate-800 no-underline hover:border-emerald-600 hover:text-emerald-700"
        href={`/app/organizations/${organizationId}/agreements/${agreement.id}`}
      >
        View
      </Link>
    </article>
  );
}
