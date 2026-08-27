'use client';

import { useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { updateProfileSchema } from './account.schemas';

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'phone', string>>;

export function AccountSettings() {
  const { user, updateProfile } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = updateProfileSchema.safeParse({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      phone: formData.get('phone'),
    });
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      setFieldErrors({
        firstName: fields.firstName?.[0],
        lastName: fields.lastName?.[0],
        phone: fields.phone?.[0],
      });
      return;
    }

    setFieldErrors({});
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      await updateProfile(result.data);
      setSuccess('Your profile has been updated.');
    } catch (cause: unknown) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Your profile could not be updated. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-7 lg:py-10">
      <header>
        <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
          Account
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Profile settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Keep your personal details current across your organization
          memberships.
        </p>
      </header>

      <section className="mt-7 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-bold text-slate-900">
            Personal information
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your email is your sign-in identity and cannot be changed here.
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
          {success ? (
            <p
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              role="status"
            >
              {success}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <ProfileField
              name="firstName"
              label="First name"
              defaultValue={user.firstName}
              error={fieldErrors.firstName}
              autoComplete="given-name"
            />
            <ProfileField
              name="lastName"
              label="Last name"
              defaultValue={user.lastName}
              error={fieldErrors.lastName}
              autoComplete="family-name"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ProfileField
              name="phone"
              label="Phone number"
              defaultValue={user.phone ?? ''}
              error={fieldErrors.phone}
              autoComplete="tel"
              type="tel"
            />
            <div className="grid gap-2">
              <label
                className="text-sm font-bold text-slate-800"
                htmlFor="email"
              >
                Email address
              </label>
              <input
                className="min-h-12 rounded-[0.6rem] border border-slate-200 bg-slate-50 px-3 text-slate-500"
                id="email"
                value={user.email}
                readOnly
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button
              className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProfileField({
  name,
  label,
  defaultValue,
  error,
  autoComplete,
  type = 'text',
}: {
  name: 'firstName' | 'lastName' | 'phone';
  label: string;
  defaultValue: string;
  error?: string;
  autoComplete: string;
  type?: 'text' | 'tel';
}) {
  const errorId = `${name}-error`;
  return (
    <div className="grid gap-2">
      <label className="text-sm font-bold text-slate-800" htmlFor={name}>
        {label}
      </label>
      <input
        className="min-h-12 rounded-[0.6rem] border border-slate-200 bg-white px-3 text-slate-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-invalid:border-red-600"
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        maxLength={name === 'phone' ? 25 : 80}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p className="text-sm text-red-600" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
