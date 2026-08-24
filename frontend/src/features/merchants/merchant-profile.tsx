'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { listBranches } from '@/features/branches/branch-api';
import type { Branch } from '@/features/branches/branch.types';
import { getOrganization } from '@/features/organizations/organization-api';
import { OrganizationNavigation } from '@/features/organizations/organization-navigation';
import type { OrganizationAccess } from '@/features/organizations/organization.types';
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
  const [organization, setOrganization] = useState<OrganizationAccess | null>(
    null,
  );
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
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
      const organizationResult = await getOrganization(request, organizationId);
      setOrganization(organizationResult);
      if (
        organizationResult.role === 'OWNER' ||
        organizationResult.role === 'MANAGER'
      ) {
        const [branchResult, merchantResult] = await Promise.all([
          listBranches(request, organizationId),
          merchantId
            ? getMerchant(request, organizationId, merchantId)
            : Promise.resolve(null),
        ]);
        setBranches(branchResult);
        setMerchant(merchantResult);
      }
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [merchantId, organizationId, request]);

  useEffect(() => {
    let active = true;
    void getOrganization(request, organizationId)
      .then(async (organizationResult) => {
        if (!active) return;
        setOrganization(organizationResult);
        if (
          organizationResult.role === 'OWNER' ||
          organizationResult.role === 'MANAGER'
        ) {
          const [branchResult, merchantResult] = await Promise.all([
            listBranches(request, organizationId),
            merchantId
              ? getMerchant(request, organizationId, merchantId)
              : Promise.resolve(null),
          ]);
          if (active) {
            setBranches(branchResult);
            setMerchant(merchantResult);
          }
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
  }, [merchantId, organizationId, request]);

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

  if (isLoading) {
    return (
      <p className="workspace-state" role="status">
        Loading merchant profile…
      </p>
    );
  }

  const canManage =
    organization?.role === 'OWNER' || organization?.role === 'MANAGER';

  if (loadError || !organization || (merchantId && canManage && !merchant)) {
    return (
      <section className="workspace-state" role="alert">
        <h1>We could not load the merchant profile.</h1>
        <p>{loadError ?? 'The merchant could not be loaded.'}</p>
        <button
          className="text-button"
          type="button"
          onClick={() => void load()}
        >
          Try again
        </button>
      </section>
    );
  }

  const title = merchant ? merchant.name : 'Add merchant';

  return (
    <section
      className="merchant-workspace"
      aria-labelledby="merchant-profile-title"
    >
      <Link
        className="back-link"
        href={`/app/organizations/${organizationId}/merchants`}
      >
        ← Merchant directory
      </Link>
      <div className="workspace-heading merchant-profile-heading">
        <div>
          <p className="workspace-context">{organization.name}</p>
          <h1 id="merchant-profile-title">{title}</h1>
          <p>
            {merchant
              ? 'Review the merchant profile and lifecycle status.'
              : 'Create an active merchant profile with complete contact details.'}
          </p>
        </div>
        {merchant ? (
          <span
            className={`status-badge status-${merchant.status.toLowerCase()}`}
          >
            {statusLabels[merchant.status]}
          </span>
        ) : null}
      </div>
      <OrganizationNavigation
        organizationId={organizationId}
        active="merchants"
        showMembers={canManage}
        showMerchants={canManage}
      />

      {!canManage ? (
        <section className="merchant-panel permission-panel">
          <h2>Merchant management is limited</h2>
          <p>Only organization owners and managers can manage merchants.</p>
        </section>
      ) : (
        <>
          {successMessage ? (
            <p className="success-message" role="status">
              {successMessage}
            </p>
          ) : null}
          {submissionError ? (
            <p className="form-alert merchant-action-alert" role="alert">
              {submissionError}
            </p>
          ) : null}
          <div className="merchant-profile-layout">
            {!merchant && branches.length === 0 ? (
              <section className="merchant-panel merchant-branch-prerequisite">
                <h2>Add a branch first</h2>
                <p>
                  A merchant must operate in at least one branch before its
                  profile can be created.
                </p>
                <Link
                  className="text-link"
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
              <div className="merchant-side-panels">
                <BranchAssignmentForm
                  branches={branches}
                  merchant={merchant}
                  isSubmitting={isUpdatingBranches}
                  onSubmit={handleBranchesSubmit}
                />
                <section
                  className="merchant-panel"
                  aria-labelledby="status-title"
                >
                  <h2 id="status-title">Lifecycle status</h2>
                  <p className="panel-description">
                    Ended merchants remain available for historical records.
                  </p>
                  <form
                    className="merchant-status-form"
                    onSubmit={handleStatusSubmit}
                  >
                    <div className="field">
                      <label htmlFor="merchant-status">Status</label>
                      <select
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
                      className="secondary-button"
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
        </>
      )}
    </section>
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
    <section className="merchant-panel" aria-labelledby="profile-form-title">
      <h2 id="profile-form-title">Merchant profile</h2>
      <form className="merchant-form" onSubmit={onSubmit} noValidate>
        {fields.map((field) => {
          const error = fieldErrors[field.name];
          const errorId = `merchant-${field.name}-error`;
          return (
            <div className="field" key={field.name}>
              <label htmlFor={`merchant-${field.name}`}>{field.label}</label>
              <input
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
                <p id={errorId} className="field-error">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
        {!merchant ? (
          <fieldset className="branch-choice-group">
            <legend>Operating branches</legend>
            <p>Select every branch where this merchant currently operates.</p>
            {branches.map((branch) => (
              <label key={branch.id}>
                <input type="checkbox" name="branchIds" value={branch.id} />
                <span>
                  <strong>{branch.name}</strong>
                  {branch.code ? <small>{branch.code}</small> : null}
                </span>
              </label>
            ))}
            {fieldErrors.branchIds ? (
              <p className="field-error">{fieldErrors.branchIds}</p>
            ) : null}
          </fieldset>
        ) : null}
        <button
          className="primary-button"
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
    <section className="merchant-panel" aria-labelledby="branches-title">
      <h2 id="branches-title">Operating branches</h2>
      <p className="panel-description">
        Select one or more branches where this merchant operates.
      </p>
      <form
        className="merchant-branches-form"
        onSubmit={onSubmit}
        key={merchant.branches.map((branch) => branch.id).join(':')}
      >
        <fieldset className="branch-choice-group">
          <legend className="sr-only">Assigned branches</legend>
          {branches.map((branch) => (
            <label key={branch.id}>
              <input
                type="checkbox"
                name="branchIds"
                value={branch.id}
                defaultChecked={assignedIds.has(branch.id)}
              />
              <span>
                <strong>{branch.name}</strong>
                {branch.code ? <small>{branch.code}</small> : null}
              </span>
            </label>
          ))}
        </fieldset>
        <button
          className="secondary-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving branches…' : 'Save branch assignments'}
        </button>
      </form>
    </section>
  );
}
