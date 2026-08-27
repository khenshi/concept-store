'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RequestError } from '@/components/ui/request-error';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import {
  acceptOrganizationInvitation,
  previewOrganizationInvitation,
} from './organization-invitation-api';
import type { OrganizationInvitationPreview } from './organization-invitation.types';

const roleLabels = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
} as const;

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The invitation could not be loaded. Please try again.';
}

export function InvitationAcceptancePage({ token }: { token: string }) {
  const router = useRouter();
  const { request, status, user, logout } = useAuth();
  const [invitation, setInvitation] =
    useState<OrganizationInvitationPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const acceptanceStarted = useRef(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setInvitation(await previewOrganizationInvitation(request, token));
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [request, token]);

  useEffect(() => {
    let active = true;
    void previewOrganizationInvitation(request, token)
      .then((result) => {
        if (active) setInvitation(result);
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request, token]);

  const accept = useCallback(async () => {
    if (acceptanceStarted.current) return;
    acceptanceStarted.current = true;
    setActionError(null);
    setIsAccepting(true);
    try {
      const accepted = await acceptOrganizationInvitation(request, token);
      router.push(`/app/organizations/${accepted.organizationId}`);
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
      acceptanceStarted.current = false;
    } finally {
      setIsAccepting(false);
    }
  }, [request, router, token]);

  useEffect(() => {
    if (
      invitation &&
      status === 'authenticated' &&
      user?.email === invitation.email
    ) {
      const timeoutId = window.setTimeout(() => void accept(), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [accept, invitation, status, user?.email]);

  const returnTo = `/invitations/${encodeURIComponent(token)}`;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10">
      <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold tracking-[0.12em] text-emerald-700 uppercase">
          Organization invitation
        </p>
        {isLoading ? (
          <p className="mt-5" role="status">
            Loading invitation…
          </p>
        ) : loadError || !invitation ? (
          <RequestError
            className="mt-5"
            title="Invitation unavailable"
            message={loadError ?? 'This invitation is unavailable.'}
            onRetry={() => void load()}
          />
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              Join {invitation.organizationName}
            </h1>
            <p className="mt-3 leading-7 text-slate-500">
              You were invited as {roleLabels[invitation.role]}. This link is
              reserved for{' '}
              <strong className="text-slate-800">{invitation.email}</strong>.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Expires{' '}
              {new Intl.DateTimeFormat('en-PH', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(invitation.expiresAt))}
            </p>

            {actionError ? (
              <p
                className="mt-5 rounded-lg border border-red-600 p-3 text-sm text-red-600"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}

            {status === 'loading' ? (
              <p className="mt-6" role="status">
                Checking your account…
              </p>
            ) : status !== 'authenticated' || !user ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-[0.65rem] bg-emerald-600 px-4 font-bold text-white no-underline"
                  href={`/register?returnTo=${encodeURIComponent(returnTo)}`}
                >
                  Create account
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-[0.6rem] border border-slate-200 bg-white px-4 font-bold text-slate-800 no-underline"
                  href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                >
                  Sign in
                </Link>
              </div>
            ) : user.email !== invitation.email ? (
              <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm leading-6 text-amber-900">
                  You are signed in as {user.email}. Sign in as{' '}
                  {invitation.email} to accept this invitation.
                </p>
                <button
                  className="mt-3 border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
                  type="button"
                  onClick={() => void logout()}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <p
                  className="text-sm font-semibold text-slate-700"
                  role="status"
                >
                  {isAccepting
                    ? 'Adding you to the organization…'
                    : actionError
                      ? 'Automatic acceptance did not complete.'
                      : 'Preparing your organization access…'}
                </p>
                {actionError ? (
                  <button
                    className="mt-3 min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-5 font-bold text-white disabled:opacity-60"
                    type="button"
                    disabled={isAccepting}
                    onClick={() => void accept()}
                  >
                    Try again
                  </button>
                ) : null}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
