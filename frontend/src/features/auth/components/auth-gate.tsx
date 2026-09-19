'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { GuestShell } from '@/shared/components/ui/guest-shell';
import { buttonStyles } from '@/shared/components/ui/button';
import { useAuth } from '../model/auth-context';

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, error } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [router, status]);

  if (status === 'authenticated') return children;

  if (status === 'error') {
    return (
      <GuestShell
        eyebrow="Session unavailable"
        title="We could not confirm your session."
      >
        <div role="alert">
          <p className="text-sm leading-7 text-muted">
            {error ?? 'Check that the backend is available, then try again.'}
          </p>
        </div>
        <a className={buttonStyles({ className: 'mt-5' })} href="/login">
          Return to login
        </a>
      </GuestShell>
    );
  }

  return (
    <main
      className="grid min-h-dvh place-items-center bg-surface px-5 py-8 text-muted"
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
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'authenticated') {
      const returnTo = new URLSearchParams(window.location.search).get(
        'returnTo',
      );
      router.replace(
        returnTo?.startsWith('/') && !returnTo.startsWith('//')
          ? returnTo
          : '/app',
      );
    }
  }, [router, status]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <main
        className="grid min-h-dvh place-items-center bg-surface px-5 py-8 text-muted"
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
