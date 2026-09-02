'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import {
  activateMerchantAgreement,
  createMerchantAgreement,
  endMerchantAgreement,
  listMerchantAgreements,
  updateMerchantAgreement,
} from './merchant-agreement-api';
import {
  endMerchantAgreementSchema,
  merchantAgreementSchema,
} from './merchant-agreement.schemas';
import type {
  AgreementStatus,
  MerchantAgreement,
  MerchantAgreementInput,
  MerchantAgreementUpdateInput,
  SettlementSchedule,
} from './merchant-agreement.types';

const statusLabels: Record<AgreementStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ENDED: 'Ended',
};

const statusStyles: Record<AgreementStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  ENDED: 'bg-slate-200 text-slate-700',
};

const scheduleLabels: Record<SettlementSchedule, string> = {
  WEEKLY: 'Weekly',
  SEMI_MONTHLY: 'Semi-monthly',
  MONTHLY: 'Monthly',
};

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(`${dateOnly(value)}T00:00:00`),
  );
}

function philippineToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function peso(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₱${grouped}.${fraction.padEnd(2, '0')}`;
}

export function MerchantAgreementManagement({
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
  const [editingDraft, setEditingDraft] = useState<MerchantAgreement | null>(
    null,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingAgreementId, setPendingAgreementId] = useState<string | null>(
    null,
  );
  const { confirm, confirmationDialog } = useConfirmationDialog();

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

  function replaceAgreement(updated: MerchantAgreement) {
    setAgreements((current) =>
      current.map((agreement) =>
        agreement.id === updated.id ? updated : agreement,
      ),
    );
  }

  async function handleSaved(input: MerchantAgreementInput) {
    setActionError(null);
    setSuccessMessage(null);
    setPendingAgreementId(editingDraft?.id ?? 'new');
    try {
      if (editingDraft) {
        const update: MerchantAgreementUpdateInput = {
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          fixedRentAmount: input.fixedRentAmount ?? null,
          commissionRate: input.commissionRate ?? null,
          settlementSchedule: input.settlementSchedule,
        };
        const updated = await updateMerchantAgreement(
          request,
          organizationId,
          editingDraft.id,
          update,
        );
        replaceAgreement(updated);
        setEditingDraft(null);
        setIsFormOpen(false);
        setSuccessMessage('The draft agreement was updated.');
      } else {
        const created = await createMerchantAgreement(
          request,
          organizationId,
          merchantId,
          input,
        );
        setAgreements((current) => [created, ...current]);
        setIsFormOpen(false);
        setSuccessMessage('A draft agreement was created.');
      }
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setPendingAgreementId(null);
    }
  }

  async function handleActivate(agreement: MerchantAgreement) {
    if (
      !(await confirm({
        title: 'Activate this agreement?',
        description: `Activate this agreement for ${merchantName}. If another agreement is active, it may be ended according to the existing agreement rules.`,
        confirmLabel: 'Activate agreement',
      }))
    ) {
      return;
    }
    setActionError(null);
    setSuccessMessage(null);
    setPendingAgreementId(agreement.id);
    try {
      await activateMerchantAgreement(request, organizationId, agreement.id);
      setAgreements(
        await listMerchantAgreements(request, organizationId, merchantId),
      );
      setEditingDraft(null);
      setSuccessMessage('The agreement is now active.');
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setPendingAgreementId(null);
    }
  }

  async function handleEnd(
    agreement: MerchantAgreement,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = endMerchantAgreementSchema.safeParse({
      endDate: new FormData(form).get('endDate'),
    });
    setActionError(null);
    setSuccessMessage(null);
    if (!result.success) {
      setActionError(result.error.issues[0]?.message ?? 'Enter an end date.');
      return;
    }
    if (result.data.endDate < dateOnly(agreement.startDate)) {
      setActionError('End date cannot be earlier than the start date.');
      return;
    }
    if (
      !(await confirm({
        title: 'End the active agreement?',
        description: `End the active agreement for ${merchantName} on the selected date. Its history will be preserved.`,
        confirmLabel: 'End agreement',
        tone: 'danger',
      }))
    )
      return;

    setPendingAgreementId(agreement.id);
    try {
      const ended = await endMerchantAgreement(
        request,
        organizationId,
        agreement.id,
        result.data.endDate,
      );
      replaceAgreement(ended);
      setSuccessMessage(
        `The agreement ended on ${displayDate(ended.endDate ?? result.data.endDate)}.`,
      );
      form.reset();
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setPendingAgreementId(null);
    }
  }

  return (
    <section
      className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
      aria-labelledby="agreements-title"
    >
      <div className="flex items-start justify-between gap-4 max-sm:grid">
        <div>
          <h2 className="text-lg font-bold" id="agreements-title">
            Merchant agreements
          </h2>
          <p className="mt-2 max-w-2xl leading-7 text-slate-500">
            Preserve commercial terms over time through drafts, activation, and
            explicit end dates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && !loadError ? (
            <span className="min-w-7 rounded-full bg-emerald-100 px-2 py-1 text-center text-xs font-bold text-emerald-700">
              {agreements.length}
            </span>
          ) : null}
          <button
            className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700"
            type="button"
            onClick={() => {
              setEditingDraft(null);
              setIsFormOpen(true);
            }}
          >
            Add agreement
          </button>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton label="Loading merchant agreements" />
      ) : loadError ? (
        <RequestError
          className="mt-5"
          title="Agreements unavailable"
          message={loadError}
          onRetry={() => void load()}
        />
      ) : (
        <>
          {successMessage ? (
            <p
              className="mt-5 rounded-lg border border-green-600 bg-white px-4 py-3"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}
          {actionError ? (
            <p
              className="mt-5 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}

          <div className="mt-6">
            <AgreementHistory
              agreements={agreements}
              pendingAgreementId={pendingAgreementId}
              onActivate={handleActivate}
              onEdit={(agreement) => {
                setActionError(null);
                setSuccessMessage(null);
                setEditingDraft(agreement);
                setIsFormOpen(true);
              }}
              onEnd={handleEnd}
            />
          </div>
        </>
      )}
      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingDraft ? 'Edit draft agreement' : 'Add agreement'}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pendingAgreementId) {
              setEditingDraft(null);
              setIsFormOpen(false);
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <AgreementForm
              key={editingDraft?.id ?? 'new-agreement'}
              agreement={editingDraft}
              isSubmitting={pendingAgreementId === (editingDraft?.id ?? 'new')}
              onCancel={() => {
                setEditingDraft(null);
                setIsFormOpen(false);
              }}
              onSaved={handleSaved}
            />
          </div>
        </div>
      ) : null}
      {confirmationDialog}
    </section>
  );
}

export function AgreementForm({
  agreement,
  isSubmitting,
  onSaved,
  onCancel,
}: {
  agreement: MerchantAgreement | null;
  isSubmitting: boolean;
  onSaved(input: MerchantAgreementInput): Promise<void>;
  onCancel(): void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (agreement) headingRef.current?.focus();
  }, [agreement]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = merchantAgreementSchema.safeParse({
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      fixedRentAmount: formData.get('fixedRentAmount'),
      commissionRate: formData.get('commissionRate'),
      settlementSchedule: formData.get('settlementSchedule'),
    });
    setFormError(null);
    if (!result.success) {
      const issue = result.error.issues[0];
      setFormError(issue?.message ?? 'Review the agreement terms.');
      window.requestAnimationFrame(() => {
        const field = form.elements.namedItem(String(issue?.path[0] ?? ''));
        if (field instanceof HTMLElement) field.focus();
      });
      return;
    }
    const input: MerchantAgreementInput = {
      startDate: result.data.startDate,
      endDate: result.data.endDate || undefined,
      fixedRentAmount: result.data.fixedRentAmount || undefined,
      commissionRate: result.data.commissionRate || undefined,
      settlementSchedule: result.data.settlementSchedule,
    };
    void onSaved(input);
  }

  return (
    <section aria-labelledby="agreement-form-title">
      <h3
        className="text-base font-bold"
        id="agreement-form-title"
        ref={headingRef}
        tabIndex={agreement ? -1 : undefined}
      >
        {agreement ? 'Edit draft agreement' : 'New draft agreement'}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Drafts may omit commercial terms until they are ready for activation.
      </p>
      <form className="mt-4 grid gap-4" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <p
            className="rounded-lg border border-red-600 p-3 text-sm text-red-600"
            role="alert"
          >
            {formError}
          </p>
        ) : null}
        <div className="grid gap-4">
          <AgreementField
            name="startDate"
            label="Start date"
            type="date"
            defaultValue={agreement ? dateOnly(agreement.startDate) : ''}
            required
          />
          <AgreementField
            name="endDate"
            label="End date"
            type="date"
            defaultValue={agreement?.endDate ? dateOnly(agreement.endDate) : ''}
            hint="Optional"
          />
        </div>
        <AgreementField
          name="fixedRentAmount"
          label="Fixed rent (PHP)"
          type="text"
          inputMode="decimal"
          defaultValue={agreement?.fixedRentAmount ?? ''}
          hint="Optional, for example 2500.00"
        />
        <AgreementField
          name="commissionRate"
          label="Commission rate (%)"
          type="text"
          inputMode="decimal"
          defaultValue={agreement?.commissionRate ?? ''}
          hint="Optional, from 0.01 to 100"
        />
        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="settlementSchedule">
            Settlement schedule
          </label>
          <SelectControl
            className="min-h-12 rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
            id="settlementSchedule"
            name="settlementSchedule"
            defaultValue={agreement?.settlementSchedule ?? 'MONTHLY'}
          >
            {Object.entries(scheduleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectControl>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="min-h-11 w-fit cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Saving draft…'
              : agreement
                ? 'Save draft'
                : 'Create draft'}
          </button>
          <button
            className="min-h-10 rounded-[0.6rem] border border-slate-200 bg-white px-3.5 py-2.5 font-bold"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function AgreementHistory({
  agreements,
  pendingAgreementId,
  onEdit,
  onActivate,
  onEnd,
}: {
  agreements: MerchantAgreement[];
  pendingAgreementId: string | null;
  onEdit(agreement: MerchantAgreement): void;
  onActivate(agreement: MerchantAgreement): Promise<void>;
  onEnd(
    agreement: MerchantAgreement,
    event: FormEvent<HTMLFormElement>,
  ): Promise<void>;
}) {
  return (
    <section aria-labelledby="agreement-history-title">
      <h3 className="text-base font-bold" id="agreement-history-title">
        Agreement history
      </h3>
      {agreements.length === 0 ? (
        <p className="mt-4 leading-7 text-slate-500">
          This merchant has no agreements yet.
        </p>
      ) : (
        <ul className="mt-4 list-none divide-y divide-slate-200 p-0">
          {agreements.map((agreement) => (
            <li className="py-5 first:pt-0" key={agreement.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <strong>
                    {scheduleLabels[agreement.settlementSchedule]}
                  </strong>
                  <p className="mt-1 text-sm text-slate-500">
                    {displayDate(agreement.startDate)} –{' '}
                    {agreement.endDate
                      ? displayDate(agreement.endDate)
                      : 'Open-ended'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[agreement.status]}`}
                >
                  {statusLabels[agreement.status]}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {agreement.fixedRentAmount
                  ? `${peso(agreement.fixedRentAmount)} fixed rent`
                  : 'No fixed rent'}{' '}
                ·{' '}
                {agreement.commissionRate
                  ? `${agreement.commissionRate}% commission`
                  : 'No commission'}
              </p>
              {agreement.status === 'DRAFT' ? (
                <div className="mt-3 flex flex-wrap gap-4">
                  <button
                    className="border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
                    type="button"
                    onClick={() => onEdit(agreement)}
                  >
                    Edit draft
                  </button>
                  <button
                    className="border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3 disabled:opacity-60"
                    type="button"
                    disabled={pendingAgreementId === agreement.id}
                    onClick={() => void onActivate(agreement)}
                  >
                    {pendingAgreementId === agreement.id
                      ? 'Activating…'
                      : 'Activate'}
                  </button>
                </div>
              ) : agreement.status === 'ACTIVE' ? (
                <form
                  className="mt-3 flex flex-wrap items-end gap-3"
                  onSubmit={(event) => void onEnd(agreement, event)}
                >
                  <AgreementField
                    name="endDate"
                    label="Effective end date"
                    type="date"
                    min={dateOnly(agreement.startDate)}
                    max={philippineToday()}
                    required
                    compact
                  />
                  <button
                    className="min-h-10 rounded-[0.6rem] border border-slate-200 bg-white px-3.5 py-2.5 font-bold disabled:opacity-60"
                    type="submit"
                    disabled={pendingAgreementId === agreement.id}
                  >
                    {pendingAgreementId === agreement.id
                      ? 'Ending…'
                      : 'End agreement'}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AgreementField({
  name,
  label,
  type,
  defaultValue,
  hint,
  inputMode,
  min,
  max,
  required = false,
  compact = false,
}: {
  name: 'startDate' | 'endDate' | 'fixedRentAmount' | 'commissionRate';
  label: string;
  type: 'date' | 'text';
  defaultValue?: string;
  hint?: string;
  inputMode?: 'decimal';
  min?: string;
  max?: string;
  required?: boolean;
  compact?: boolean;
}) {
  const id = compact ? `${name}-active` : `agreement-${name}`;
  return (
    <div className={`grid gap-2 ${compact ? 'min-w-44' : ''}`}>
      <label className="text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      <input
        className="min-h-12 rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        min={min}
        max={max}
        required={required}
      />
      {hint ? <small className="text-slate-500">{hint}</small> : null}
    </div>
  );
}
