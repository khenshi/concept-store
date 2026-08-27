'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { ZodError } from 'zod';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import { SpaceAssignmentManagement } from './assignments/space-assignment-management';
import { createSpace, listSpaces, updateSpace } from './space-api';
import { spaceSchema } from './space.schemas';
import type { Space, SpaceInput, SpaceStatus, SpaceType } from './space.types';

type SpaceField = keyof SpaceInput;
type FieldErrors = Partial<Record<SpaceField, string>>;

const typeLabels: Record<SpaceType, string> = {
  RACK: 'Rack',
  SHELF: 'Shelf',
  CABINET: 'Cabinet',
  BOOTH: 'Booth',
  TABLE: 'Table',
  DRAWER: 'Drawer',
  CUSTOM: 'Custom',
};

const statusLabels: Record<SpaceStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

const statusStyles: Record<SpaceStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
};

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function fieldErrorsFrom(error: ZodError<SpaceInput>): FieldErrors {
  const fields = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, messages?.[0]]),
  ) as FieldErrors;
}

export function SpaceManagement({
  organizationId,
  initialBranchId = '',
}: {
  organizationId: string;
  initialBranchId?: string;
}) {
  const { request } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
    branches,
    branchesStatus,
    branchesError,
    loadBranches,
  } = useOrganizationWorkspaceContext();
  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [assignmentSpace, setAssignmentSpace] = useState<Space | null>(null);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  const [spaceLoadError, setSpaceLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const activeBranchId = selectedBranchId || branches[0]?.id || '';

  useEffect(() => {
    if (
      organization &&
      (organization.role === 'OWNER' || organization.role === 'MANAGER') &&
      branchesStatus === 'idle'
    ) {
      void loadBranches().catch(() => undefined);
    }
  }, [branchesStatus, loadBranches, organization]);

  const loadSpaces = useCallback(async () => {
    if (!activeBranchId) {
      setSpaces([]);
      return;
    }
    setIsLoadingSpaces(true);
    setSpaceLoadError(null);
    try {
      setSpaces(await listSpaces(request, organizationId, activeBranchId));
    } catch (cause: unknown) {
      setSpaceLoadError(errorMessage(cause));
    } finally {
      setIsLoadingSpaces(false);
    }
  }, [activeBranchId, organizationId, request]);

  useEffect(() => {
    if (!activeBranchId) return;
    let active = true;
    void listSpaces(request, organizationId, activeBranchId)
      .then((result) => {
        if (active) setSpaces(result);
      })
      .catch((cause: unknown) => {
        if (active) setSpaceLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoadingSpaces(false);
      });
    return () => {
      active = false;
    };
  }, [activeBranchId, organizationId, request]);

  if (organizationStatus === 'loading') {
    return (
      <p className="mx-auto mt-12 w-full max-w-6xl" role="status">
        Loading spaces…
      </p>
    );
  }

  if (organizationStatus === 'error' || !organization) {
    return (
      <section className="mx-auto mt-12 w-full max-w-3xl" role="alert">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          We could not load space management.
        </h1>
        <p className="mt-4 leading-7 text-slate-500">
          {organizationError ?? 'The organization could not be loaded.'}
        </p>
        <button
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-semibold text-emerald-700 underline underline-offset-3"
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
  const selectedBranch = branches.find(
    (branch) => branch.id === activeBranchId,
  );

  function handleSaved(saved: Space) {
    setSuccessMessage(
      editingSpace
        ? `${saved.name} was updated successfully.`
        : `${saved.name} was added successfully.`,
    );
    setSpaces((current) => {
      const exists = current.some((space) => space.id === saved.id);
      const next = exists
        ? current.map((space) => (space.id === saved.id ? saved : space))
        : [...current, saved];
      return next.sort((left, right) => left.name.localeCompare(right.name));
    });
    if (assignmentSpace?.id === saved.id) setAssignmentSpace(saved);
    setEditingSpace(null);
  }

  return (
    <section className="mx-auto mt-8 w-full sm:mt-12">
      <OrganizationPageHeader
        organization={organization}
        title="Spaces"
        description="Organize the racks, shelves, booths, and other physical selling areas available in each branch."
      />

      {!canManage ? (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-bold">Space management is limited</h2>
          <p className="mt-3 leading-7 text-slate-500">
            Only organization owners and managers can manage physical spaces.
          </p>
        </section>
      ) : branchesStatus === 'loading' || branchesStatus === 'idle' ? (
        <SpacePageSkeleton />
      ) : branchesStatus === 'error' ? (
        <section
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
          role="alert"
        >
          <h2 className="text-base font-bold">Branches are unavailable</h2>
          <p className="mt-3 text-slate-500">
            {branchesError ?? 'The branches could not be loaded.'}
          </p>
          <button
            className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
            type="button"
            onClick={() =>
              void loadBranches({ refresh: true }).catch(() => undefined)
            }
          >
            Try again
          </button>
        </section>
      ) : branches.length === 0 ? (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-lg font-bold">Add a branch first</h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-slate-500">
            Every physical space belongs to a branch. Create a store location
            before adding spaces.
          </p>
        </section>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="grid min-w-[min(100%,20rem)] gap-2">
              <label className="text-sm font-semibold" htmlFor="space-branch">
                Branch
              </label>
              <SelectControl
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                id="space-branch"
                value={activeBranchId}
                onValueChange={(value) => {
                  setIsLoadingSpaces(true);
                  setSpaceLoadError(null);
                  setSelectedBranchId(value);
                  setEditingSpace(null);
                  setAssignmentSpace(null);
                  setSuccessMessage(null);
                }}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </SelectControl>
            </div>
            <p className="m-0 text-sm text-slate-500">
              {selectedBranch?.city}, {selectedBranch?.province}
            </p>
          </div>

          {successMessage ? (
            <p
              className="mt-5 rounded-lg border border-green-600 bg-white px-4 py-3 text-sm text-slate-900"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
            <section
              className="rounded-xl border border-slate-200 bg-white p-6"
              aria-labelledby="space-list-title"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold" id="space-list-title">
                    Branch spaces
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedBranch?.name}
                  </p>
                </div>
                <span className="min-w-7 rounded-full bg-emerald-100 px-2 py-1 text-center text-xs font-bold text-emerald-700">
                  {spaces.length}
                </span>
              </div>

              {isLoadingSpaces ? (
                <ListSkeleton
                  className="py-5"
                  label="Loading branch spaces"
                  rowClassName="h-16"
                />
              ) : spaceLoadError ? (
                <RequestError
                  className="py-8 text-center"
                  message={spaceLoadError}
                  onRetry={() => void loadSpaces()}
                />
              ) : spaces.length === 0 ? (
                <div className="py-10 text-center">
                  <h3 className="text-base font-bold">No spaces yet</h3>
                  <p className="mx-auto mt-2 max-w-md leading-7 text-slate-500">
                    Add the first physical selling space using the form.
                  </p>
                </div>
              ) : (
                <ul className="mt-5 list-none divide-y divide-slate-200 p-0">
                  {spaces.map((space) => (
                    <li
                      className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0 max-sm:grid"
                      key={space.id}
                    >
                      <div className="grid gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{space.name}</strong>
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                            {space.code}
                          </span>
                        </div>
                        <p className="m-0 text-sm text-slate-500">
                          {space.type === 'CUSTOM'
                            ? space.customType
                            : typeLabels[space.type]}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 max-sm:justify-between">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[space.status]}`}
                        >
                          {statusLabels[space.status]}
                        </span>
                        <button
                          className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-emerald-700 underline underline-offset-3"
                          type="button"
                          onClick={() => {
                            setSuccessMessage(null);
                            setEditingSpace(space);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-emerald-700 underline underline-offset-3"
                          type="button"
                          onClick={() => {
                            setEditingSpace(null);
                            setAssignmentSpace(space);
                            setSuccessMessage(null);
                          }}
                        >
                          Assignments
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <SpaceForm
              key={editingSpace?.id ?? `new-${activeBranchId}`}
              organizationId={organizationId}
              branchId={activeBranchId}
              space={editingSpace}
              onSaved={handleSaved}
              onCancel={() => setEditingSpace(null)}
            />
          </div>
          {assignmentSpace ? (
            <SpaceAssignmentManagement
              key={assignmentSpace.id}
              organizationId={organizationId}
              space={assignmentSpace}
              onClose={() => setAssignmentSpace(null)}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function SpacePageSkeleton() {
  return (
    <section
      className="mt-6 grid animate-pulse gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]"
      role="status"
      aria-label="Loading branch space management"
      aria-busy="true"
    >
      <div className="h-72 rounded-xl border border-slate-200 bg-white" />
      <div className="h-96 rounded-xl border border-slate-200 bg-white" />
      <span className="sr-only">Loading branches…</span>
    </section>
  );
}

function SpaceForm({
  organizationId,
  branchId,
  space,
  onSaved,
  onCancel,
}: {
  organizationId: string;
  branchId: string;
  space: Space | null;
  onSaved(saved: Space): void;
  onCancel(): void;
}) {
  const { request } = useAuth();
  const [selectedType, setSelectedType] = useState<SpaceType>(
    space?.type ?? 'RACK',
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (space) headingRef.current?.focus();
  }, [space]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = spaceSchema.safeParse({
      code: formData.get('code'),
      name: formData.get('name'),
      type: formData.get('type'),
      customType: formData.get('customType'),
      status: formData.get('status'),
    });

    setSubmissionError(null);
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
      const input = {
        ...result.data,
        customType:
          result.data.type === 'CUSTOM' ? result.data.customType : undefined,
      };
      const saved = space
        ? await updateSpace(request, organizationId, space.id, {
            ...input,
            customType: input.customType ?? null,
          })
        : await createSpace(request, organizationId, branchId, input);
      onSaved(saved);
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-6"
      aria-labelledby="space-form-title"
    >
      <h2
        className="text-base font-bold"
        id="space-form-title"
        ref={headingRef}
        tabIndex={space ? -1 : undefined}
      >
        {space ? 'Edit space' : 'Add a space'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {space
          ? 'Update this space without changing its branch.'
          : 'Create a physical selling area in the selected branch.'}
      </p>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit} noValidate>
        {submissionError ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {submissionError}
          </p>
        ) : null}
        <SpaceTextField
          name="code"
          label="Space code"
          defaultValue={space?.code}
          error={fieldErrors.code}
          hint="For example RACK-A01"
        />
        <SpaceTextField
          name="name"
          label="Space name"
          defaultValue={space?.name}
          error={fieldErrors.name}
        />
        <div className="grid gap-2">
          <label className="text-sm font-semibold" htmlFor="space-type">
            Type
          </label>
          <SelectControl
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
            id="space-type"
            name="type"
            value={selectedType}
            onValueChange={(value) => setSelectedType(value as SpaceType)}
          >
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectControl>
        </div>
        {selectedType === 'CUSTOM' ? (
          <SpaceTextField
            name="customType"
            label="Custom type"
            defaultValue={space?.customType ?? undefined}
            error={fieldErrors.customType}
          />
        ) : (
          <input name="customType" type="hidden" value="" />
        )}
        <div className="grid gap-2">
          <label className="text-sm font-semibold" htmlFor="space-status">
            Status
          </label>
          <SelectControl
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
            id="space-status"
            name="status"
            defaultValue={space?.status ?? 'ACTIVE'}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectControl>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? space
                ? 'Saving…'
                : 'Adding…'
              : space
                ? 'Save changes'
                : 'Add space'}
          </button>
          {space ? (
            <button
              className="min-h-11 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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

function SpaceTextField({
  name,
  label,
  hint,
  defaultValue,
  error,
}: {
  name: 'code' | 'name' | 'customType';
  label: string;
  hint?: string;
  defaultValue?: string;
  error?: string;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold" htmlFor={name}>
        {label}
      </label>
      <input
        className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm aria-invalid:border-red-500"
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        maxLength={name === 'customType' ? 80 : name === 'name' ? 120 : 32}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
      />
      {hint ? (
        <small className="text-xs text-slate-500" id={hintId}>
          {hint}
        </small>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
