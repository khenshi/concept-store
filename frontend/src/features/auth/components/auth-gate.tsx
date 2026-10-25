'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { GuestShell } from '@/shared/components/ui/guest-shell';
import { buttonStyles } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import { useAuth } from '../model/auth-context';

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, error, user } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [router, status]);

  if (status === 'authenticated' && user?.emailVerified === false) {
    return <EmailVerificationRequired />;
  }

  if (status === 'authenticated') return children;

  if (status === 'error') {
    return (
      <GuestShell
        eyebrow="Session unavailable"
        title="We could not confirm your session."
      >
        <Notice tone="error">
          {error ?? 'Check that the backend is available, then try again.'}
        </Notice>
        <a className={buttonStyles({ className: 'mt-5' })} href="/login">
          Return to login
        </a>
      </GuestShell>
    );
  }

  return (
    <main
      className="grid min-h-dvh place-items-center bg-canvas px-5 py-8 text-muted"
      aria-busy="true"
    >
      <p className="w-full max-w-md py-6 text-sm" role="status">
        Checking your session…
      </p>
    </main>
  );
}

export function GuestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === 'authenticated' && user?.emailVerified !== false) {
      const returnTo = new URLSearchParams(window.location.search).get(
        'returnTo',
      );
      router.replace(
        returnTo?.startsWith('/') && !returnTo.startsWith('//')
          ? returnTo
          : '/app',
      );
    }
  }, [router, status, user?.emailVerified]);

  if (status === 'loading' || (status === 'authenticated' && user?.emailVerified !== false)) {
    return (
      <main
        className="grid min-h-dvh place-items-center bg-canvas px-5 py-8 text-muted"
        aria-busy="true"
      >
        <p className="w-full max-w-md py-6 text-sm" role="status">
          Checking your session…
        </p>
      </main>
    );
  }

  return children;
}

function EmailVerificationRequired() {
  const { user, requestEmailVerification, logout } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function resend() {
    if (!user || isSending) return;
    setIsSending(true);
    setMessage(null);
    try {
      await requestEmailVerification(user.email);
      setMessage('If the account can receive mail, a new verification link is on its way.');
    } catch {
      setMessage('We could not send a new link. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <GuestShell
      eyebrow="Verify your email"
      title="One quick step before your workspace."
      description={`Confirm ${user?.email ?? 'your email address'} to continue.`}
    >
      <div className="grid gap-4">
        <Notice tone="warning">
          Check your inbox for the verification link. You can resend it if the
          first message has expired or did not arrive.
        </Notice>
        {message ? <p className="text-sm text-muted" role="status">{message}</p> : null}
        <button
          className={buttonStyles({ variant: 'accent' })}
          type="button"
          disabled={isSending}
          aria-busy={isSending}
          onClick={() => void resend()}
        >
          {isSending ? 'Sending…' : 'Resend verification email'}
        </button>
        <button
          className={buttonStyles({ variant: 'quiet' })}
          type="button"
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </div>
    </GuestShell>
  );
}
