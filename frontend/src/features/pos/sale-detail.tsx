'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { getSale } from './pos-api';
import { PosNavigation } from './pos-navigation';
import type { PaymentMethod, Sale } from './pos.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const dateTime = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long',
  timeStyle: 'short',
});
const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  GCASH: 'GCash',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other manual payment',
};

function message(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'Transaction details could not be loaded. Please try again.';
}

export function SaleDetail({
  organizationId,
  branchId,
  saleId,
}: {
  organizationId: string;
  branchId?: string;
  saleId: string;
}) {
  const { request } = useAuth();
  const { organization, organizationStatus } =
    useOrganizationWorkspaceContext();
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const canUsePos =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'CASHIER';

  useEffect(() => {
    if (!branchId || !canUsePos) return;
    let active = true;
    void getSale(request, organizationId, branchId, saleId)
      .then((result) => {
        if (active) setSale(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(message(cause));
      });
    return () => {
      active = false;
    };
  }, [branchId, canUsePos, organizationId, request, saleId, version]);

  if (organizationStatus === 'loading')
    return <ListSkeleton label="Loading transaction" />;
  if (!organization) return null;

  return (
    <section className="mx-auto mt-7 w-full max-w-[100rem] sm:mt-9">
      <OrganizationPageHeader
        organization={organization}
        title="Transaction details"
        description="Review the immutable sale, payment, and merchant-attribution record."
      />
      <PosNavigation organizationId={organizationId} />
      <div className="mt-6">
        <Link
          className="text-sm font-bold text-emerald-700 underline underline-offset-3"
          href={`/app/organizations/${organizationId}/pos/sales?branchId=${encodeURIComponent(branchId ?? '')}`}
        >
          ← Back to sales history
        </Link>
      </div>
      {!canUsePos ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold text-slate-950">POS access is limited</h2>
        </div>
      ) : !branchId ? (
        <div
          className="mt-6 rounded-xl border border-red-600 bg-white p-6"
          role="alert"
        >
          <h2 className="font-bold text-slate-950">
            Branch context is missing
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Open this transaction from sales history so its branch can be
            verified.
          </p>
        </div>
      ) : error ? (
        <RequestError
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
          message={error}
          onRetry={() => {
            setError(null);
            setVersion((current) => current + 1);
          }}
        />
      ) : !sale ? (
        <ListSkeleton label="Loading transaction details" rows={5} />
      ) : (
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
                  Completed sale
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  {sale.saleNumber}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {dateTime.format(new Date(sale.completedAt))}
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                Completed
              </span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3 font-bold">Product</th>
                    <th className="px-4 py-3 font-bold">Merchant</th>
                    <th className="px-4 py-3 text-right font-bold">Price</th>
                    <th className="px-4 py-3 text-right font-bold">Qty</th>
                    <th className="px-6 py-3 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-950">
                          {item.productName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.productSku}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {item.merchantName}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        {money.format(Number(item.unitPrice))}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-950">
                        {money.format(Number(item.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto grid max-w-sm gap-3 border-t border-slate-200 px-6 py-5 text-sm">
              <Row
                label="Subtotal"
                value={money.format(Number(sale.subtotal))}
              />
              <Row
                label="Discount"
                value={money.format(Number(sale.discountTotal))}
              />
              <Row
                label="Total"
                value={money.format(Number(sale.total))}
                strong
              />
            </div>
          </section>

          <aside className="grid gap-6">
            <InfoPanel title="Sale context">
              <Row label="Branch" value={sale.branch.name} />
              <Row
                label="Cashier"
                value={`${sale.cashier.firstName} ${sale.cashier.lastName}`}
              />
              <Row label="Email" value={sale.cashier.email} />
            </InfoPanel>
            <InfoPanel title="Payments">
              {sale.payments.map((payment) => (
                <div
                  className="border-b border-slate-200 pb-4 last:border-0 last:pb-0"
                  key={payment.id}
                >
                  <Row
                    label={paymentLabels[payment.method]}
                    value={money.format(Number(payment.amount))}
                    strong
                  />
                  {payment.referenceNumber ? (
                    <p className="mt-2 break-all text-xs text-slate-500">
                      Reference: {payment.referenceNumber}
                    </p>
                  ) : null}
                </div>
              ))}
            </InfoPanel>
          </aside>
        </div>
      )}
    </section>
  );
}

function InfoPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-bold text-slate-950">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${strong ? 'font-bold text-slate-950' : 'text-slate-600'}`}
    >
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
