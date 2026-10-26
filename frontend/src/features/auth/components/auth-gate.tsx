'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { GuestShell } from '@/shared/components/ui/guest-shell';
import { buttonStyles } from '@/shared/components/ui/button';
import { Notice } from '@/shared/components/ui/notice';
import { useAuth } from '../model/auth-context';

const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

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

  if (
    status === 'loading' ||
    (status === 'authenticated' && user?.emailVerified !== false)
  ) {
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
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function resend() {
    if (!user || isSending) return;
    setIsSending(true);
    setMessage(null);
    try {
      await requestEmailVerification(user.email);
      setMessage('a new verification link is on its way.');
      setResendCooldown(VERIFICATION_RESEND_COOLDOWN_SECONDS);
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
        {message ? (
          <p className="text-sm text-muted" role="status">
            {message}
          </p>
        ) : null}
        <button
          className={buttonStyles({ variant: 'accent' })}
          type="button"
          disabled={isSending || resendCooldown > 0}
          aria-busy={isSending}
          onClick={() => void resend()}
        >
          {isSending
            ? 'Sending…'
            : resendCooldown > 0
              ? `Resend available in ${resendCooldown}s`
              : 'Resend verification email'}
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
