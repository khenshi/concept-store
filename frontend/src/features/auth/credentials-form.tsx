'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';
import { BrandWordmark } from '@/components/brand-wordmark';
import { ApiError } from './auth-client';
import { useAuth } from './auth-context';
import {
  loginSchema,
  registrationSchema,
  type AuthFormValues,
} from './auth.schemas';

type FormMode = 'login' | 'register';
type FieldErrors = Partial<Record<keyof AuthFormValues, string>>;

const content = {
  login: {
    eyebrow: 'Welcome back',
    title: 'Sign in to your workspace.',
    submit: 'Sign in',
    submitting: 'Signing in…',
    alternate: 'New to Concept Store?',
    alternateLink: 'Create an account',
    alternateHref: '/register',
  },
  register: {
    eyebrow: 'Start your workspace',
    title: 'Create your account.',
    submit: 'Create account',
    submitting: 'Creating account…',
    alternate: 'Already have an account?',
    alternateLink: 'Sign in',
    alternateHref: '/login',
  },
} as const;

function fieldErrorsFrom(error: ZodError<AuthFormValues>): FieldErrors {
  const flattened = error.flatten().fieldErrors;
  return {
    email: flattened.email?.[0],
    password: flattened.password?.[0],
  };
}

export function CredentialsForm({ mode }: { mode: FormMode }) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const copy = content[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError(null);

    const formData = new FormData(event.currentTarget);
    const values = {
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    };
    const result = (
      mode === 'login' ? loginSchema : registrationSchema
    ).safeParse(values);

    if (!result.success) {
      setFieldErrors(fieldErrorsFrom(result.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await (mode === 'login' ? login(result.data) : register(result.data));
      router.replace('/app');
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
    <section
      className="flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10 sm:max-w-lg sm:px-8 lg:py-16"
      aria-labelledby="auth-title"
    >
      <Link
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 no-underline hover:text-emerald-700"
        href="/"
      >
        <span aria-hidden="true">←</span> Back to home
      </Link>
      <div className="mt-10">
        <p className="mb-4 text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
          {copy.eyebrow}
        </p>
        <h1
          className="max-w-none text-[clamp(1.875rem,6vw,2.625rem)] leading-[1.08] font-bold tracking-[-0.04em] text-slate-900"
          id="auth-title"
        >
          {copy.title}
        </h1>
      </div>

      <form className="mt-8 grid gap-5" onSubmit={handleSubmit} noValidate>
        {submissionError ? (
          <p
            className="m-0 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
            role="alert"
          >
            {submissionError}
          </p>
        ) : null}

        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="email">
            Email address
          </label>
          <input
            className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-invalid:border-red-600"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email ? (
            <p id="email-error" className="m-0 text-sm text-red-600">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-bold" htmlFor="password">
            Password
          </label>
          <input
            className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-invalid:border-red-600"
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            placeholder={
              mode === 'register' ? 'At least 8 characters' : undefined
            }
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? 'password-error' : undefined
            }
          />
          {fieldErrors.password ? (
            <p id="password-error" className="m-0 text-sm text-red-600">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <button
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 disabled:cursor-wait disabled:opacity-65"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? copy.submitting : copy.submit}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {copy.alternate}{' '}
        <Link
          className="font-bold text-emerald-700 underline underline-offset-3"
          href={copy.alternateHref}
        >
          {copy.alternateLink}
        </Link>
      </p>
    </section>
  );
}
