'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { listMerchantAgreements } from './merchant-agreement-api';
import type { MerchantAgreement } from './merchant-agreement.types';

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The agreement summary could not be loaded.';
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

export function MerchantAgreementSummary({
  organizationId,
  merchantId,
  merchantName,
}: {
  organizationId: string;
  merchantId: string;
  merchantName: string;
}) {
  const { request } = useAuth();
  const [agreements, setAgreements] = useState<MerchantAgreement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setAgreements(
        await listMerchantAgreements(request, organizationId, merchantId),
      );
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [merchantId, organizationId, request]);

  useEffect(() => {
    let active = true;
    void listMerchantAgreements(request, organizationId, merchantId)
      .then((result) => {
        if (active) setAgreements(result);
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
  }, [merchantId, organizationId, request]);

  const agreement =
    agreements.find((candidate) => candidate.status === 'ACTIVE') ??
    agreements[0];

  return (
    <section
      className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
      aria-labelledby="agreement-summary-title"
    >
      <div className="flex items-start justify-between gap-4 max-sm:grid">
        <div>
          <h2 className="text-base font-bold" id="agreement-summary-title">
            Current agreement
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            The active agreement, or the most recent agreement when none is
            active.
          </p>
        </div>
        <Link
          className="font-bold text-emerald-700 underline underline-offset-3"
          href={`/app/organizations/${organizationId}/agreements?merchantId=${merchantId}`}
        >
          Manage agreements
        </Link>
      </div>
      {isLoading ? (
        <ListSkeleton label="Loading agreement summary" />
      ) : loadError ? (
        <RequestError
          className="mt-5"
          title="Agreement summary unavailable"
          message={loadError}
          onRetry={() => void load()}
        />
      ) : !agreement ? (
        <p className="mt-5 text-slate-500">
          {merchantName} has no agreement yet.
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[0.6rem] border border-slate-200 p-4">
          <div>
            <strong>{agreement.settlementSchedule.replace('_', '-')}</strong>
            <p className="mt-1 text-sm text-slate-500">
              {displayDate(agreement.startDate)} –{' '}
              {agreement.endDate
                ? displayDate(agreement.endDate)
                : 'Open-ended'}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${agreement.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
          >
            {agreement.status.toLowerCase()}
          </span>
        </div>
      )}
    </section>
  );
}
