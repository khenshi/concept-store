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
      <main className="grid min-h-screen place-items-center px-5 py-8">
        <section
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-[clamp(1.5rem,5vw,2.5rem)]"
          role="alert"
        >
          <p className="mb-4 text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
            Session unavailable
          </p>
          <h1 className="max-w-none text-[clamp(2rem,7vw,3rem)] leading-tight font-bold tracking-[-0.04em]">
            We could not confirm your session.
          </h1>
          <p className="mt-4 leading-7 text-slate-500">
            {error ?? 'Check that the backend is available, then try again.'}
          </p>
          <a
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[0.65rem] bg-emerald-600 px-4.5 py-3 font-bold text-white no-underline hover:bg-emerald-700"
            href="/login"
          >
            Return to login
          </a>
        </section>
      </main>
    );
  }

  return (
    <main
      className="grid min-h-screen place-items-center px-5 py-8"
      aria-busy="true"
    >
      <p role="status">Checking your session…</p>
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
        className="grid min-h-screen place-items-center px-5 py-8"
        aria-busy="true"
      >
        <p role="status">Checking your session…</p>
      </main>
    );
  }

  return children;
}
