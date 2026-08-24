'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { ZodError } from 'zod';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { getOrganization } from '@/features/organizations/organization-api';
import { OrganizationNavigation } from '@/features/organizations/organization-navigation';
import type { OrganizationAccess } from '@/features/organizations/organization.types';
import { createBranch, listBranches, updateBranch } from './branch-api';
import { branchSchema } from './branch.schemas';
import type { Branch, BranchInput } from './branch.types';

type BranchField = keyof BranchInput;
type FieldErrors = Partial<Record<BranchField, string>>;

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function fieldErrorsFrom(error: ZodError<BranchInput>): FieldErrors {
  const fields = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, messages?.[0]]),
  ) as FieldErrors;
}

function addressFor(branch: Branch): string {
  return [
    branch.addressLine1,
    branch.addressLine2,
    branch.city,
    branch.province,
    branch.postalCode,
    branch.countryCode,
  ]
    .filter(Boolean)
    .join(', ');
}

export function BranchManagement({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const [organization, setOrganization] = useState<OrganizationAccess | null>(
    null,
  );
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [organizationResult, branchResult] = await Promise.all([
        getOrganization(request, organizationId),
        listBranches(request, organizationId),
      ]);
      setOrganization(organizationResult);
      setBranches(branchResult);
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, request]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getOrganization(request, organizationId),
      listBranches(request, organizationId),
    ])
      .then(([organizationResult, branchResult]) => {
        if (!active) return;
        setOrganization(organizationResult);
        setBranches(branchResult);
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
  }, [organizationId, request]);

  if (isLoading) {
    return (
      <p className="workspace-state" role="status">
        Loading branches…
      </p>
    );
  }

  if (loadError || !organization) {
    return (
      <section className="workspace-state" role="alert">
        <h1>We could not load the branches.</h1>
        <p>{loadError ?? 'The organization could not be loaded.'}</p>
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

  const canManage =
    organization.role === 'OWNER' || organization.role === 'MANAGER';

  function handleSaved(saved: Branch) {
    setSuccessMessage(
      editingBranch
        ? `${saved.name} was updated successfully.`
        : `${saved.name} was added successfully.`,
    );
    setBranches((current) => {
      const exists = current.some((branch) => branch.id === saved.id);
      const next = exists
        ? current.map((branch) => (branch.id === saved.id ? saved : branch))
        : [...current, saved];
      return next.sort((left, right) => left.name.localeCompare(right.name));
    });
    setEditingBranch(null);
  }

  return (
    <section className="branch-workspace" aria-labelledby="branch-title">
      <div className="workspace-heading">
        <div>
          <p className="workspace-context">{organization.name}</p>
          <h1 id="branch-title">Branches</h1>
          <p>
            Manage the physical store locations that belong to this
            organization.
          </p>
        </div>
        <span className="role-badge">{organization.role.toLowerCase()}</span>
      </div>

      <OrganizationNavigation
        organizationId={organizationId}
        active="branches"
        showMembers={canManage}
        showMerchants={canManage}
      />

      {successMessage ? (
        <p className="success-message" role="status">
          {successMessage}
        </p>
      ) : null}

      <div
        className={
          canManage ? 'branch-layout' : 'branch-layout branch-layout-readonly'
        }
      >
        <section className="branch-panel" aria-labelledby="branch-list-title">
          <div className="panel-heading">
            <h2 id="branch-list-title">Store locations</h2>
            <span>{branches.length}</span>
          </div>

          {branches.length === 0 ? (
            <div className="branch-empty">
              <h3>No branches yet</h3>
              <p>
                {canManage
                  ? 'Add the first physical store location using the branch form.'
                  : 'An owner or manager has not added a branch yet.'}
              </p>
            </div>
          ) : (
            <ul className="branch-list">
              {branches.map((branch) => (
                <li key={branch.id}>
                  <div>
                    <div className="branch-name-line">
                      <strong>{branch.name}</strong>
                      {branch.code ? <span>{branch.code}</span> : null}
                    </div>
                    <address>{addressFor(branch)}</address>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSuccessMessage(null);
                        setEditingBranch(branch);
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canManage ? (
          <BranchForm
            key={editingBranch?.id ?? 'new-branch'}
            organizationId={organizationId}
            branch={editingBranch}
            onSaved={handleSaved}
            onCancel={() => setEditingBranch(null)}
          />
        ) : null}
      </div>
    </section>
  );
}

function BranchForm({
  organizationId,
  branch,
  onSaved,
  onCancel,
}: {
  organizationId: string;
  branch: Branch | null;
  onSaved(branch: Branch): void;
  onCancel(): void;
}) {
  const { request } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (branch) headingRef.current?.focus();
  }, [branch]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = branchSchema.safeParse({
      name: formData.get('name'),
      code: formData.get('code'),
      addressLine1: formData.get('addressLine1'),
      addressLine2: formData.get('addressLine2'),
      city: formData.get('city'),
      province: formData.get('province'),
      postalCode: formData.get('postalCode'),
      countryCode: formData.get('countryCode'),
    });

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
      const saved = branch
        ? await updateBranch(request, organizationId, branch.id, {
            ...result.data,
            code: result.data.code ?? null,
            addressLine2: result.data.addressLine2 ?? null,
            postalCode: result.data.postalCode ?? null,
          })
        : await createBranch(request, organizationId, result.data);
      onSaved(saved);
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="branch-panel branch-form-panel"
      aria-labelledby="branch-form-title"
    >
      <div className="panel-heading">
        <h2
          id="branch-form-title"
          ref={headingRef}
          tabIndex={branch ? -1 : undefined}
        >
          {branch ? 'Edit branch' : 'Add a branch'}
        </h2>
      </div>
      <p className="panel-description">
        {branch
          ? 'Update this physical store location.'
          : 'Record a physical store location for this organization.'}
      </p>

      <form className="branch-form" onSubmit={handleSubmit} noValidate>
        {submissionError ? (
          <p className="form-alert" role="alert">
            {submissionError}
          </p>
        ) : null}
        {Object.keys(fieldErrors).length > 0 ? (
          <p className="form-alert" role="alert">
            Review the highlighted fields and try again.
          </p>
        ) : null}

        <div className="branch-form-row">
          <BranchField
            name="name"
            label="Branch name"
            defaultValue={branch?.name}
            error={fieldErrors.name}
            required
          />
          <BranchField
            name="code"
            label="Code"
            hint="Optional, for example MKT-01"
            defaultValue={branch?.code ?? undefined}
            error={fieldErrors.code}
            maxLength={32}
          />
        </div>
        <BranchField
          name="addressLine1"
          label="Address line 1"
          defaultValue={branch?.addressLine1}
          error={fieldErrors.addressLine1}
          maxLength={200}
          required
        />
        <BranchField
          name="addressLine2"
          label="Address line 2"
          hint="Optional unit, floor, or building"
          defaultValue={branch?.addressLine2 ?? undefined}
          error={fieldErrors.addressLine2}
          maxLength={200}
        />
        <div className="branch-form-row">
          <BranchField
            name="city"
            label="City"
            defaultValue={branch?.city}
            error={fieldErrors.city}
            maxLength={100}
            required
          />
          <BranchField
            name="province"
            label="Province or region"
            defaultValue={branch?.province}
            error={fieldErrors.province}
            maxLength={100}
            required
          />
        </div>
        <div className="branch-form-row branch-form-row-compact">
          <BranchField
            name="postalCode"
            label="Postal code"
            defaultValue={branch?.postalCode ?? undefined}
            error={fieldErrors.postalCode}
            maxLength={20}
          />
          <BranchField
            name="countryCode"
            label="Country code"
            hint="ISO two-letter code"
            defaultValue={branch?.countryCode ?? 'PH'}
            error={fieldErrors.countryCode}
            maxLength={2}
            required
          />
        </div>

        <div className="form-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? branch
                ? 'Saving changes…'
                : 'Adding branch…'
              : branch
                ? 'Save changes'
                : 'Add branch'}
          </button>
          {branch ? (
            <button
              className="secondary-button"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function BranchField({
  name,
  label,
  hint,
  error,
  defaultValue,
  maxLength,
  required = false,
}: {
  name: BranchField;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  maxLength?: number;
  required?: boolean;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field">
      <label htmlFor={name}>
        {label}{' '}
        {!required ? <span className="optional-label">Optional</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
      />
      {hint ? (
        <small id={hintId} className="field-hint">
          {hint}
        </small>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
