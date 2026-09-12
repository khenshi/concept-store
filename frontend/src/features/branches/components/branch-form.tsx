'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { Button } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { createBranch, updateBranch } from '../api/branch-api';
import { branchSchema } from '../model/branch.schemas';
import type { Branch, BranchInput } from '../model/branch.types';

type FieldErrors = Partial<Record<keyof BranchInput, string>>;

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    headingRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmissionError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = branchSchema.safeParse({
      name: data.get('name'),
      code: data.get('code'),
      addressLine1: data.get('addressLine1'),
      addressLine2: data.get('addressLine2'),
      city: data.get('city'),
      province: data.get('province'),
      postalCode: data.get('postalCode'),
      countryCode: data.get('countryCode'),
    });
    if (!result.success) {
      setFieldErrors(
        Object.fromEntries(
          Object.entries(result.error.flatten().fieldErrors).map(
            ([field, messages]) => [field, messages?.[0]],
          ),
        ) as FieldErrors,
      );
      focusFirstInvalidField(form);
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
      setSubmissionError(
        cause instanceof ApiError
          ? cause.message
          : 'The request could not be completed. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${dialogId}-title`}
      aria-describedby={`${dialogId}-description`}
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onCancel();
      }}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || isSubmitting) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onCancel();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto rounded-panel border border-hairline bg-surface p-6 text-ink shadow-overlay backdrop:bg-ink/40 sm:p-8"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        id={`${dialogId}-title`}
        className="text-xl font-semibold tracking-tight"
      >
        {branch ? 'Edit branch' : 'Add a branch'}
      </h2>
      <p
        id={`${dialogId}-description`}
        className="mt-3 text-sm leading-6 text-muted"
      >
        {branch
          ? 'Update this physical store location.'
          : 'Record a physical store location for this organization.'}
      </p>
      <form
        aria-label={branch ? 'Edit branch' : 'Add branch'}
        className="mt-6 grid gap-5"
        onSubmit={handleSubmit}
        noValidate
      >
        {submissionError ? (
          <Notice tone="error">{submissionError}</Notice>
        ) : null}
        {Object.keys(fieldErrors).length > 0 ? (
          <Notice tone="error">
            Review the highlighted fields and try again.
          </Notice>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.5fr)]">
          <BranchField
            name="name"
            label="Branch name"
            defaultValue={branch?.name}
            error={fieldErrors.name}
            maxLength={120}
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
        <div className="flex flex-wrap justify-end gap-3 border-t border-hairline pt-5">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            pending={isSubmitting}
            pendingLabel={branch ? 'Saving changes…' : 'Adding branch…'}
          >
            {branch ? 'Save changes' : 'Add branch'}
          </Button>
        </div>
      </form>
    </dialog>
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
  name: keyof BranchInput;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <TextField
      id={name}
      name={name}
      label={
        <>
          {label}
          {!required ? (
            <span className="ml-2 font-normal text-muted">Optional</span>
          ) : null}
        </>
      }
      type="text"
      hint={hint}
      hintPosition="before"
      error={error}
      defaultValue={defaultValue}
      maxLength={maxLength}
      required={required}
    />
  );
}
