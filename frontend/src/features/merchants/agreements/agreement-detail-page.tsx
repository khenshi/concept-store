'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BackLink } from '@/components/ui/back-link';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import {
  collectAgreementPrepayment,
  listOrganizationAgreements,
  transitionAgreement,
} from './merchant-agreement-api';
import type { MerchantAgreement } from './merchant-agreement.types';

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'The agreement could not be updated.';
const displayDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
        new Date(`${value.slice(0, 10)}T00:00:00`),
      )
    : 'Open-ended';
const held = (
  transactions: MerchantAgreement['prepayments'][number]['transactions'],
) =>
  transactions.reduce(
    (sum, item) =>
      sum +
      (item.type === 'COLLECTION' ? Number(item.amount) : -Number(item.amount)),
    0,
  );

type PendingAction = {
  action: 'discard' | 'withdraw' | 'return-to-draft' | 'suspend';
  title: string;
  description: string;
};

export function AgreementDetailPage({
  organizationId,
  agreementId,
}: {
  organizationId: string;
  agreementId: string;
}) {
  const { request } = useAuth();
  const { organization } = useOrganizationWorkspaceContext();
  const [agreement, setAgreement] = useState<MerchantAgreement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAgreement(
        (await listOrganizationAgreements(request, organizationId)).find(
          (item) => item.id === agreementId,
        ) ?? null,
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setIsLoading(false);
    }
  }, [agreementId, organizationId, request]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  async function act(
    action: Parameters<typeof transitionAgreement>[3],
    body?: object,
  ) {
    setBusy(true);
    setError(null);
    try {
      const saved = await transitionAgreement(
        request,
        organizationId,
        agreementId,
        action,
        body,
      );
      setAgreement(saved);
      setPendingAction(null);
      setReason('');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function collect(
    kind: MerchantAgreement['prepayments'][number]['kind'],
    amount: string,
    method: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      await collectAgreementPrepayment(
        request,
        organizationId,
        agreementId,
        kind,
        {
          amount,
          method,
          occurredAt: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      );
      await load();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading)
    return <ListSkeleton className="mt-8" label="Loading agreement" rows={7} />;
  if (!agreement)
    return (
      <section className="mx-auto mt-6 w-full max-w-5xl">
        <BackLink href={`/app/organizations/${organizationId}/agreements`}>
          Back to agreements
        </BackLink>
        <RequestError
          className="mt-6"
          title="Agreement unavailable"
          message={error ?? 'This agreement was not found.'}
          onRetry={() => void load()}
        />
      </section>
    );
  const isOwner = organization?.role === 'OWNER';
  const blockers = agreement.prepayments.filter(
    (item) => held(item.transactions) < Number(item.requiredAmount),
  );
  return (
    <section className="mx-auto mt-5 w-full max-w-6xl sm:mt-6">
      <BackLink href={`/app/organizations/${organizationId}/agreements`}>
        Back to agreements
      </BackLink>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Merchant agreement
            </p>
            <Status value={agreement.status} />
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {agreement.merchant?.name ?? agreement.merchantId}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Created {displayDate(agreement.createdAt)} · Agreement{' '}
            {agreement.id.slice(0, 8)}
          </p>
        </div>
        {agreement.status === 'DRAFT' ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-bold text-slate-800 no-underline hover:border-emerald-600 hover:text-emerald-700"
            href={`/app/organizations/${organizationId}/agreements/${agreementId}/edit`}
          >
            Edit draft
          </Link>
        ) : null}
      </header>
      {error ? (
        <p
          className="mt-5 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="grid gap-6">
          <DetailSection title="Agreement overview">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Datum
                label="Activation date"
                value={displayDate(agreement.activationAt)}
              />
              <Datum
                label="Duration"
                value={`${agreement.durationMonths} months`}
              />
              <Datum
                label="Settlement"
                value={agreement.settlementSchedule
                  .replace('_', '-')
                  .toLowerCase()}
              />
              <Datum label="Ends" value={displayDate(agreement.endDate)} />
            </div>
          </DetailSection>
          <DetailSection title="Selling locations">
            <div className="grid gap-3 sm:grid-cols-2">
              {agreement.spaceReservations.map((item) => (
                <div
                  className="rounded-lg border border-slate-200 p-4"
                  key={item.id}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {item.space.code}
                  </p>
                  <p className="mt-1 font-bold text-slate-900">
                    {item.space.name}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Reserved {displayDate(item.periodStart)} –{' '}
                    {displayDate(item.periodEnd)}
                  </p>
                </div>
              ))}
            </div>
          </DetailSection>
          <DetailSection title="Commercial terms">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Datum
                label="Monthly rent"
                value={
                  agreement.fixedRentAmount
                    ? money.format(Number(agreement.fixedRentAmount))
                    : 'None'
                }
              />
              <Datum
                label="Commission"
                value={
                  agreement.commissionRate
                    ? `${agreement.commissionRate}%`
                    : 'None'
                }
              />
              <Datum
                label="Rent collection"
                value={
                  agreement.rentDueWeek
                    ? `${agreement.rentDueWeek.toLowerCase()} ${agreement.rentDueWeekday?.toLowerCase()}`
                    : 'Not applicable'
                }
              />
              <Datum
                label="Security deposit"
                value={
                  agreement.securityDepositAmount
                    ? money.format(Number(agreement.securityDepositAmount))
                    : 'None'
                }
              />
              <Datum
                label="First rent"
                value={
                  agreement.firstRentPaymentRequired
                    ? 'Required before approval'
                    : 'Due on activation'
                }
              />
            </div>
          </DetailSection>
          {agreement.prepayments.length ? (
            <DetailSection title="Approval payments">
              <div className="grid gap-3 sm:grid-cols-2">
                {agreement.prepayments.map((item) => {
                  const balance = held(item.transactions);
                  const remaining = Math.max(
                    0,
                    Number(item.requiredAmount) - balance,
                  );
                  return (
                    <div className="rounded-lg bg-slate-50 p-4" key={item.id}>
                      <p className="text-sm font-bold">
                        {item.kind === 'SECURITY_DEPOSIT'
                          ? 'Security deposit'
                          : 'First rent'}
                      </p>
                      <p className="mt-2 text-lg font-bold">
                        {money.format(balance)}{' '}
                        <span className="text-sm font-normal text-slate-500">
                          of {money.format(Number(item.requiredAmount))}
                        </span>
                      </p>
                      {agreement.status === 'PENDING' && remaining > 0 ? (
                        <CollectionForm
                          busy={busy}
                          remaining={remaining}
                          onCollect={(amount, method) =>
                            collect(item.kind, amount, method)
                          }
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </DetailSection>
          ) : null}
          {agreement.activationFailureReason ? (
            <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              Activation blocked: {agreement.activationFailureReason}
            </p>
          ) : null}
        </div>
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-5">
          <h2 className="font-bold text-slate-950">Available actions</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Actions change the agreement lifecycle and are recorded by the
            system.
          </p>
          <div className="mt-5 grid gap-3">
            {agreement.status === 'DRAFT' ? (
              <>
                <Action
                  primary
                  disabled={busy}
                  onClick={() => void act('submit')}
                >
                  Submit for review
                </Action>
                <Action
                  danger
                  disabled={busy}
                  onClick={() =>
                    setPendingAction({
                      action: 'discard',
                      title: 'Discard draft?',
                      description:
                        'The draft will move to suspended history and can no longer be edited.',
                    })
                  }
                >
                  Discard draft
                </Action>
              </>
            ) : null}
            {agreement.status === 'PENDING' ? (
              <>
                <Action
                  disabled={busy}
                  onClick={() =>
                    setPendingAction({
                      action: 'withdraw',
                      title: 'Withdraw submission?',
                      description:
                        'The agreement will return to a draft and release its reserved spaces.',
                    })
                  }
                >
                  Withdraw
                </Action>
                {isOwner ? (
                  <>
                    <Action
                      primary
                      disabled={busy || blockers.length > 0}
                      onClick={() => void act('approve')}
                    >
                      Approve agreement
                    </Action>
                    <Action
                      disabled={busy}
                      onClick={() =>
                        setPendingAction({
                          action: 'return-to-draft',
                          title: 'Return to draft?',
                          description:
                            'The merchant terms can be edited again and reserved spaces will be released.',
                        })
                      }
                    >
                      Return to draft
                    </Action>
                  </>
                ) : null}
              </>
            ) : null}
            {agreement.status === 'APPROVED' && isOwner ? (
              <Action
                primary
                disabled={busy}
                onClick={() => void act('activate')}
              >
                Activate now
              </Action>
            ) : null}
            {agreement.status === 'ACTIVE' && isOwner ? (
              <Action
                danger
                disabled={busy}
                onClick={() =>
                  setPendingAction({
                    action: 'suspend',
                    title: 'Suspend agreement?',
                    description:
                      'Active occupancy will end and this cannot be undone.',
                  })
                }
              >
                Suspend agreement
              </Action>
            ) : null}
            {!['DRAFT', 'PENDING', 'APPROVED', 'ACTIVE'].includes(
              agreement.status,
            ) ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                This agreement is historical and has no available lifecycle
                actions.
              </p>
            ) : null}
          </div>
          {blockers.length ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Approval is blocked until required payments are collected.
            </p>
          ) : null}
        </aside>
      </div>
      {pendingAction ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
          role="presentation"
        >
          <section
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="agreement-action-title"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Confirm action
            </p>
            <h2
              className="mt-2 text-xl font-bold text-slate-950"
              id="agreement-action-title"
            >
              {pendingAction.title}
            </h2>
            <p className="mt-3 leading-7 text-slate-500">
              {pendingAction.description}
            </p>
            <label
              className="mt-5 grid gap-2 text-sm font-bold text-slate-700"
              htmlFor="agreement-action-reason"
            >
              Reason
              <textarea
                className="min-h-24 rounded-lg border border-slate-200 p-3 font-normal focus:border-emerald-600 focus:outline-3 focus:outline-emerald-100"
                id="agreement-action-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                required
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="min-h-11 rounded-lg border border-slate-200 px-4 font-bold"
                type="button"
                disabled={busy}
                onClick={() => {
                  setPendingAction(null);
                  setReason('');
                }}
              >
                Cancel
              </button>
              <button
                className="min-h-11 rounded-lg bg-red-600 px-4 font-bold text-white disabled:opacity-50"
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void act(pendingAction.action, { reason: reason.trim() })
                }
              >
                {busy ? 'Working…' : 'Confirm action'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
      {value.toLowerCase().replace('_', ' ')}
    </span>
  );
}
function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="mb-5 font-bold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}
function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold capitalize text-slate-800">
        {value}
      </p>
    </div>
  );
}
function Action({
  children,
  onClick,
  disabled,
  primary,
  danger,
}: {
  children: ReactNode;
  onClick(): void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={`min-h-11 rounded-lg border px-4 font-bold disabled:opacity-50 ${primary ? 'border-emerald-600 bg-emerald-600 text-white' : danger ? 'border-red-200 bg-white text-red-700' : 'border-slate-300 bg-white text-slate-800'}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CollectionForm({
  busy,
  remaining,
  onCollect,
}: {
  busy: boolean;
  remaining: number;
  onCollect(amount: string, method: string): Promise<void>;
}) {
  const [method, setMethod] = useState('CASH');
  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void onCollect(String(data.get('amount')), method);
      }}
    >
      <label className="grid gap-1.5 text-xs font-bold text-slate-600">
        Collection amount
        <input
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          name="amount"
          inputMode="decimal"
          defaultValue={remaining.toFixed(2)}
        />
      </label>
      <label className="grid gap-1.5 text-xs font-bold text-slate-600">
        Payment method
        <SelectControl value={method} onValueChange={setMethod}>
          <option value="CASH">Cash</option>
          <option value="GCASH">GCash</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="OTHER">Other</option>
        </SelectControl>
      </label>
      <button
        className="min-h-11 rounded-lg border border-emerald-600 bg-white px-4 font-bold text-emerald-700 disabled:opacity-50"
        disabled={busy}
      >
        {busy ? 'Recording…' : 'Record collection'}
      </button>
    </form>
  );
}
