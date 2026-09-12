'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';
import { GuestShell } from '@/shared/components/ui/guest-shell';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { Button } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import { ApiError } from '../api/auth-client';
import { useAuth } from '../model/auth-context';
import {
  loginSchema,
  registrationSchema,
  type AuthFormValues,
  type RegistrationFormValues,
} from '../model/auth.schemas';

type FormMode = 'login' | 'register';
type FieldErrors = Partial<
  Record<keyof AuthFormValues | keyof RegistrationFormValues, string>
>;

const content = {
  login: {
    eyebrow: 'Welcome back',
    title: 'Sign in to your workspace.',
    submit: 'Sign in',
    submitting: 'Signing in…',
    alternate: 'New to Kapwesto?',
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

function fieldErrorsFrom(error: ZodError): FieldErrors {
  const flattened = error.flatten().fieldErrors as Record<
    string,
    string[] | undefined
  >;
  return {
    email: flattened.email?.[0],
    password: flattened.password?.[0],
    firstName: flattened.firstName?.[0],
    lastName: flattened.lastName?.[0],
    phone: flattened.phone?.[0],
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
    if (isSubmitting) return;
    const form = event.currentTarget;
    setSubmissionError(null);

    const formData = new FormData(event.currentTarget);
    const values = {
      firstName: String(formData.get('firstName') ?? '').trim(),
      lastName: String(formData.get('lastName') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    };
    const result =
      mode === 'login'
        ? loginSchema.safeParse(values)
        : registrationSchema.safeParse(values);

    if (!result.success) {
      setFieldErrors(fieldErrorsFrom(result.error));
      focusFirstInvalidField(form);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const loginResult = loginSchema.parse(values);
        await login(loginResult);
      } else {
        const registrationResult = registrationSchema.parse(values);
        await register(registrationResult);
      }
      const returnTo = new URLSearchParams(window.location.search).get(
        'returnTo',
      );
      router.replace(
        returnTo?.startsWith('/') && !returnTo.startsWith('//')
          ? returnTo
          : '/app',
      );
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
    <GuestShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={
        mode === 'login'
          ? 'Continue to your organizations and the people behind them.'
          : 'Start with your account. Create an organization or accept a team invitation after signing in.'
      }
    >
      <form className="grid min-w-0 gap-5" onSubmit={handleSubmit} noValidate>
        {submissionError ? (
          <Notice tone="error">{submissionError}</Notice>
        ) : null}
        {mode === 'register' ? (
          <>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <TextField
                id="firstName"
                name="firstName"
                label="First name"
                autoComplete="given-name"
                maxLength={80}
                required
                error={fieldErrors.firstName}
              />
              <TextField
                id="lastName"
                name="lastName"
                label="Last name"
                autoComplete="family-name"
                maxLength={80}
                required
                error={fieldErrors.lastName}
              />
            </div>
            <TextField
              id="phone"
              name="phone"
              label="Phone number (optional)"
              type="tel"
              autoComplete="tel"
              maxLength={25}
              error={fieldErrors.phone}
            />
          </>
        ) : null}
        <TextField
          id="email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          maxLength={254}
          required
          error={fieldErrors.email}
        />
        <TextField
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          hint={mode === 'register' ? 'Use 12–128 characters.' : undefined}
          required
          error={fieldErrors.password}
        />
        <Button
          type="submit"
          pending={isSubmitting}
          pendingLabel={copy.submitting}
        >
          {copy.submit}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {copy.alternate}{' '}
        <Link
          className="font-medium text-ink underline underline-offset-4"
          href={copy.alternateHref}
        >
          {copy.alternateLink}
        </Link>
      </p>
    </GuestShell>
  );
}
