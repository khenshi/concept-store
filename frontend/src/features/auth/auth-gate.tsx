'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from './auth-context';

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, error } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [router, status]);

  if (status === 'authenticated') return children;

  if (status === 'error') {
    return (
      <main className="status-shell">
        <section className="status-card" role="alert">
          <p className="eyebrow">Session unavailable</p>
          <h1>We could not confirm your session.</h1>
          <p>
            {error ?? 'Check that the backend is available, then try again.'}
          </p>
          <a className="primary-link" href="/login">
            Return to login
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="status-shell" aria-busy="true">
      <p role="status">Checking your session…</p>
    </main>
  );
}

export function GuestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/app');
  }, [router, status]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <main className="status-shell" aria-busy="true">
        <p role="status">Checking your session…</p>
      </main>
    );
  }

  return children;
}
