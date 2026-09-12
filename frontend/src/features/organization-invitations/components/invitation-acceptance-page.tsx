'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GuestShell } from '@/shared/components/ui/guest-shell';
import { buttonStyles } from '@/shared/components/ui/button';
import { RequestError } from '@/shared/components/ui/request-error';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import {
  acceptOrganizationInvitation,
  previewOrganizationInvitation,
} from '../api/organization-invitation-api';
import type { OrganizationInvitationPreview } from '../model/organization-invitation.types';

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
  const [isSigningOut, setIsSigningOut] = useState(false);
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

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setActionError(null);
    try {
      await logout();
    } catch (cause: unknown) {
      setActionError(
        cause instanceof ApiError
          ? cause.message
          : 'Sign out could not be completed. Please try again.',
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <GuestShell
      eyebrow="Organization invitation"
      title={
        invitation && !isLoading && !loadError
          ? `Join ${invitation.organizationName}`
          : 'Your team invitation.'
      }
      contextTitle={'A place for you.\nA workspace for everyone.'}
      contextDescription="Join your organization with the account and role selected by its owner."
    >
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
          <p className="break-words text-sm leading-7 text-muted">
            You were invited as {roleLabels[invitation.role]}. This link is
            reserved for{' '}
            <strong className="text-ink">{invitation.email}</strong>.
          </p>
          <p className="mt-2 text-sm text-muted">
            Expires{' '}
            {new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(invitation.expiresAt))}
          </p>

          {actionError ? (
            <p
              className="mt-5 rounded-lg border border-danger p-3 text-sm text-danger"
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
                className={buttonStyles({ variant: 'primary', className: '' })}
                href={`/register?returnTo=${encodeURIComponent(returnTo)}`}
              >
                Create account
              </Link>
              <Link
                className={buttonStyles({
                  variant: 'secondary',
                  className: '',
                })}
                href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
              >
                Sign in
              </Link>
            </div>
          ) : user.email !== invitation.email ? (
            <div className="mt-6 rounded-lg border border-warning/20 bg-warning/5 p-4">
              <p className="break-words text-sm leading-6 text-warning">
                You are signed in as {user.email}. Sign in as {invitation.email}{' '}
                to accept this invitation.
              </p>
              <button
                className={buttonStyles({
                  variant: 'secondary',
                  className: 'mt-3',
                })}
                type="button"
                disabled={isSigningOut}
                aria-busy={isSigningOut}
                onClick={() => void signOut()}
              >
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <p className="text-sm font-semibold text-ink" role="status">
                {isAccepting
                  ? 'Adding you to the organization…'
                  : actionError
                    ? 'Automatic acceptance did not complete.'
                    : 'Preparing your organization access…'}
              </p>
              {actionError ? (
                <button
                  className={buttonStyles({
                    variant: 'primary',
                    className: 'mt-3',
                  })}
                  type="button"
                  disabled={isAccepting}
                  aria-busy={isAccepting}
                  onClick={() => void accept()}
                >
                  Try again
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </GuestShell>
  );
}
