'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { buttonStyles } from '@/shared/components/ui/button';
import { SelectControl } from '@/shared/components/ui/select-control';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { createOrganizationInvitation } from '../api/organization-invitation-api';
import { createOrganizationInvitationSchema } from '../model/organization-invitation.schemas';
import type {
  CreatedOrganizationInvitation,
  OrganizationInvitation,
} from '../model/organization-invitation.types';

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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    headingRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (created) headingRef.current?.focus();
  }, [created]);

  const invitationLink = created
    ? `${window.location.origin}/invitations/${created.token}`
    : '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = event.currentTarget;
    const result = createOrganizationInvitationSchema.safeParse({
      email: new FormData(form).get('email'),
      role: new FormData(form).get('role'),
    });
    setEmailError(null);
    setSubmissionError(null);
    if (!result.success) {
      setEmailError(result.error.flatten().fieldErrors.email?.[0] ?? null);
      focusFirstInvalidField(form);
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
    <dialog
      ref={dialogRef}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-panel border border-hairline bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/35"
      aria-labelledby="invitation-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onClose();
      }}
      onMouseDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          !isSubmitting &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
    >
      <section className="min-w-0 p-5 sm:p-8">
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
            <p className="text-sm leading-6 text-muted">
              Share this single-use link with {created.invitation.email}. It
              expires{' '}
              {new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
                new Date(created.invitation.expiresAt),
              )}{' '}
              and will only work for that email address.
            </p>
            <TextField
              label="Invitation link"
              id="invitation-link"
              value={invitationLink}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            {copyStatus ? (
              <p className="text-sm text-muted" role="status">
                {copyStatus}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                className={buttonStyles({ variant: 'secondary' })}
                type="button"
                onClick={onClose}
              >
                Done
              </button>
              <button
                className={buttonStyles({ variant: 'primary' })}
                type="button"
                onClick={() => void copyLink()}
              >
                Copy link
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit} noValidate>
            <p className="text-sm leading-6 text-muted">
              The recipient will sign in or create their own account before
              accepting access.
            </p>
            {submissionError ? (
              <p
                className="rounded-lg border border-danger p-3 text-sm text-danger"
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
                className="min-h-11 min-w-0 rounded-control border border-control-border px-3 aria-invalid:border-danger"
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
                <p className="text-sm text-danger" id="invitation-email-error">
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
                className={buttonStyles({ variant: 'secondary' })}
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className={buttonStyles({ variant: 'primary' })}
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating invitation…' : 'Create invitation'}
              </button>
            </div>
          </form>
        )}
      </section>
    </dialog>
  );
}
