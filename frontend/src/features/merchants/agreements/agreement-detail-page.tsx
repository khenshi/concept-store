'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import {
  activateMerchantAgreement,
  endMerchantAgreement,
  getMerchantAgreement,
  updateMerchantAgreement,
} from './merchant-agreement-api';
import { AgreementForm } from './merchant-agreement-management';
import { endMerchantAgreementSchema } from './merchant-agreement.schemas';
import type {
  MerchantAgreement,
  MerchantAgreementInput,
  MerchantAgreementUpdateInput,
} from './merchant-agreement.types';

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The agreement could not be loaded.';
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );
}

function peso(value: string | null): string {
  return value
    ? new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
      }).format(Number(value))
    : 'None';
}

export function AgreementDetailPage({
  organizationId,
  agreementId,
}: {
  organizationId: string;
  agreementId: string;
}) {
  const { request } = useAuth();
  const [agreement, setAgreement] = useState<MerchantAgreement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setAgreement(
        await getMerchantAgreement(request, organizationId, agreementId),
      );
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [agreementId, organizationId, request]);

  useEffect(() => {
    let active = true;
    void getMerchantAgreement(request, organizationId, agreementId)
      .then((result) => {
        if (active) setAgreement(result);
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
  }, [agreementId, organizationId, request]);

  async function handleEdit(input: MerchantAgreementInput) {
    if (!agreement) return;
    const update: MerchantAgreementUpdateInput = {
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      fixedRentAmount: input.fixedRentAmount ?? null,
      commissionRate: input.commissionRate ?? null,
      settlementSchedule: input.settlementSchedule,
    };
    setIsSubmitting(true);
    setActionError(null);
    try {
      const updated = await updateMerchantAgreement(
        request,
        organizationId,
        agreement.id,
        update,
      );
      setAgreement({ ...updated, merchant: agreement.merchant });
      setIsEditing(false);
      setSuccessMessage('The draft agreement was updated.');
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivate() {
    if (!agreement) return;
    if (
      !(await confirm({
        title: 'Activate this agreement?',
        description:
          'The draft will become the merchant’s active commercial agreement. Existing active terms may be ended by the established replacement rules.',
        confirmLabel: 'Activate agreement',
      }))
    )
      return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await activateMerchantAgreement(request, organizationId, agreement.id);
      await load();
      setSuccessMessage('The agreement is now active.');
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEnd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreement) return;
    const result = endMerchantAgreementSchema.safeParse({
      endDate: new FormData(event.currentTarget).get('endDate'),
    });
    if (!result.success) {
      setActionError(result.error.issues[0]?.message ?? 'Enter an end date.');
      return;
    }
    if (
      !(await confirm({
        title: 'End this agreement?',
        description: `End the active agreement on ${result.data.endDate}. Its history will be preserved.`,
        confirmLabel: 'End agreement',
        tone: 'danger',
      }))
    )
      return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await endMerchantAgreement(
        request,
        organizationId,
        agreement.id,
        result.data.endDate,
      );
      await load();
      setSuccessMessage('The agreement was ended and retained in history.');
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto mt-8 w-full sm:mt-12">
      <Link
        className="font-bold text-emerald-700 underline underline-offset-3"
        href={`/app/organizations/${organizationId}/agreements`}
      >
        ← Agreements
      </Link>
      {isLoading ? (
        <div
          className="mt-8 h-96 animate-pulse rounded-xl bg-slate-100"
          role="status"
          aria-label="Loading agreement"
        />
      ) : loadError || !agreement ? (
        <RequestError
          className="mt-8"
          title="Agreement unavailable"
          message={loadError ?? 'The agreement was not found.'}
          onRetry={() => void load()}
        />
      ) : (
        <>
          <header className="mt-8 flex items-start justify-between gap-5 border-b border-slate-200 pb-6 max-sm:grid">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
                {agreement.merchant?.name ?? 'Merchant agreement'}
              </p>
              <h1 className="mt-2 text-[clamp(1.65rem,3vw,2rem)] font-bold tracking-[-0.025em]">
                Agreement details
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Review terms and perform only actions allowed for its current
                status.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${agreement.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
            >
              {agreement.status.toLowerCase()}
            </span>
          </header>
          {successMessage ? (
            <p
              className="mt-6 rounded-lg border border-green-600 p-3"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}
          {actionError ? (
            <p
              className="mt-6 rounded-lg border border-red-600 p-3 text-red-600"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-bold">Commercial terms</h2>
              <dl className="mt-5 grid gap-0">
                <Detail
                  label="Merchant"
                  value={agreement.merchant?.name ?? agreement.merchantId}
                />
                <Detail
                  label="Term"
                  value={`${displayDate(agreement.startDate)} – ${agreement.endDate ? displayDate(agreement.endDate) : 'Open-ended'}`}
                />
                <Detail
                  label="Fixed rent"
                  value={peso(agreement.fixedRentAmount)}
                />
                <Detail
                  label="Commission"
                  value={
                    agreement.commissionRate
                      ? `${agreement.commissionRate}%`
                      : 'None'
                  }
                />
                <Detail
                  label="Settlement schedule"
                  value={agreement.settlementSchedule.replace('_', '-')}
                />
              </dl>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-bold">Available actions</h2>
              {agreement.status === 'DRAFT' ? (
                <div className="mt-5 grid gap-3">
                  <button
                    className="min-h-11 rounded-[0.65rem] border border-slate-200 bg-white font-bold"
                    type="button"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit draft
                  </button>
                  <button
                    className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 font-bold text-white disabled:opacity-60"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleActivate()}
                  >
                    {isSubmitting ? 'Activating…' : 'Activate agreement'}
                  </button>
                </div>
              ) : agreement.status === 'ACTIVE' ? (
                <form
                  className="mt-5 grid gap-3"
                  onSubmit={(event) => void handleEnd(event)}
                >
                  <label
                    className="text-sm font-bold"
                    htmlFor="detail-end-date"
                  >
                    Effective end date
                  </label>
                  <input
                    className="min-h-11 rounded-[0.6rem] border border-slate-200 px-3"
                    id="detail-end-date"
                    name="endDate"
                    type="date"
                    required
                  />
                  <button
                    className="min-h-11 rounded-[0.65rem] border border-slate-200 bg-white font-bold disabled:opacity-60"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Ending…' : 'End agreement'}
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  Ended agreements are read-only historical records.
                </p>
              )}
            </section>
          </div>
          {isEditing ? (
            <div
              className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Edit draft agreement"
            >
              <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
                <AgreementForm
                  agreement={agreement}
                  isSubmitting={isSubmitting}
                  onSaved={handleEdit}
                  onCancel={() => setIsEditing(false)}
                />
              </div>
            </div>
          ) : null}
        </>
      )}
      {confirmationDialog}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-slate-200 py-4 first:border-0 first:pt-0 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="m-0 font-semibold">{value}</dd>
    </div>
  );
}
