'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { createOrganizationInvitation } from './organization-invitation-api';
import { createOrganizationInvitationSchema } from './organization-invitation.schemas';
import type {
  CreatedOrganizationInvitation,
  OrganizationInvitation,
} from './organization-invitation.types';

const roleLabels = {
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
} as const;

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The invitation could not be created. Please try again.';
}

export function OrganizationInvitationModal({
  organizationId,
  onCreated,
  onClose,
}: {
  organizationId: string;
  onCreated(invitation: OrganizationInvitation): void;
  onClose(): void;
}) {
  const { request } = useAuth();
  const [created, setCreated] = useState<CreatedOrganizationInvitation | null>(
    null,
  );
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSubmitting, onClose]);

  const invitationLink = created
    ? `${window.location.origin}/invitations/${created.token}`
    : '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = createOrganizationInvitationSchema.safeParse({
      email: new FormData(form).get('email'),
      role: new FormData(form).get('role'),
    });
    setEmailError(null);
    setSubmissionError(null);
    if (!result.success) {
      setEmailError(result.error.flatten().fieldErrors.email?.[0] ?? null);
      return;
    }

    setIsSubmitting(true);
    try {
      const next = await createOrganizationInvitation(
        request,
        organizationId,
        result.data,
      );
      setCreated(next);
      onCreated(next.invitation);
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyLink() {
    setCopyStatus(null);
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopyStatus('Invitation link copied.');
    } catch {
      setCopyStatus('Copy failed. Select and copy the link manually.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invitation-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2
          className="text-xl font-bold tracking-tight"
          id="invitation-modal-title"
          ref={headingRef}
          tabIndex={-1}
        >
          {created ? 'Invitation ready' : 'Invite a member'}
        </h2>
        {created ? (
          <div className="mt-5 grid gap-4">
            <p className="text-sm leading-6 text-slate-500">
              Share this single-use link with {created.invitation.email}. It
              expires in 7 days and will only work for that email address.
            </p>
            <label className="text-sm font-bold" htmlFor="invitation-link">
              Invitation link
            </label>
            <input
              className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-slate-50 px-3 text-sm"
              id="invitation-link"
              value={invitationLink}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            {copyStatus ? (
              <p className="text-sm text-slate-600" role="status">
                {copyStatus}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                className="min-h-11 rounded-[0.6rem] border border-slate-200 bg-white px-4 font-bold"
                type="button"
                onClick={onClose}
              >
                Done
              </button>
              <button
                className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-4 font-bold text-white"
                type="button"
                onClick={() => void copyLink()}
              >
                Copy link
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit} noValidate>
            <p className="text-sm leading-6 text-slate-500">
              The recipient will sign in or create their own account before
              accepting access.
            </p>
            {submissionError ? (
              <p
                className="rounded-lg border border-red-600 p-3 text-sm text-red-600"
                role="alert"
              >
                {submissionError}
              </p>
            ) : null}
            <div className="grid gap-2">
              <label className="text-sm font-bold" htmlFor="invitation-email">
                Email address
              </label>
              <input
                className="min-h-12 rounded-[0.6rem] border border-slate-200 px-3 aria-invalid:border-red-600"
                id="invitation-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                aria-invalid={Boolean(emailError)}
                aria-describedby={
                  emailError ? 'invitation-email-error' : undefined
                }
              />
              {emailError ? (
                <p className="text-sm text-red-600" id="invitation-email-error">
                  {emailError}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-bold" htmlFor="invitation-role">
                Organization role
              </label>
              <SelectControl
                id="invitation-role"
                name="role"
                defaultValue="CASHIER"
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectControl>
            </div>
            <div className="mt-2 flex justify-end gap-3">
              <button
                className="min-h-11 rounded-[0.6rem] border border-slate-200 bg-white px-4 font-bold"
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-4 font-bold text-white disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating invitation…' : 'Create invitation'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
