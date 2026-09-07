'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { BackLink } from '@/components/ui/back-link';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { getSale, refundSale, voidSale } from './pos-api';
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
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundQuantities, setRefundQuantities] = useState<
    Record<string, number>
  >({});
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const canUsePos =
    organization?.role === 'OWNER' ||
    organization?.role === 'MANAGER' ||
    organization?.role === 'CASHIER';
  const canVoid =
    organization?.role === 'OWNER' || organization?.role === 'MANAGER';
  const canRefund = canVoid;

  async function handleVoid() {
    if (!sale || !branchId || !voidReason.trim()) return;
    setIsVoiding(true);
    setVoidError(null);
    try {
      setSale(
        await voidSale(
          request,
          organizationId,
          branchId,
          sale.id,
          voidReason.trim(),
        ),
      );
      setShowVoid(false);
      setVoidReason('');
    } catch (cause: unknown) {
      setVoidError(message(cause));
    } finally {
      setIsVoiding(false);
    }
  }

  function refundedQuantity(saleItemId: string): number {
    return (
      sale?.refunds.reduce(
        (total, refund) =>
          total +
          refund.items
            .filter((item) => item.saleItemId === saleItemId)
            .reduce((subtotal, item) => subtotal + item.quantity, 0),
        0,
      ) ?? 0
    );
  }

  function openRefund(): void {
    setRefundError(null);
    setRefundReason('');
    setRefundQuantities({});
    setShowRefund(true);
  }

  async function handleRefund(): Promise<void> {
    if (!sale || !branchId || !refundReason.trim()) return;
    const items = sale.items
      .map((item) => ({
        saleItemId: item.id,
        quantity: refundQuantities[item.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      setRefundError('Select at least one item quantity to refund.');
      return;
    }
    setIsRefunding(true);
    setRefundError(null);
    try {
      await refundSale(request, organizationId, branchId, sale.id, {
        reason: refundReason.trim(),
        items,
      });
      setShowRefund(false);
      setRefundReason('');
      setRefundQuantities({});
      setVersion((current) => current + 1);
    } catch (cause: unknown) {
      setRefundError(
        cause instanceof ApiError
          ? cause.message
          : 'The refund could not be recorded. Please try again.',
      );
    } finally {
      setIsRefunding(false);
    }
  }

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
    <section className="mx-auto mt-5 w-full max-w-[100rem] sm:mt-6">
      <OrganizationPageHeader
        organization={organization}
        title="Transaction details"
        description="Review the immutable sale, payment, and merchant-attribution record."
      />
      <PosNavigation organizationId={organizationId} />
      <div className="mt-6">
        <BackLink
          href={`/app/organizations/${organizationId}/pos/sales?branchId=${encodeURIComponent(branchId ?? '')}`}
        >
          Back to sales history
        </BackLink>
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
                  {sale.status === 'VOIDED' ? 'Voided sale' : 'Completed sale'}
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  {sale.saleNumber}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {dateTime.format(new Date(sale.completedAt))}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${sale.status === 'VOIDED' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}
                >
                  {sale.status === 'VOIDED' ? 'Voided' : 'Completed'}
                </span>
                {canVoid && sale.status === 'COMPLETED' ? (
                  <button
                    className="min-h-10 cursor-pointer rounded-[0.6rem] border border-rose-300 bg-white px-4 text-sm font-bold text-rose-700 hover:bg-rose-50"
                    type="button"
                    onClick={() => setShowVoid(true)}
                  >
                    Void sale
                  </button>
                ) : null}
                {canRefund &&
                sale.status === 'COMPLETED' &&
                sale.items.some(
                  (item) => refundedQuantity(item.id) < item.quantity,
                ) ? (
                  <button
                    className="min-h-10 cursor-pointer rounded-[0.6rem] border border-amber-300 bg-white px-4 text-sm font-bold text-amber-800 hover:bg-amber-50"
                    type="button"
                    onClick={openRefund}
                  >
                    Record refund
                  </button>
                ) : null}
                <Link
                  className="grid min-h-10 place-items-center rounded-[0.6rem] border border-emerald-600 bg-emerald-600 px-4 text-sm font-bold text-white no-underline hover:bg-emerald-700"
                  href={`/app/organizations/${organizationId}/pos/sales/${sale.id}/receipt?branchId=${encodeURIComponent(sale.branchId)}`}
                >
                  View receipt
                </Link>
              </div>
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
                        {refundedQuantity(item.id) ? (
                          <span className="mt-1 block text-xs text-amber-700">
                            {refundedQuantity(item.id)} refunded
                          </span>
                        ) : null}
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
      {sale?.status === 'VOIDED' && sale.voidReason ? (
        <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <strong>Void reason:</strong> {sale.voidReason}
        </p>
      ) : null}
      {showVoid ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
          role="presentation"
        >
          <section
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="void-sale-title"
          >
            <h2 className="text-xl font-bold" id="void-sale-title">
              Void this sale?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Inventory will be restored and the sale will be excluded from
              merchant balances. Its original record remains in history.
            </p>
            <label
              className="mt-5 block text-sm font-bold"
              htmlFor="void-reason"
            >
              Documented reason
            </label>
            <textarea
              className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 p-3"
              id="void-reason"
              value={voidReason}
              maxLength={500}
              onChange={(event) => setVoidReason(event.target.value)}
            />
            {voidError ? (
              <p className="mt-3 text-sm text-rose-700" role="alert">
                {voidError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="min-h-11 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 font-bold hover:bg-slate-100"
                type="button"
                disabled={isVoiding}
                onClick={() => setShowVoid(false)}
              >
                Cancel
              </button>
              <button
                className="min-h-11 cursor-pointer rounded-lg border-0 bg-rose-600 px-4 font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                type="button"
                disabled={isVoiding || !voidReason.trim()}
                onClick={() => void handleVoid()}
              >
                {isVoiding ? 'Voiding…' : 'Void sale'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {showRefund && sale ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
          role="presentation"
        >
          <section
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-sale-title"
          >
            <h2 className="text-xl font-bold" id="refund-sale-title">
              Record refund
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Select returned quantities. Inventory will be restored and the
              merchant balance will be updated.
            </p>
            <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-right">Remaining</th>
                    <th className="p-3 text-right">Return quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sale.items.map((item) => {
                    const remaining = item.quantity - refundedQuantity(item.id);
                    return (
                      <tr key={item.id}>
                        <td className="p-3">
                          <strong>{item.productName}</strong>
                          <span className="mt-1 block text-xs text-slate-500">
                            {item.productSku}
                          </span>
                        </td>
                        <td className="p-3 text-right">{remaining}</td>
                        <td className="p-3 text-right">
                          <input
                            aria-label={`Refund quantity for ${item.productName}`}
                            className="min-h-10 w-28 rounded-lg border border-slate-200 px-3 text-right"
                            disabled={remaining === 0 || isRefunding}
                            max={remaining}
                            min={0}
                            onChange={(event) =>
                              setRefundQuantities((current) => ({
                                ...current,
                                [item.id]: Number(event.target.value),
                              }))
                            }
                            type="number"
                            value={refundQuantities[item.id] ?? 0}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label
              className="mt-5 block text-sm font-bold"
              htmlFor="refund-reason"
            >
              Documented reason
            </label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 p-3"
              id="refund-reason"
              value={refundReason}
              maxLength={500}
              onChange={(event) => setRefundReason(event.target.value)}
            />
            {refundError ? (
              <p className="mt-3 text-sm text-rose-700" role="alert">
                {refundError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="min-h-11 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 font-bold hover:bg-slate-100"
                type="button"
                disabled={isRefunding}
                onClick={() => setShowRefund(false)}
              >
                Cancel
              </button>
              <button
                className="min-h-11 cursor-pointer rounded-lg border-0 bg-amber-600 px-4 font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                type="button"
                disabled={isRefunding || !refundReason.trim()}
                onClick={() => void handleRefund()}
              >
                {isRefunding ? 'Recording…' : 'Confirm refund'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
