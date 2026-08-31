'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
} from '@/components/ui/operational-page';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import type { OrganizationAccess } from '@/features/organizations/organization.types';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { getReportsOverview } from './report-api';
import type { ReportsOverview } from './report.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const date = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

export function OwnerDashboard({
  organization,
}: {
  organization: OrganizationAccess;
}) {
  const { request } = useAuth();
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getReportsOverview(request, organization.id)
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Dashboard metrics could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [organization.id, request]);

  if (!overview && !error)
    return <ListSkeleton label="Loading organization dashboard" />;

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Store dashboard"
        description="Current sales, store earnings, settlement obligations, and inventory health."
      />
      {error ? (
        <RequestError
          message={error}
          onRetry={() => window.location.reload()}
        />
      ) : null}
      {overview ? (
        <>
          <p className="mt-6 text-sm text-slate-500">
            Reporting period{' '}
            {date.format(new Date(`${overview.period.from}T00:00:00`))}–
            {date.format(new Date(`${overview.period.to}T00:00:00`))}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Net sales"
              value={money.format(Number(overview.sales.netSales))}
              detail={`${overview.sales.saleCount} completed sales`}
            />
            <Metric
              label="Store revenue"
              value={money.format(Number(overview.revenue.total))}
              detail="Finalized commission, rent, and adjustments"
            />
            <Metric
              label="Outstanding payouts"
              value={money.format(
                Number(overview.settlements.outstandingAmount),
              )}
              detail={`${overview.settlements.outstandingCount} approved settlements`}
            />
            <Metric
              label="Low stock"
              value={String(overview.inventory.lowStockCount)}
              detail={`${overview.inventory.quantityOnHand} total units on hand`}
            />
          </div>
          <div className="grid gap-0 xl:grid-cols-2 xl:gap-5">
            <OperationalPanel
              title="Recent sales"
              description="Latest completed sales in the reporting period."
              action={
                <Link
                  className="text-sm font-bold text-emerald-700"
                  href={`/app/organizations/${organization.id}/reports`}
                >
                  View reports
                </Link>
              }
            >
              <ul className="divide-y divide-slate-200">
                {overview.recentSales.length ? (
                  overview.recentSales.map((sale) => (
                    <li
                      className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                      key={sale.id}
                    >
                      <span>
                        <Link
                          className="text-sm font-bold text-slate-950"
                          href={`/app/organizations/${organization.id}/pos/sales/${sale.id}`}
                        >
                          {sale.saleNumber}
                        </Link>
                        <span className="mt-1 block text-xs text-slate-500">
                          {sale.branch.name} ·{' '}
                          {date.format(new Date(sale.completedAt))}
                        </span>
                      </span>
                      <strong className="text-sm">
                        {money.format(Number(sale.total))}
                      </strong>
                    </li>
                  ))
                ) : (
                  <li className="px-6 py-10 text-center text-sm text-slate-500">
                    No sales in this period.
                  </li>
                )}
              </ul>
            </OperationalPanel>
            <OperationalPanel
              title="Recent settlements"
              description="Latest merchant settlement periods and obligations."
            >
              <ul className="divide-y divide-slate-200">
                {overview.recentSettlements.length ? (
                  overview.recentSettlements.map((settlement) => (
                    <li
                      className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                      key={settlement.id}
                    >
                      <span>
                        <Link
                          className="text-sm font-bold text-slate-950"
                          href={`/app/organizations/${organization.id}/settlements/${settlement.id}`}
                        >
                          {settlement.merchantName}
                        </Link>
                        <span className="mt-1 block text-xs text-slate-500">
                          Through {date.format(new Date(settlement.periodEnd))}{' '}
                          · {settlement.status}
                        </span>
                      </span>
                      <strong className="text-sm">
                        {money.format(Number(settlement.netPayout))}
                      </strong>
                    </li>
                  ))
                ) : (
                  <li className="px-6 py-10 text-center text-sm text-slate-500">
                    No settlements in this period.
                  </li>
                )}
              </ul>
            </OperationalPanel>
          </div>
        </>
      ) : null}
    </OperationalPage>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}
