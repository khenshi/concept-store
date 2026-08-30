'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { getSale } from './pos-api';
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
    : 'The receipt could not be loaded. Please try again.';
}

export function SaleReceipt({
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
    return <ListSkeleton label="Loading receipt" />;
  if (!organization) return null;

  if (!canUsePos)
    return (
      <div className="mx-auto mt-8 max-w-xl rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="font-bold text-slate-950">Receipt access is limited</h1>
      </div>
    );
  if (!branchId)
    return (
      <div
        className="mx-auto mt-8 max-w-xl rounded-xl border border-red-600 bg-white p-6"
        role="alert"
      >
        Branch context is missing. Open the receipt from transaction history.
      </div>
    );
  if (error)
    return (
      <RequestError
        className="mx-auto mt-8 max-w-xl rounded-xl border border-slate-200 bg-white p-6"
        message={error}
        onRetry={() => {
          setError(null);
          setVersion((current) => current + 1);
        }}
      />
    );
  if (!sale) return <ListSkeleton label="Loading receipt details" rows={6} />;

  return (
    <section className="mx-auto w-full max-w-2xl py-8 print:max-w-none print:py-0">
      <div className="mb-5 flex items-center justify-between gap-4 print:hidden">
        <Link
          className="text-sm font-bold text-emerald-700 underline underline-offset-3"
          href={`/app/organizations/${organizationId}/pos/sales/${sale.id}?branchId=${encodeURIComponent(sale.branchId)}`}
        >
          ← Back to transaction
        </Link>
        <button
          className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-5 font-bold text-white"
          type="button"
          onClick={() => window.print()}
        >
          Print receipt
        </button>
      </div>
      <article className="rounded-xl border border-slate-200 bg-white p-6 print:rounded-none print:border-0 print:p-0 sm:p-8">
        <header className="border-b border-slate-300 pb-6 text-center">
          <p className="text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">
            Sales receipt
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">
            {organization.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{sale.branch.name}</p>
        </header>

        <dl className="grid gap-2 border-b border-slate-300 py-5 text-sm">
          <ReceiptRow label="Sale number" value={sale.saleNumber} />
          <ReceiptRow
            label="Date"
            value={dateTime.format(new Date(sale.completedAt))}
          />
          <ReceiptRow
            label="Cashier"
            value={`${sale.cashier.firstName} ${sale.cashier.lastName}`}
          />
        </dl>

        <div className="divide-y divide-slate-200 border-b border-slate-300 py-2">
          {sale.items.map((item) => (
            <div className="py-3" key={item.id}>
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-slate-950">
                    {item.productName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.productSku} · {item.merchantName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.quantity} × {money.format(Number(item.unitPrice))}
                  </p>
                </div>
                <p className="text-sm font-bold text-slate-950">
                  {money.format(Number(item.total))}
                </p>
              </div>
            </div>
          ))}
        </div>

        <dl className="ml-auto grid max-w-xs gap-2 py-5 text-sm">
          <ReceiptRow
            label="Subtotal"
            value={money.format(Number(sale.subtotal))}
          />
          <ReceiptRow
            label="Discount"
            value={money.format(Number(sale.discountTotal))}
          />
          <ReceiptRow
            label="Total paid"
            value={money.format(Number(sale.total))}
            strong
          />
        </dl>

        <section className="border-t border-slate-300 pt-5">
          <h2 className="text-sm font-bold text-slate-950">Payment</h2>
          <dl className="mt-3 grid gap-2">
            {sale.payments.map((payment) => (
              <div key={payment.id}>
                <ReceiptRow
                  label={paymentLabels[payment.method]}
                  value={money.format(Number(payment.amount))}
                />
                {payment.referenceNumber ? (
                  <p className="mt-1 break-all text-xs text-slate-500">
                    Reference: {payment.referenceNumber}
                  </p>
                ) : null}
              </div>
            ))}
          </dl>
        </section>
        <p className="mt-8 text-center text-xs leading-5 text-slate-500">
          Thank you. Keep this receipt as your transaction record.
        </p>
      </article>
    </section>
  );
}

function ReceiptRow({
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
      className={`flex justify-between gap-5 ${strong ? 'text-base font-bold text-slate-950' : 'text-slate-600'}`}
    >
      <dt>{label}</dt>
      <dd className="m-0 text-right">{value}</dd>
    </div>
  );
}
