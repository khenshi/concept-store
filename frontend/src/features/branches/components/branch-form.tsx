'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type FocusEventHandler,
  type FormEvent,
} from 'react';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { Button } from '@/shared/components/ui/button';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { createBranch, updateBranch } from '../api/branch-api';
import { branchSchema } from '../model/branch.schemas';
import type { Branch, BranchInput } from '../model/branch.types';

type FieldErrors = Partial<Record<keyof BranchInput, string>>;
const liveValidationDelay = 300;
const requiredBranchFields: readonly (keyof BranchInput)[] = [
  'name',
  'addressLine1',
  'city',
  'province',
  'countryCode',
];

function readBranchForm(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    name: data.get('name'),
    code: data.get('code'),
    addressLine1: data.get('addressLine1'),
    addressLine2: data.get('addressLine2'),
    city: data.get('city'),
    province: data.get('province'),
    postalCode: data.get('postalCode'),
    countryCode: data.get('countryCode'),
  };
}

function fieldErrorFor(form: HTMLFormElement, field: keyof BranchInput) {
  const result = branchSchema.safeParse(readBranchForm(form));
  return result.success
    ? undefined
    : result.error.flatten().fieldErrors[field]?.[0];
}

function hasRequiredBranchValues(form: HTMLFormElement | null) {
  if (!form) return false;
  return requiredBranchFields.every((field) => {
    const control = form.elements.namedItem(field);
    return control instanceof HTMLInputElement && control.value.trim() !== '';
  });
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
  const [hasRequiredValues, setHasRequiredValues] = useState(Boolean(branch));
  const validationTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(validationTimer.current), []);

  function updateFieldError(form: HTMLFormElement, field: keyof BranchInput) {
    const error = fieldErrorFor(form, field);
    setFieldErrors((current) => {
      if (current[field] === error) return current;
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  function validateField(
    field: keyof BranchInput,
    form: HTMLFormElement | null,
    immediate = false,
  ) {
    window.clearTimeout(validationTimer.current);
    if (!form) return;
    if (immediate) {
      updateFieldError(form, field);
      return;
    }
    validationTimer.current = window.setTimeout(
      () => updateFieldError(form, field),
      liveValidationDelay,
    );
  }

  function handleFieldChange(
    field: keyof BranchInput,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setSubmissionError(null);
    setHasRequiredValues(hasRequiredBranchValues(event.currentTarget.form));
    validateField(field, event.currentTarget.form);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmissionError(null);
    const form = event.currentTarget;
    window.clearTimeout(validationTimer.current);
    const result = branchSchema.safeParse(readBranchForm(form));
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
    <FormDialog
      title={branch ? 'Edit branch' : 'Add a branch'}
      description={
        branch
          ? 'Update this physical store location.'
          : 'Record a physical store location for this organization.'
      }
      size="form"
      pending={isSubmitting}
      onClose={onCancel}
    >
      <form
        aria-label={branch ? 'Edit branch' : 'Add branch'}
        className="mt-6 grid gap-6"
        onSubmit={handleSubmit}
        noValidate
      >
        <fieldset className="grid min-w-0 gap-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.5fr)]">
            <BranchField
              name="name"
              label="Branch name"
              placeholder="e.g. Amihan Makati"
              defaultValue={branch?.name}
              hint=""
              error={fieldErrors.name}
              maxLength={120}
              required
              onChange={(event) => handleFieldChange('name', event)}
              onBlur={(event) =>
                validateField('name', event.currentTarget.form, true)
              }
            />
            <BranchField
              name="code"
              label="Code"
              placeholder="e.g. MAK"
              hint=""
              defaultValue={branch?.code ?? undefined}
              error={fieldErrors.code}
              maxLength={32}
              onChange={(event) => handleFieldChange('code', event)}
              onBlur={(event) =>
                validateField('code', event.currentTarget.form, true)
              }
            />
          </div>
        </fieldset>
        <fieldset className="grid min-w-0 gap-4 border-t border-hairline pt-5">
          <legend className="text-sm font-semibold text-ink">Address</legend>
          <BranchField
            name="addressLine1"
            label="Address line 1"
            placeholder="e.g. 123 Example Street"
            hint=""
            defaultValue={branch?.addressLine1}
            error={fieldErrors.addressLine1}
            maxLength={200}
            required
            onChange={(event) => handleFieldChange('addressLine1', event)}
            onBlur={(event) =>
              validateField('addressLine1', event.currentTarget.form, true)
            }
          />
          <BranchField
            name="addressLine2"
            label="Address line 2"
            placeholder="e.g. 2nd floor"
            hint=""
            defaultValue={branch?.addressLine2 ?? undefined}
            error={fieldErrors.addressLine2}
            maxLength={200}
            onChange={(event) => handleFieldChange('addressLine2', event)}
            onBlur={(event) =>
              validateField('addressLine2', event.currentTarget.form, true)
            }
          />
        </fieldset>
        <fieldset className="grid min-w-0 gap-4 border-t border-hairline pt-5">
          <legend className="text-sm font-semibold text-ink">
            Location details
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <BranchField
              name="city"
              label="City"
              placeholder="e.g. Makati"
              hint=""
              defaultValue={branch?.city}
              error={fieldErrors.city}
              maxLength={100}
              required
              onChange={(event) => handleFieldChange('city', event)}
              onBlur={(event) =>
                validateField('city', event.currentTarget.form, true)
              }
            />
            <BranchField
              name="province"
              label="Province or region"
              placeholder="e.g. Metro Manila"
              hint=""
              defaultValue={branch?.province}
              error={fieldErrors.province}
              maxLength={100}
              required
              onChange={(event) => handleFieldChange('province', event)}
              onBlur={(event) =>
                validateField('province', event.currentTarget.form, true)
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)]">
            <BranchField
              name="postalCode"
              label="Postal code"
              placeholder="e.g. 1200"
              hint=""
              defaultValue={branch?.postalCode ?? undefined}
              error={fieldErrors.postalCode}
              maxLength={20}
              onChange={(event) => handleFieldChange('postalCode', event)}
              onBlur={(event) =>
                validateField('postalCode', event.currentTarget.form, true)
              }
            />
            <BranchField
              name="countryCode"
              label="Country code"
              placeholder="e.g. PH"
              hint=""
              defaultValue={branch?.countryCode ?? 'PH'}
              error={fieldErrors.countryCode}
              maxLength={2}
              required
              onChange={(event) => handleFieldChange('countryCode', event)}
              onBlur={(event) =>
                validateField('countryCode', event.currentTarget.form, true)
              }
            />
          </div>
        </fieldset>
        {submissionError ? (
          <p role="alert" className="text-sm text-danger">
            {submissionError}
          </p>
        ) : null}
        <ModalActionRow>
          <Button
            className="w-full sm:w-auto"
            variant="quiet"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="w-full sm:w-auto"
            type="submit"
            pending={isSubmitting}
            disabled={!hasRequiredValues}
            pendingLabel={branch ? 'Saving changes…' : 'Adding branch…'}
          >
            {branch ? 'Save' : 'Add'}
          </Button>
        </ModalActionRow>
      </form>
    </FormDialog>
  );
}

function BranchField({
  name,
  label,
  placeholder,
  hint,
  error,
  defaultValue,
  maxLength,
  required = false,
  onChange,
  onBlur,
}: {
  name: keyof BranchInput;
  label: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  maxLength?: number;
  required?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
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
      placeholder={placeholder}
      hint={hint}
      hintPosition="after"
      error={error}
      defaultValue={defaultValue}
      maxLength={maxLength}
      required={required}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
}
