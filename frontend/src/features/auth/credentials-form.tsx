'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { ZodError } from 'zod';
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
    description:
      'Continue to your organization, branches, team, and merchants.',
    submit: 'Sign in',
    submitting: 'Signing in…',
    alternate: 'New to Concept Store?',
    alternateLink: 'Create an account',
    alternateHref: '/register',
    panelEyebrow: 'Your store, clearly organized',
    panelTitle: 'Pick up where your team left off.',
    panelDescription:
      'Return to one shared operational record, with access shaped around your organization and role.',
  },
  register: {
    eyebrow: 'Start your workspace',
    title: 'Create your account.',
    description:
      'Begin with your account. We will guide you through store setup next.',
    submit: 'Create account',
    submitting: 'Creating account…',
    alternate: 'Already have an account?',
    alternateLink: 'Sign in',
    alternateHref: '/login',
    panelEyebrow: 'A clear foundation',
    panelTitle: 'Set up your concept store with confidence.',
    panelDescription:
      'Bring your organization, physical branches, team members, and merchants into one dependable workspace.',
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
    <>
      <aside className="auth-context" aria-label="About Concept Store">
        <Link
          className="landing-wordmark auth-wordmark"
          href="/"
          aria-label="Concept Store home"
        >
          <span className="wordmark-mark" aria-hidden="true">
            CS
          </span>
          <span>Concept Store</span>
        </Link>

        <div className="auth-context-copy">
          <p className="eyebrow">{copy.panelEyebrow}</p>
          <h2>{copy.panelTitle}</h2>
          <p>{copy.panelDescription}</p>
        </div>

        <div className="auth-context-record" aria-hidden="true">
          <div className="auth-record-heading">
            <span>Store workspace</span>
            <i>Active</i>
          </div>
          <div className="auth-record-row">
            <span>Organization</span>
            <strong>North &amp; Pine</strong>
          </div>
          <div className="auth-record-row">
            <span>Connected operations</span>
            <strong>Branches · Team · Merchants</strong>
          </div>
        </div>

        <p className="auth-context-note">
          Built for multi-merchant retail in the Philippines.
        </p>
      </aside>

      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-back-link" href="/">
          <span aria-hidden="true">←</span> Back to home
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 id="auth-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {submissionError ? (
            <p className="form-alert" role="alert">
              {submissionError}
            </p>
          ) : null}

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email ? (
              <p id="email-error" className="field-error">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
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
              <p id="password-error" className="field-error">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? copy.submitting : copy.submit}
          </button>
        </form>

        <p className="alternate-action">
          {copy.alternate}{' '}
          <Link href={copy.alternateHref}>{copy.alternateLink}</Link>
        </p>
      </section>
    </>
  );
}
