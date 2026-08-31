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
import { getMerchantDashboard } from './report-api';
import type { MerchantDashboardData } from './report.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const date = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

export function MerchantDashboard({
  organization,
}: {
  organization: OrganizationAccess;
}) {
  const { request } = useAuth();
  const [dashboard, setDashboard] = useState<MerchantDashboardData | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getMerchantDashboard(request, organization.id)
      .then((result) => {
        if (active) setDashboard(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Merchant reporting could not be loaded.',
        );
      });
    return () => {
      active = false;
    };
  }, [organization.id, request]);

  if (!dashboard && !error)
    return <ListSkeleton label="Loading merchant dashboard" />;

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title={dashboard?.merchant.name ?? 'Merchant dashboard'}
        description="Your sales, inventory, settlements, and payout status in this concept store."
      />
      {error ? (
        <RequestError
          title="Merchant dashboard unavailable"
          message={error}
          onRetry={() => window.location.reload()}
        />
      ) : null}
      {dashboard ? (
        <>
          <p className="mt-6 text-sm text-slate-500">
            Reporting period{' '}
            {date.format(new Date(`${dashboard.period.from}T00:00:00`))}–
            {date.format(new Date(`${dashboard.period.to}T00:00:00`))}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Gross sales"
              value={money.format(Number(dashboard.sales.grossSales))}
              detail={`${dashboard.sales.saleCount} customer sales`}
            />
            <Metric
              label="Refunds"
              value={money.format(Number(dashboard.sales.refunds))}
              detail="Completed item refunds"
            />
            <Metric
              label="Net sales"
              value={money.format(Number(dashboard.sales.netSales))}
              detail="Gross sales less refunds"
            />
            <Metric
              label="Stock on hand"
              value={String(dashboard.inventory.quantityOnHand)}
              detail={`${dashboard.inventory.lowStockCount} low-stock records`}
            />
          </div>
          <OperationalPanel
            title="Settlement and payout history"
            description={`${dashboard.settlements.outstandingCount} approved settlements await payout · ${money.format(Number(dashboard.settlements.paidAmount))} recorded paid`}
          >
            {dashboard.recentSettlements.length ? (
              <ul className="divide-y divide-slate-200">
                {dashboard.recentSettlements.map((settlement) => (
                  <li
                    className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                    key={settlement.id}
                  >
                    <span>
                      <strong className="text-sm">
                        {date.format(new Date(settlement.periodStart))}–
                        {date.format(new Date(settlement.periodEnd))}
                      </strong>
                      <span className="mt-1 block text-xs text-slate-500">
                        {settlement.status}
                      </span>
                    </span>
                    <strong className="text-sm">
                      {money.format(Number(settlement.netPayout))}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-12 text-center text-sm text-slate-500">
                No settlement history is available for this period.
              </p>
            )}
          </OperationalPanel>
          <p className="mt-5 text-sm text-slate-500">
            Questions about an adjustment or payout should be raised with the
            store owner. Financial totals are read-only here.
          </p>
          <Link
            className="mt-3 inline-block text-sm font-bold text-emerald-700"
            href={`/app/organizations/${organization.id}`}
          >
            Refresh overview
          </Link>
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
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  );
}
