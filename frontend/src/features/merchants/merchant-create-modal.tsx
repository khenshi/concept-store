'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import type { Branch } from '@/features/branches/branch.types';
import { createMerchant } from './merchant-api';
import { merchantSchema } from './merchant.schemas';
import type { Merchant, MerchantInput } from './merchant.types';

type MerchantField = keyof MerchantInput;
type FieldErrors = Partial<Record<MerchantField, string>>;

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The merchant could not be created. Please try again.';
}

function fieldErrorsFrom(error: ZodError<MerchantInput>): FieldErrors {
  const fields = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, messages?.[0]]),
  ) as FieldErrors;
}

export function MerchantCreateModal({
  organizationId,
  branches,
  onCreated,
  onCancel,
}: {
  organizationId: string;
  branches: Branch[];
  onCreated(merchant: Merchant): void;
  onCancel(): void;
}) {
  const { request } = useAuth();
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) onCancel();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSubmitting, onCancel]);

  function addBranch(branchId: string) {
    if (!branchId) return;
    setSelectedBranchIds((current) =>
      current.includes(branchId) ? current : [...current, branchId],
    );
    setFieldErrors((current) => ({ ...current, branchIds: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = merchantSchema.safeParse({
      name: formData.get('name'),
      code: formData.get('code'),
      contactName: formData.get('contactName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      branchIds: selectedBranchIds,
    });

    setSubmissionError(null);
    if (!result.success) {
      const errors = fieldErrorsFrom(result.error);
      setFieldErrors(errors);
      const firstInvalidField = Object.keys(errors)[0];
      window.requestAnimationFrame(() => {
        const field =
          firstInvalidField === 'branchIds'
            ? document.getElementById('create-merchant-branch')
            : form.elements.namedItem(firstInvalidField);
        if (field instanceof HTMLElement) field.focus();
      });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      onCreated(await createMerchant(request, organizationId, result.data));
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableBranches = branches.filter(
    (branch) => !selectedBranchIds.includes(branch.id),
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-merchant-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <section className="my-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2
          className="text-xl font-bold tracking-tight text-slate-950"
          id="create-merchant-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Add merchant
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Create the merchant profile and choose every branch where it currently
          operates.
        </p>
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
          {submissionError ? (
            <p
              className="rounded-lg border border-red-600 p-3 text-sm text-red-600"
              role="alert"
            >
              {submissionError}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <MerchantField
              label="Merchant name"
              name="name"
              error={fieldErrors.name}
              required
            />
            <MerchantField
              label="Merchant code"
              name="code"
              error={fieldErrors.code}
            />
            <MerchantField
              label="Contact name"
              name="contactName"
              error={fieldErrors.contactName}
              required
            />
            <MerchantField
              label="Contact email"
              name="email"
              type="email"
              error={fieldErrors.email}
              required
            />
            <MerchantField
              label="Contact phone"
              name="phone"
              type="tel"
              error={fieldErrors.phone}
              required
            />
          </div>
          <div className="grid gap-2">
            <label
              className="text-sm font-bold"
              htmlFor="create-merchant-branch"
            >
              Operating branches
            </label>
            <SelectControl
              id="create-merchant-branch"
              value=""
              disabled={availableBranches.length === 0}
              aria-invalid={Boolean(fieldErrors.branchIds)}
              onValueChange={addBranch}
            >
              <option value="" disabled>
                {availableBranches.length
                  ? 'Select a branch'
                  : 'All branches selected'}
              </option>
              {availableBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.code ? ` (${branch.code})` : ''}
                </option>
              ))}
            </SelectControl>
            {selectedBranchIds.length ? (
              <div
                className="mt-1 flex flex-wrap gap-2"
                aria-label="Selected branches"
              >
                {selectedBranchIds.map((branchId) => {
                  const branch = branches.find((item) => item.id === branchId);
                  if (!branch) return null;
                  return (
                    <span
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 py-1.5 pr-2 pl-3 text-sm font-semibold text-emerald-800"
                      key={branch.id}
                    >
                      {branch.name}
                      <button
                        className="grid size-6 place-items-center rounded-full border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        type="button"
                        aria-label={`Remove ${branch.name}`}
                        onClick={() =>
                          setSelectedBranchIds((current) =>
                            current.filter((id) => id !== branch.id),
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No branches selected yet.
              </p>
            )}
            {fieldErrors.branchIds ? (
              <p className="text-sm text-red-600">{fieldErrors.branchIds}</p>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-3">
            <button
              className="min-h-11 rounded-[0.6rem] border border-slate-200 bg-white px-4 font-bold"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-4 font-bold text-white disabled:opacity-60"
              type="submit"
              disabled={isSubmitting || branches.length === 0}
            >
              {isSubmitting ? 'Creating merchant…' : 'Create merchant'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MerchantField({
  label,
  name,
  type = 'text',
  error,
  required = false,
}: {
  label: string;
  name: Exclude<MerchantField, 'branchIds'>;
  type?: 'text' | 'email' | 'tel';
  error?: string;
  required?: boolean;
}) {
  const id = `create-merchant-${name}`;
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold" htmlFor={id}>
        {label}
        {required ? '' : ' (optional)'}
      </label>
      <input
        className="min-h-11 rounded-[0.6rem] border border-slate-200 px-3 aria-invalid:border-red-600"
        id={id}
        name={name}
        type={type}
        maxLength={
          name === 'code'
            ? 32
            : name === 'phone'
              ? 25
              : name === 'email'
                ? 254
                : 120
        }
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p className="text-sm text-red-600" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
