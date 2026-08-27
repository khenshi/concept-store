'use client';

import { useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { changePasswordSchema } from './account.schemas';

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';
type FieldErrors = Partial<Record<PasswordField, string>>;

export function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = changePasswordSchema.safeParse({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    });
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      setFieldErrors({
        currentPassword: fields.currentPassword?.[0],
        newPassword: fields.newPassword?.[0],
        confirmPassword: fields.confirmPassword?.[0],
      });
      return;
    }

    setFieldErrors({});
    setError(null);
    setIsSaving(true);
    try {
      await changePassword({
        currentPassword: result.data.currentPassword,
        newPassword: result.data.newPassword,
      });
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Your password could not be changed. Please try again.',
      );
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <h2 className="text-lg font-bold text-slate-900">Password</h2>
        <p className="mt-1 text-sm text-slate-500">
          Changing your password signs you out on every device.
        </p>
      </div>

      <form className="grid gap-5 p-5 sm:p-6" onSubmit={submit} noValidate>
        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <PasswordFieldControl
          name="currentPassword"
          label="Current password"
          autoComplete="current-password"
          error={fieldErrors.currentPassword}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordFieldControl
            name="newPassword"
            label="New password"
            autoComplete="new-password"
            error={fieldErrors.newPassword}
            hint="Use at least 12 characters."
          />
          <PasswordFieldControl
            name="confirmPassword"
            label="Confirm new password"
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
          />
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-5">
          <button
            className="min-h-11 rounded-[0.65rem] border-0 bg-slate-900 px-5 font-bold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? 'Changing password…' : 'Change password'}
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordFieldControl({
  name,
  label,
  autoComplete,
  error,
  hint,
}: {
  name: PasswordField;
  label: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const describedBy = error
    ? `${name}-error`
    : hint
      ? `${name}-hint`
      : undefined;
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-slate-800" htmlFor={name}>
        {label}
      </label>
      <input
        className="min-h-12 rounded-[0.6rem] border border-slate-200 bg-white px-3 text-slate-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-invalid:border-red-600"
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        maxLength={128}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      {error ? (
        <p className="text-sm text-red-600" id={`${name}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500" id={`${name}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
