'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';
import { buttonStyles } from '@/shared/components/ui/button';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { TextField } from '@/shared/components/ui/text-field';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { createMerchant, updateMerchant } from '../api/merchant-api';
import { merchantFormSchema } from '../model/merchant.schemas';
import type { Merchant, MerchantInput } from '../model/merchant.types';

type MerchantField = keyof MerchantInput;
type FieldErrors = Partial<Record<MerchantField, string>>;

function errorsFrom(error: ZodError<MerchantInput>): FieldErrors {
  const fields = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(fields).map(([field, messages]) => [field, messages?.[0]]),
  ) as FieldErrors;
}

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The merchant profile could not be saved. Please try again.';
}

function sanitizeMerchantInput(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement)) return;
  let value = target.value;
  switch (target.name) {
    case 'code':
      value = value
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .replace(/^-+/, '')
        .replace(/-{2,}/g, '-');
      break;
    case 'email':
      value = value
        .toLowerCase()
        .replace(/\s/g, '')
        .replace(/[^a-z0-9.!#$%&'*+/=?^_`{|}~@-]/g, '');
      break;
    case 'phone':
      value = value.replace(/[^\d+().\-\s]/g, '');
      if (value.includes('+'))
        value = `${value.startsWith('+') ? '+' : ''}${value.replace(/\+/g, '')}`;
      break;
    default:
      return;
  }
  if (target.value !== value) target.value = value;
}

export function MerchantForm({
  organizationId,
  merchant,
  onSaved,
  onCancel,
  onPendingChange,
}: {
  organizationId: string;
  merchant?: Merchant;
  onSaved(merchant: Merchant): void;
  onCancel?(): void;
  onPendingChange?(pending: boolean): void;
}) {
  const { request } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const validationTimers = useRef<Partial<Record<MerchantField, number>>>({});

  useEffect(
    () => () => {
      Object.values(validationTimers.current).forEach((timer) =>
        window.clearTimeout(timer),
      );
    },
    [],
  );

  function valuesFrom(form: HTMLFormElement) {
    const formData = new FormData(form);
    return {
      name: formData.get('name'),
      code: formData.get('code'),
      contactName: formData.get('contactName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
    };
  }

  function validateField(form: HTMLFormElement, name: MerchantField) {
    const result = merchantFormSchema.safeParse(valuesFrom(form));
    const message = result.success ? undefined : errorsFrom(result.error)[name];
    setFieldErrors((current) => {
      const next = { ...current };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }

  function validateChangedField(
    event: FormEvent<HTMLFormElement>,
    immediate = false,
  ) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const name = target.name as MerchantField;
    const form = event.currentTarget;
    const currentTimer = validationTimers.current[name];
    if (currentTimer) window.clearTimeout(currentTimer);
    if (immediate) {
      validateField(form, name);
      return;
    }
    validationTimers.current[name] = window.setTimeout(
      () => validateField(form, name),
      300,
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmissionError(null);
    const form = event.currentTarget;
    const result = merchantFormSchema.safeParse(valuesFrom(form));

    if (!result.success) {
      const errors = errorsFrom(result.error);
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      window.requestAnimationFrame(() => {
        const field = form.elements.namedItem(first);
        if (field instanceof HTMLElement) field.focus();
      });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    onPendingChange?.(true);
    try {
      const saved = merchant
        ? await updateMerchant(request, organizationId, merchant.id, {
            ...result.data,
            code: result.data.code ?? null,
            email: result.data.email ?? null,
          })
        : await createMerchant(request, organizationId, result.data);
      onSaved(saved);
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
      onPendingChange?.(false);
    }
  }

  return (
    <form
      className="mt-6 grid gap-5"
      noValidate
      onBlur={(event) => validateChangedField(event, true)}
      onChange={(event) => {
        sanitizeMerchantInput(event.target);
        validateChangedField(event);
      }}
      onSubmit={handleSubmit}
    >
      <div className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1.5fr)_minmax(10rem,0.5fr)]">
        <MerchantFieldInput
          name="name"
          label="Business name"
          placeholder="e.g. Amihan Trading"
          defaultValue={merchant?.name}
          error={fieldErrors.name}
          maxLength={120}
          required
        />
        <MerchantFieldInput
          name="code"
          label="Code"
          placeholder="e.g. AMI-001"
          hint=""
          defaultValue={merchant?.code ?? undefined}
          error={fieldErrors.code}
          maxLength={32}
        />
      </div>
      <MerchantFieldInput
        name="contactName"
        label="Contact name"
        placeholder="e.g. Mara Santos"
        defaultValue={merchant?.contactName}
        error={fieldErrors.contactName}
        maxLength={120}
        required
      />
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <MerchantFieldInput
          name="email"
          label="Email"
          placeholder="e.g. mara@example.com"
          defaultValue={merchant?.email ?? undefined}
          error={fieldErrors.email}
          maxLength={254}
          type="email"
        />
        <MerchantFieldInput
          name="phone"
          label="Phone"
          placeholder="e.g. +63 917 123 4567"
          hint=""
          defaultValue={merchant?.phone}
          error={fieldErrors.phone}
          maxLength={30}
          type="tel"
          required
        />
      </div>
      {submissionError ? (
        <p className="text-sm text-danger" role="alert">
          {submissionError}
        </p>
      ) : null}
      <ModalActionRow>
        {onCancel ? (
          <button
            className={buttonStyles({ variant: 'quiet' })}
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
        <button
          className={buttonStyles({ variant: 'primary' })}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? 'Saving…'
            : merchant
              ? 'Save changes'
              : 'Create merchant'}
        </button>
      </ModalActionRow>
    </form>
  );
}

function MerchantFieldInput({
  name,
  label,
  placeholder,
  hint,
  error,
  defaultValue,
  maxLength,
  required = false,
  type = 'text',
}: {
  name: MerchantField;
  label: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  maxLength: number;
  required?: boolean;
  type?: 'text' | 'email' | 'tel';
}) {
  return (
    <TextField
      name={name}
      label={
        <>
          {label}
          {!required ? (
            <span className="font-normal text-muted"> (optional)</span>
          ) : null}
        </>
      }
      hint={hint}
      placeholder={placeholder}
      hintPosition="after"
      error={error}
      defaultValue={defaultValue}
      maxLength={maxLength}
      required={required}
      type={type}
      containerClassName="content-start"
    />
  );
}
