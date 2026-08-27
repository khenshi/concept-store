'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import type { Branch } from '@/features/branches/branch.types';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { MerchantAgreementManagement } from './agreements/merchant-agreement-management';
import {
  createMerchant,
  getMerchant,
  updateMerchant,
  updateMerchantBranches,
  updateMerchantStatus,
} from './merchant-api';
import { merchantBranchesSchema, merchantSchema } from './merchant.schemas';
import type { Merchant, MerchantInput, MerchantStatus } from './merchant.types';

type MerchantField = keyof MerchantInput;
type FieldErrors = Partial<Record<MerchantField, string>>;

const statusLabels: Record<MerchantStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  ENDED: 'Ended',
};

const statusStyles: Record<MerchantStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  SUSPENDED: 'bg-amber-100 text-amber-800',
  ENDED: 'bg-slate-200 text-slate-700',
};

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function fieldErrorsFrom(error: ZodError<MerchantInput>): FieldErrors {
  const fields = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, messages?.[0]]),
  ) as FieldErrors;
}

export function MerchantProfile({
  organizationId,
  merchantId,
}: {
  organizationId: string;
  merchantId?: string;
}) {
  const router = useRouter();
  const { request } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
    branches,
    loadBranches,
  } = useOrganizationWorkspaceContext();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingBranches, setIsUpdatingBranches] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [, merchantResult] = await Promise.all([
        loadBranches(),
        merchantId
          ? getMerchant(request, organizationId, merchantId)
          : Promise.resolve(null),
      ]);
      setMerchant(merchantResult);
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [loadBranches, merchantId, organizationId, request]);

  useEffect(() => {
    if (!organization) return;
    if (organization.role !== 'OWNER' && organization.role !== 'MANAGER') {
      return;
    }
    let active = true;
    void Promise.all([
      loadBranches(),
      merchantId
        ? getMerchant(request, organizationId, merchantId)
        : Promise.resolve(null),
    ])
      .then(([, merchantResult]) => {
        if (active) {
          setMerchant(merchantResult);
        }
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
  }, [loadBranches, merchantId, organization, organizationId, request]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = merchantSchema.safeParse({
      name: formData.get('name'),
      code: formData.get('code'),
      contactName: formData.get('contactName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      branchIds: merchant
        ? merchant.branches.map((branch) => branch.id)
        : formData.getAll('branchIds'),
    });

    setSubmissionError(null);
    setSuccessMessage(null);
    if (!result.success) {
      const errors = fieldErrorsFrom(result.error);
      setFieldErrors(errors);
      const firstInvalidField = Object.keys(errors)[0];
      window.requestAnimationFrame(() => {
        const field = form.elements.namedItem(firstInvalidField);
        if (field instanceof HTMLElement) field.focus();
      });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      if (merchant) {
        const profile = {
          name: result.data.name,
          code: result.data.code,
          contactName: result.data.contactName,
          email: result.data.email,
          phone: result.data.phone,
        };
        const updated = await updateMerchant(
          request,
          organizationId,
          merchant.id,
          { ...profile, code: profile.code ?? null },
        );
        setMerchant(updated);
        setSuccessMessage(`${updated.name} was updated successfully.`);
      } else {
        const created = await createMerchant(
          request,
          organizationId,
          result.data,
        );
        router.push(
          `/app/organizations/${organizationId}/merchants/${created.id}`,
        );
      }
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBranchesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!merchant) return;
    const form = event.currentTarget;
    const result = merchantBranchesSchema.safeParse(
      new FormData(form).getAll('branchIds'),
    );
    setSubmissionError(null);
    setSuccessMessage(null);
    if (!result.success) {
      setSubmissionError(result.error.issues[0]?.message ?? 'Select a branch.');
      return;
    }

    setIsUpdatingBranches(true);
    try {
      const updated = await updateMerchantBranches(
        request,
        organizationId,
        merchant.id,
        result.data,
      );
      setMerchant(updated);
      setSuccessMessage(`${updated.name}'s branch assignments were updated.`);
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsUpdatingBranches(false);
    }
  }

  async function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!merchant) return;
    const formData = new FormData(event.currentTarget);
    const status = String(formData.get('status')) as MerchantStatus;
    if (status === merchant.status) return;
    if (
      status === 'ENDED' &&
      !window.confirm(`Mark ${merchant.name} as ended?`)
    ) {
      return;
    }

    setSubmissionError(null);
    setSuccessMessage(null);
    setIsUpdatingStatus(true);
    try {
      const updated = await updateMerchantStatus(
        request,
        organizationId,
        merchant.id,
        status,
      );
      setMerchant(updated);
      setSuccessMessage(
        `${updated.name} is now ${statusLabels[updated.status].toLowerCase()}.`,
      );
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  if (organizationStatus === 'loading') {
    return (
      <p
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-5xl"
        role="status"
      >
        Loading organization…
      </p>
    );
  }

  if (organizationStatus === 'error' || !organization) {
    return (
      <section
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-3xl"
        role="alert"
      >
        <h1 className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]">
          We could not load the organization.
        </h1>
        <p className="mt-4 leading-7 text-slate-500">
          {organizationError ?? 'The organization could not be loaded.'}
        </p>
        <button
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
          type="button"
          onClick={() => void refreshOrganization()}
        >
          Try again
        </button>
      </section>
    );
  }

  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';

  const title = merchant
    ? merchant.name
    : merchantId
      ? 'Merchant profile'
      : 'Add merchant';

  return (
    <section className="mx-auto mt-8 w-full max-w-5xl sm:mt-12">
      <Link
        className="p-0 font-bold text-emerald-700 underline underline-offset-3"
        href={`/app/organizations/${organizationId}/merchants`}
      >
        ← Merchant directory
      </Link>
      <div className="mt-8">
        <OrganizationPageHeader
          organization={organization}
          title={title}
          description={
            merchant
              ? 'Review the merchant profile and lifecycle status.'
              : 'Create an active merchant profile with complete contact details.'
          }
        />
      </div>
      {merchant ? (
        <span
          className={`mt-5 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[merchant.status]}`}
        >
          {statusLabels[merchant.status]}
        </span>
      ) : null}

      {loadError && canManage ? (
        <section
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
          role="alert"
        >
          <h2 className="m-0 text-base font-bold">
            We could not load the merchant profile
          </h2>
          <p className="mt-2 leading-7 text-slate-500">{loadError}</p>
          <button
            className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
            type="button"
            onClick={() => void load()}
          >
            Try again
          </button>
        </section>
      ) : null}

      {!canManage ? (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="m-0 text-base font-bold">
            Merchant management is limited
          </h2>
          <p className="mt-3 leading-7 text-slate-500">
            Only organization owners and managers can manage merchants.
          </p>
        </section>
      ) : loadError ? null : isLoading ? (
        <div
          className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]"
          role="status"
          aria-label="Loading merchant profile"
          aria-busy="true"
        >
          <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
          <span className="sr-only">Loading merchant profile…</span>
        </div>
      ) : merchantId && !merchant ? (
        <section
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
          role="alert"
        >
          <h2 className="m-0 text-base font-bold">Merchant not found</h2>
          <p className="mt-2 leading-7 text-slate-500">
            The merchant could not be loaded.
          </p>
        </section>
      ) : (
        <>
          {successMessage ? (
            <p
              className="mt-6 rounded-lg border border-green-600 bg-white px-4 py-3"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}
          {submissionError ? (
            <p
              className="mt-6 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
              role="alert"
            >
              {submissionError}
            </p>
          ) : null}
          {merchant ? (
            <section
              className="mt-6 grid gap-3 sm:grid-cols-3"
              aria-label="Merchant workflows"
            >
              <ContextLink
                href={`/app/organizations/${organizationId}/products?merchantId=${merchant.id}`}
                title="Products"
                description="Open this merchant’s catalog."
              />
              <ContextLink
                href={`/app/organizations/${organizationId}/inventory?merchantId=${merchant.id}`}
                title="Inventory"
                description="Review this merchant’s branch stock."
              />
              <ContextLink
                href={`/app/organizations/${organizationId}/spaces${merchant.branches[0] ? `?branchId=${merchant.branches[0].id}` : ''}`}
                title="Spaces"
                description="Manage assignments in a participating branch."
              />
            </section>
          ) : null}
          <div className="mt-6 grid items-start gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
            {!merchant && branches.length === 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-6 md:col-span-2">
                <h2 className="m-0 text-base font-bold">Add a branch first</h2>
                <p className="mt-3 leading-7 text-slate-500">
                  A merchant must operate in at least one branch before its
                  profile can be created.
                </p>
                <Link
                  className="font-bold text-emerald-700 underline underline-offset-3"
                  href={`/app/organizations/${organizationId}/branches`}
                >
                  Manage branches
                </Link>
              </section>
            ) : null}
            <MerchantForm
              merchant={merchant}
              branches={branches}
              fieldErrors={fieldErrors}
              isSubmitting={isSubmitting}
              onSubmit={handleProfileSubmit}
            />
            {merchant ? (
              <div className="grid gap-5">
                <BranchAssignmentForm
                  branches={branches}
                  merchant={merchant}
                  isSubmitting={isUpdatingBranches}
                  onSubmit={handleBranchesSubmit}
                />
                <section
                  className="rounded-xl border border-slate-200 bg-white p-6"
                  aria-labelledby="status-title"
                >
                  <h2 className="m-0 text-base font-bold" id="status-title">
                    Lifecycle status
                  </h2>
                  <p className="mt-3 leading-7 text-slate-500">
                    Ended merchants remain available for historical records.
                  </p>
                  <form
                    className="mt-5 grid gap-4"
                    onSubmit={handleStatusSubmit}
                  >
                    <div className="grid gap-2">
                      <label
                        className="text-sm font-bold"
                        htmlFor="merchant-status"
                      >
                        Status
                      </label>
                      <select
                        className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
                        id="merchant-status"
                        name="status"
                        key={merchant.status}
                        defaultValue={merchant.status}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="min-h-10 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-3.5 py-2.5 font-bold disabled:cursor-wait disabled:opacity-65"
                      type="submit"
                      disabled={isUpdatingStatus}
                    >
                      {isUpdatingStatus ? 'Updating status…' : 'Update status'}
                    </button>
                  </form>
                </section>
              </div>
            ) : null}
          </div>
          {merchant ? (
            <MerchantAgreementManagement
              organizationId={organizationId}
              merchantId={merchant.id}
              merchantName={merchant.name}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function ContextLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      className="rounded-xl border border-slate-200 bg-white p-4 no-underline transition hover:border-emerald-300 hover:shadow-sm"
      href={href}
    >
      <span className="font-bold text-slate-950">
        {title}{' '}
        <span className="text-emerald-600" aria-hidden="true">
          →
        </span>
      </span>
      <span className="mt-1 block text-sm leading-6 text-slate-500">
        {description}
      </span>
    </Link>
  );
}

function MerchantForm({
  merchant,
  branches,
  fieldErrors,
  isSubmitting,
  onSubmit,
}: {
  merchant: Merchant | null;
  branches: Branch[];
  fieldErrors: FieldErrors;
  isSubmitting: boolean;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
}) {
  const fields: Array<{
    name: MerchantField;
    label: string;
    type: string;
    value: string;
    maxLength: number;
    autoComplete?: string;
  }> = [
    {
      name: 'name',
      label: 'Merchant name',
      type: 'text',
      value: merchant?.name ?? '',
      maxLength: 120,
      autoComplete: 'organization',
    },
    {
      name: 'code',
      label: 'Merchant code (optional)',
      type: 'text',
      value: merchant?.code ?? '',
      maxLength: 32,
    },
    {
      name: 'contactName',
      label: 'Contact name',
      type: 'text',
      value: merchant?.contactName ?? '',
      maxLength: 120,
      autoComplete: 'name',
    },
    {
      name: 'email',
      label: 'Contact email',
      type: 'email',
      value: merchant?.email ?? '',
      maxLength: 254,
      autoComplete: 'email',
    },
    {
      name: 'phone',
      label: 'Contact phone',
      type: 'tel',
      value: merchant?.phone ?? '',
      maxLength: 25,
      autoComplete: 'tel',
    },
  ];

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-6"
      aria-labelledby="profile-form-title"
    >
      <h2 className="m-0 text-base font-bold" id="profile-form-title">
        Merchant profile
      </h2>
      <form className="mt-5 grid gap-4" onSubmit={onSubmit} noValidate>
        {fields.map((field) => {
          const error = fieldErrors[field.name];
          const errorId = `merchant-${field.name}-error`;
          return (
            <div className="grid gap-2" key={field.name}>
              <label
                className="text-sm font-bold"
                htmlFor={`merchant-${field.name}`}
              >
                {field.label}
              </label>
              <input
                className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-invalid:border-red-600"
                id={`merchant-${field.name}`}
                name={field.name}
                type={field.type}
                defaultValue={field.value}
                maxLength={field.maxLength}
                autoComplete={field.autoComplete}
                required={field.name !== 'code'}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
              {error ? (
                <p id={errorId} className="m-0 text-sm text-red-600">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
        {!merchant ? (
          <fieldset className="grid gap-3 border-0 p-0">
            <legend className="mb-2 text-sm font-bold">
              Operating branches
            </legend>
            <p className="m-0 text-sm leading-6 text-slate-500">
              Select every branch where this merchant currently operates.
            </p>
            {branches.map((branch) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-[0.6rem] border border-slate-200 p-3 has-checked:border-emerald-600 has-checked:bg-emerald-50"
                key={branch.id}
              >
                <input
                  className="mt-1 accent-emerald-600"
                  type="checkbox"
                  name="branchIds"
                  value={branch.id}
                />
                <span className="grid gap-1">
                  <strong>{branch.name}</strong>
                  {branch.code ? (
                    <small className="text-slate-500">{branch.code}</small>
                  ) : null}
                </span>
              </label>
            ))}
            {fieldErrors.branchIds ? (
              <p className="m-0 text-sm text-red-600">
                {fieldErrors.branchIds}
              </p>
            ) : null}
          </fieldset>
        ) : null}
        <button
          className="w-fit min-h-11 cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
          type="submit"
          disabled={isSubmitting || (!merchant && branches.length === 0)}
        >
          {isSubmitting
            ? merchant
              ? 'Saving changes…'
              : 'Creating merchant…'
            : merchant
              ? 'Save changes'
              : 'Create merchant'}
        </button>
      </form>
    </section>
  );
}

function BranchAssignmentForm({
  branches,
  merchant,
  isSubmitting,
  onSubmit,
}: {
  branches: Branch[];
  merchant: Merchant;
  isSubmitting: boolean;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
}) {
  const assignedIds = new Set(merchant.branches.map((branch) => branch.id));
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-6"
      aria-labelledby="branches-title"
    >
      <h2 className="m-0 text-base font-bold" id="branches-title">
        Operating branches
      </h2>
      <p className="mt-3 leading-7 text-slate-500">
        Select one or more branches where this merchant operates.
      </p>
      <form
        className="mt-5 grid gap-4"
        onSubmit={onSubmit}
        key={merchant.branches.map((branch) => branch.id).join(':')}
      >
        <fieldset className="grid gap-3 border-0 p-0">
          <legend className="sr-only">Assigned branches</legend>
          {branches.map((branch) => (
            <label
              className="flex cursor-pointer items-start gap-3 rounded-[0.6rem] border border-slate-200 p-3 has-checked:border-emerald-600 has-checked:bg-emerald-50"
              key={branch.id}
            >
              <input
                className="mt-1 accent-emerald-600"
                type="checkbox"
                name="branchIds"
                value={branch.id}
                defaultChecked={assignedIds.has(branch.id)}
              />
              <span className="grid gap-1">
                <strong>{branch.name}</strong>
                {branch.code ? (
                  <small className="text-slate-500">{branch.code}</small>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
        <button
          className="min-h-10 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-3.5 py-2.5 font-bold disabled:cursor-wait disabled:opacity-65"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving branches…' : 'Save branch assignments'}
        </button>
      </form>
    </section>
  );
}
