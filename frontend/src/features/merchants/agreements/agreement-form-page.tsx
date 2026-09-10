'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { BackLink } from '@/components/ui/back-link';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import {
  createMerchantAgreement,
  listOrganizationAgreements,
  listSpaceAvailability,
  updateMerchantAgreement,
} from './merchant-agreement-api';
import { merchantAgreementSchema } from './merchant-agreement.schemas';
import type {
  MerchantAgreement,
  MerchantAgreementInput,
  SpaceAvailability,
} from './merchant-agreement.types';

const inputClass =
  'min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:border-emerald-600 focus:outline-3 focus:outline-offset-2 focus:outline-emerald-100';
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const message = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'The agreement could not be saved.';

export function AgreementFormPage({
  organizationId,
  agreementId,
}: {
  organizationId: string;
  agreementId?: string;
}) {
  const router = useRouter();
  const { request } = useAuth();
  const { organization, merchants, branches, loadMerchants, loadBranches } =
    useOrganizationWorkspaceContext();
  const [agreements, setAgreements] = useState<MerchantAgreement[]>([]);
  const [agreement, setAgreement] = useState<MerchantAgreement | null>(null);
  const [merchantId, setMerchantId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [activationAt, setActivationAt] = useState(today());
  const [duration, setDuration] = useState(12);
  const [spaces, setSpaces] = useState<SpaceAvailability[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadMerchants(),
      loadBranches(),
      listOrganizationAgreements(request, organizationId),
    ])
      .then(([, loadedBranches, loadedAgreements]) => {
        if (!active) return;
        setAgreements(loadedAgreements);
        const current = agreementId
          ? loadedAgreements.find((item) => item.id === agreementId)
          : undefined;
        if (agreementId && (!current || current.status !== 'DRAFT')) {
          setError('Only draft agreements can be edited.');
          return;
        }
        if (current) {
          setAgreement(current);
          setMerchantId(current.merchantId);
          setActivationAt(current.activationAt.slice(0, 10));
          setDuration(current.durationMonths ?? 12);
          setSelected(current.spaceReservations.map((item) => item.spaceId));
          setBranchId(
            current.spaceReservations[0]?.branchId ??
              loadedBranches[0]?.id ??
              '',
          );
        } else setBranchId(loadedBranches[0]?.id ?? '');
      })
      .catch((cause) => setError(message(cause)))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [agreementId, loadBranches, loadMerchants, organizationId, request]);

  useEffect(() => {
    if (!activationAt || !duration) return;
    const timer = window.setTimeout(
      () =>
        void listSpaceAvailability(
          request,
          organizationId,
          activationAt,
          duration,
          agreementId,
        )
          .then(setSpaces)
          .catch((cause) => setError(message(cause))),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [activationAt, agreementId, duration, organizationId, request]);

  const visibleSpaces = spaces.filter((space) => space.branchId === branchId);
  const selectedSpaces = useMemo(
    () =>
      selected
        .map((id) => spaces.find((space) => space.id === id))
        .filter(Boolean) as SpaceAvailability[],
    [selected, spaces],
  );
  const draftCount = agreements.filter(
    (item) =>
      item.merchantId === merchantId &&
      item.status === 'DRAFT' &&
      item.id !== agreementId,
  ).length;
  const backHref = agreementId
    ? `/app/organizations/${organizationId}/agreements/${agreementId}`
    : `/app/organizations/${organizationId}/agreements`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = merchantAgreementSchema.safeParse({
      activationAt,
      durationMonths: duration,
      spaceIds: selected,
      fixedRentAmount: String(data.get('fixedRentAmount') ?? ''),
      commissionRate: String(data.get('commissionRate') ?? ''),
      securityDepositAmount: String(data.get('securityDepositAmount') ?? ''),
      firstRentPaymentRequired: data.get('firstRentPaymentRequired') === 'on',
      rentDueWeek: String(data.get('rentDueWeek') ?? ''),
      rentDueWeekday: String(data.get('rentDueWeekday') ?? ''),
      settlementSchedule: String(data.get('settlementSchedule')),
    });
    if (!merchantId) {
      setError('Select a merchant.');
      return;
    }
    if (draftCount >= 5 && !agreementId) {
      setError('This merchant already has five drafts.');
      return;
    }
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Review the agreement.');
      return;
    }
    const value = parsed.data;
    const input: MerchantAgreementInput = {
      ...value,
      fixedRentAmount: value.fixedRentAmount || undefined,
      commissionRate: value.commissionRate || undefined,
      securityDepositAmount: value.securityDepositAmount || undefined,
      rentDueWeek: value.rentDueWeek || undefined,
      rentDueWeekday: value.rentDueWeekday || undefined,
    };
    setIsSaving(true);
    setError(null);
    try {
      const saved = agreementId
        ? await updateMerchantAgreement(
            request,
            organizationId,
            agreementId,
            input,
          )
        : await createMerchantAgreement(
            request,
            organizationId,
            merchantId,
            input,
          );
      router.push(
        `/app/organizations/${organizationId}/agreements/${saved.id}`,
      );
    } catch (cause) {
      setError(message(cause));
      setIsSaving(false);
    }
  }

  if (!organization || isLoading)
    return (
      <ListSkeleton className="mt-8" label="Loading agreement form" rows={6} />
    );
  return (
    <section className="mx-auto mt-5 w-full max-w-6xl sm:mt-6">
      <BackLink href={backHref}>
        {agreementId ? 'Back to agreement' : 'Back to agreements'}
      </BackLink>
      <header className="mt-5 border-b border-slate-200 pb-4">
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          {agreementId ? 'Edit agreement' : 'Create agreement'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Choose the merchant and selling locations first, then define the
          commercial terms.
        </p>
      </header>
      <form
        className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]"
        onSubmit={save}
        noValidate
      >
        <div className="grid gap-6">
          {error ? (
            <p
              className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <FormSection
            number="1"
            title="Merchant and term"
            description="Set who the agreement belongs to and when occupancy begins."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Merchant" id="agreement-merchant">
                <SelectControl
                  id="agreement-merchant"
                  value={merchantId}
                  disabled={Boolean(agreementId)}
                  onValueChange={setMerchantId}
                >
                  <option value="" disabled>
                    Select a merchant
                  </option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
                </SelectControl>
              </Field>
              <Field label="Activation date" id="agreement-activation">
                <input
                  id="agreement-activation"
                  className={inputClass}
                  type="date"
                  value={activationAt}
                  onChange={(event) => setActivationAt(event.target.value)}
                />
              </Field>
              <Field label="Duration" id="agreement-duration">
                <div className="relative">
                  <input
                    id="agreement-duration"
                    className={`${inputClass} pr-20`}
                    type="number"
                    min="1"
                    max="60"
                    value={duration}
                    onChange={(event) =>
                      setDuration(Number(event.target.value))
                    }
                  />
                  <span className="pointer-events-none absolute top-3.5 right-3 text-sm text-slate-500">
                    months
                  </span>
                </div>
              </Field>
            </div>
          </FormSection>
          <FormSection
            number="2"
            title="Selling locations"
            description="Browse one branch at a time. Selections remain when you move between branches."
          >
            <Field label="Branch" id="agreement-branch">
              <SelectControl
                id="agreement-branch"
                value={branchId}
                onValueChange={setBranchId}
              >
                <option value="" disabled>
                  Select a branch
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.code ? ` (${branch.code})` : ''}
                  </option>
                ))}
              </SelectControl>
            </Field>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {visibleSpaces.length ? (
                visibleSpaces.map((space) => {
                  const chosen = selected.includes(space.id);
                  const disabled = !space.available && !chosen;
                  return (
                    <label
                      key={space.id}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${chosen ? 'border-emerald-500 bg-emerald-50' : disabled ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-55' : 'border-slate-200 hover:border-emerald-300'}`}
                    >
                      <input
                        className="mt-0.5 size-4 accent-emerald-600"
                        type="checkbox"
                        checked={chosen}
                        disabled={disabled}
                        onChange={() =>
                          setSelected((current) =>
                            chosen
                              ? current.filter((id) => id !== space.id)
                              : [...current, space.id],
                          )
                        }
                      />
                      <span>
                        <strong className="block text-sm text-slate-900">
                          {space.code} · {space.name}
                        </strong>
                        <small className="mt-1 block text-slate-500">
                          {disabled
                            ? `Unavailable · ${space.conflictStatus?.toLowerCase()}`
                            : chosen
                              ? 'Selected'
                              : 'Available'}
                        </small>
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500 sm:col-span-2">
                  No spaces are available in this branch for the selected term.
                </p>
              )}
            </div>
          </FormSection>
          <FormSection
            number="3"
            title="Commercial terms"
            description="Add fixed rent, commission, or both."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monthly rent (PHP)" id="fixedRentAmount">
                <input
                  className={inputClass}
                  id="fixedRentAmount"
                  name="fixedRentAmount"
                  inputMode="decimal"
                  placeholder="0.00"
                  defaultValue={agreement?.fixedRentAmount ?? ''}
                />
              </Field>
              <Field label="Commission rate (%)" id="commissionRate">
                <input
                  className={inputClass}
                  id="commissionRate"
                  name="commissionRate"
                  inputMode="decimal"
                  placeholder="0.00"
                  defaultValue={agreement?.commissionRate ?? ''}
                />
              </Field>
              <Field label="Rent collection week" id="rentDueWeek">
                <SelectControl
                  id="rentDueWeek"
                  name="rentDueWeek"
                  defaultValue={agreement?.rentDueWeek ?? 'FIRST'}
                >
                  {['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'LAST'].map(
                    (item) => (
                      <option key={item} value={item}>
                        {item[0] + item.slice(1).toLowerCase()}
                      </option>
                    ),
                  )}
                </SelectControl>
              </Field>
              <Field label="Rent collection day" id="rentDueWeekday">
                <SelectControl
                  id="rentDueWeekday"
                  name="rentDueWeekday"
                  defaultValue={agreement?.rentDueWeekday ?? 'MONDAY'}
                >
                  {[
                    'MONDAY',
                    'TUESDAY',
                    'WEDNESDAY',
                    'THURSDAY',
                    'FRIDAY',
                    'SATURDAY',
                    'SUNDAY',
                  ].map((item) => (
                    <option key={item} value={item}>
                      {item[0] + item.slice(1).toLowerCase()}
                    </option>
                  ))}
                </SelectControl>
              </Field>
              <Field label="Settlement schedule" id="settlementSchedule">
                <SelectControl
                  id="settlementSchedule"
                  name="settlementSchedule"
                  defaultValue={agreement?.settlementSchedule ?? 'MONTHLY'}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="SEMI_MONTHLY">Semi-monthly</option>
                  <option value="MONTHLY">Monthly</option>
                </SelectControl>
              </Field>
            </div>
          </FormSection>
          <FormSection
            number="4"
            title="Approval requirements"
            description="Record any amount that must be collected before approval."
          >
            <Field label="Security deposit (PHP)" id="securityDepositAmount">
              <input
                className={inputClass}
                id="securityDepositAmount"
                name="securityDepositAmount"
                inputMode="decimal"
                placeholder="Optional"
                defaultValue={agreement?.securityDepositAmount ?? ''}
              />
            </Field>
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 p-4">
              <input
                className="mt-1 size-4 accent-emerald-600"
                type="checkbox"
                name="firstRentPaymentRequired"
                defaultChecked={agreement?.firstRentPaymentRequired}
              />
              <span>
                <strong className="block text-sm">
                  Require first rent before approval
                </strong>
                <span className="mt-1 block text-sm text-slate-500">
                  The agreement cannot be approved until it is fully collected.
                </span>
              </span>
            </label>
          </FormSection>
        </div>
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-5">
          <h2 className="font-bold text-slate-950">Draft summary</h2>
          <Summary
            label="Merchant"
            value={
              merchants.find((item) => item.id === merchantId)?.name ??
              'Not selected'
            }
          />
          <Summary
            label="Term"
            value={`${duration || 0} months from ${activationAt || '—'}`}
          />
          <Summary
            label="Selected spaces"
            value={`${selected.length} across ${new Set(selectedSpaces.map((space) => space.branchId)).size} branches`}
          />
          {selectedSpaces.length ? (
            <ul className="mt-2 grid gap-1 text-xs text-slate-500">
              {selectedSpaces.map((space) => (
                <li key={space.id}>
                  {space.branch.name} · {space.code}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            className="mt-5 min-h-12 w-full rounded-lg bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save draft'}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">
            Review and submit the saved draft from its detail page.
          </p>
        </aside>
      </form>
    </section>
  );
}

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <header className="mb-5 flex gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
          {number}
        </span>
        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-slate-700" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
