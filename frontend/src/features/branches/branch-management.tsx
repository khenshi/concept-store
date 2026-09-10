'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import {
  OperationalPage,
  OperationalPanel,
  StatusNotice,
} from '@/components/ui/operational-page';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { useDebouncedValue } from '@/components/ui/use-debounced-value';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { createBranch, updateBranch } from './branch-api';
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
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
    branches,
    branchesStatus,
    branchesError,
    loadBranches,
    upsertBranch,
  } = useOrganizationWorkspaceContext();
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    if (branchesStatus === 'idle') {
      void loadBranches().catch(() => undefined);
    }
  }, [branchesStatus, loadBranches]);

  const locations = useMemo(
    () =>
      [
        ...new Set(
          branches.map((branch) => `${branch.city}, ${branch.province}`),
        ),
      ].sort(),
    [branches],
  );
  const visibleBranches = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return branches.filter((branch) => {
      const branchLocation = `${branch.city}, ${branch.province}`;
      return (
        (!location || branchLocation === location) &&
        (!query ||
          `${branch.name} ${branch.code ?? ''} ${addressFor(branch)}`
            .toLowerCase()
            .includes(query))
      );
    });
  }, [branches, debouncedSearch, location]);

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

  function handleSaved(saved: Branch) {
    setSuccessMessage(
      editingBranch
        ? `${saved.name} was updated successfully.`
        : `${saved.name} was added successfully.`,
    );
    upsertBranch(saved);
    setEditingBranch(null);
    setShowBranchForm(false);
  }

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Branches"
        description="Manage the physical store locations that belong to this organization."
      />

      {successMessage ? <StatusNotice>{successMessage}</StatusNotice> : null}

      <div>
        <OperationalPanel
          title="Store locations"
          description={`${visibleBranches.length} matching branches · Open a branch to review its details and activity`}
          action={
            canManage ? (
              <button
                className="min-h-11 cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 font-bold text-white hover:bg-emerald-700"
                type="button"
                onClick={() => {
                  setEditingBranch(null);
                  setSuccessMessage(null);
                  setShowBranchForm(true);
                }}
              >
                Add branch
              </button>
            ) : null
          }
        >
          {branchesStatus === 'loading' || branchesStatus === 'idle' ? (
            <div className="px-5 pb-5 sm:px-6">
              <ListSkeleton label="Loading branches" />
            </div>
          ) : branchesError ? (
            <RequestError
              className="py-8"
              title="Branches unavailable"
              message={branchesError}
              onRetry={() => void loadBranches({ refresh: true })}
            />
          ) : branches.length === 0 ? (
            <div className="px-5 py-10 text-center sm:px-6">
              <h3 className="m-0 text-base font-bold">No branches yet</h3>
              <p className="mx-auto mt-2 max-w-md leading-7 text-slate-500">
                {canManage
                  ? 'Add the first physical store location to establish this organization.'
                  : 'An owner or manager has not added a branch yet.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.4fr)] sm:px-6">
                <label className="grid gap-2 text-sm font-bold">
                  Search
                  <input
                    className="min-h-11 rounded-lg border border-slate-200 bg-white px-3"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Name, code, or address"
                    type="search"
                    value={search}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Location
                  <SelectControl value={location} onValueChange={setLocation}>
                    <option value="">All locations</option>
                    {locations.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectControl>
                </label>
              </div>
              {visibleBranches.length === 0 ? (
                <p className="px-6 py-10 text-center text-slate-500">
                  No branches match these filters.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-6 py-3">Branch</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Address</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {visibleBranches.map((branch) => (
                        <tr key={branch.id}>
                          <td className="px-6 py-4 font-bold">{branch.name}</td>
                          <td className="px-4 py-4 text-slate-600">
                            {branch.code ?? '—'}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {addressFor(branch)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link
                              className="font-bold text-emerald-700 no-underline hover:text-emerald-800"
                              href={`/app/organizations/${organizationId}/branches/${branch.id}`}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </OperationalPanel>
      </div>
      {canManage && (showBranchForm || editingBranch) ? (
        <BranchForm
          key={editingBranch?.id ?? 'new-branch'}
          organizationId={organizationId}
          branch={editingBranch}
          onSaved={handleSaved}
          onCancel={() => {
            setEditingBranch(null);
            setShowBranchForm(false);
          }}
        />
      ) : null}
    </OperationalPage>
  );
}

export function BranchForm({
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
    headingRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) onCancel();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onCancel]);

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
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <section
        className="my-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        aria-labelledby="branch-form-title"
        aria-modal="true"
        role="dialog"
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id="branch-form-title"
            className="m-0 text-base font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100"
            ref={headingRef}
            tabIndex={-1}
          >
            {branch ? 'Edit branch' : 'Add a branch'}
          </h2>
        </div>
        <p className="mt-4 leading-7 text-slate-500">
          {branch
            ? 'Update this physical store location.'
            : 'Record a physical store location for this organization.'}
        </p>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit} noValidate>
          {submissionError ? (
            <p
              className="m-0 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
              role="alert"
            >
              {submissionError}
            </p>
          ) : null}
          {Object.keys(fieldErrors).length > 0 ? (
            <p
              className="m-0 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
              role="alert"
            >
              Review the highlighted fields and try again.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.5fr)]">
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
          <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)]">
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="w-fit min-h-11 cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
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
            <button
              className="min-h-10 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-3.5 py-2.5 font-bold text-slate-900 disabled:cursor-wait disabled:opacity-65"
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
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
    <div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor={name}>
        {label}{' '}
        {!required ? (
          <span className="font-normal text-slate-500">Optional</span>
        ) : null}
      </label>
      <input
        className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-invalid:border-red-600"
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
        <small id={hintId} className="text-sm text-slate-500">
          {hint}
        </small>
      ) : null}
      {error ? (
        <p id={errorId} className="m-0 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
