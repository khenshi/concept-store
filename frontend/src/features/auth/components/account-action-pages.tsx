'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/auth-client';
import { useAuth } from '../model/auth-context';
import { newPasswordSchema } from '../model/auth.schemas';
import { GuestShell } from '@/shared/components/ui/guest-shell';
import { Button } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import { TextField } from '@/shared/components/ui/text-field';

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function safeReturnTo(value: string | undefined): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/app';
}

export function VerifyEmailPage({
  token,
  email,
  returnTo,
}: {
  token?: string;
  email?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const { requestEmailVerification, confirmEmail } = useAuth();
  const [emailDraft, setEmailDraft] = useState(email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      if (token) {
        const result = newPasswordSchema.safeParse(password);
        if (!result.success) {
          setError(result.error.issues[0]?.message ?? 'Choose a valid password.');
          return;
        }
        await confirmEmail(token, result.data);
        router.replace(`/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
      } else {
        if (!emailDraft.trim()) {
          setError('Enter your email address.');
          return;
        }
        await requestEmailVerification(emailDraft.trim());
        setMessage('If the account can receive mail, a new verification link is on its way.');
      }
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <GuestShell
      eyebrow="Email verification"
      title={token ? 'Confirm your email.' : 'Check your inbox.'}
      description={
        token
          ? 'Create the password you will use after verification, then sign in.'
          : 'Enter your account email and we will send a fresh verification link.'
      }
    >
      <form className="grid gap-5" onSubmit={submit} noValidate>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {message ? <Notice tone="success">{message}</Notice> : null}
        {token ? (
          <TextField
            id="verification-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="Use at least 12 characters and no more than 72 UTF-8 bytes."
            required
          />
        ) : (
          <TextField
            id="verification-email"
            label="Email address"
            type="email"
            autoComplete="email"
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            placeholder="you@example.com"
            required
          />
        )}
        <Button
          variant="accent"
          type="submit"
          pending={isSubmitting}
          pendingLabel={token ? 'Confirming…' : 'Sending…'}
        >
          {token ? 'Confirm email' : 'Send verification email'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link className="font-medium text-ink underline underline-offset-4" href="/login">
          Return to sign in
        </Link>
      </p>
    </GuestShell>
  );
}

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setMessage('If the account can receive mail, a password-reset link is on its way.');
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <GuestShell
      eyebrow="Password recovery"
      title="Reset your password."
      description="Enter your account email and we will send a one-time reset link."
    >
      <form className="grid gap-5" onSubmit={submit} noValidate>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {message ? <Notice tone="success">{message}</Notice> : null}
        <TextField
          id="reset-email"
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
        <Button
          variant="accent"
          type="submit"
          pending={isSubmitting}
          pendingLabel="Sending…"
        >
          Send reset email
        </Button>
      </form>
    </GuestShell>
  );
}

export function ResetPasswordPage({ token }: { token?: string }) {
  const router = useRouter();
  const { confirmPasswordReset } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    if (!token) {
      setError('This reset link is incomplete. Request a new one.');
      return;
    }
    const result = newPasswordSchema.safeParse(newPassword);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Choose a valid password.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await confirmPasswordReset(token, newPassword);
      router.replace('/login');
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <GuestShell
      eyebrow="Password recovery"
      title="Choose a new password."
      description="This link can be used once. You will sign in again after the change."
    >
      <form className="grid gap-5" onSubmit={submit} noValidate>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TextField
          id="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          hint="Use at least 12 characters and no more than 72 UTF-8 bytes."
          required
        />
        <TextField
          id="confirm-password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
        <Button
          variant="accent"
          type="submit"
          pending={isSubmitting}
          pendingLabel="Saving…"
        >
          Reset password
        </Button>
      </form>
    </GuestShell>
  );
}
