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
import { loadMemberAccessOptions } from '@/features/organization-members/api/organization-member-api';
import type {
  AccessBranch,
  AccessMerchant,
} from '@/features/organization-members/model/member-access.schemas';
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
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'CASHIER' | 'MERCHANT'>(
    'CASHIER',
  );
  const [merchantId, setMerchantId] = useState('');
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [merchantError, setMerchantError] = useState<string | null>(null);
  const [options, setOptions] = useState<{
    branches: AccessBranch[];
    merchants: AccessMerchant[];
  } | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const dirty = useRef(false);
  const submitLock = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    void loadMemberAccessOptions(request, organizationId)
      .then((value) => {
        if (active) {
          setOptions(value);
          setOptionsError(null);
        }
      })
      .catch(() => {
        if (active)
          setOptionsError(
            'Branches and merchants could not be loaded. Try again.',
          );
      });
    return () => {
      active = false;
    };
  }, [request, organizationId, revision]);
  function validateInputs() {
    const result = createOrganizationInvitationSchema.safeParse({
      email,
      role,
      ...(branchIds.length ? { branchIds } : {}),
      ...(role === 'MERCHANT' && merchantId ? { merchantId } : {}),
    });
    setEmailError(
      result.success
        ? null
        : (result.error.flatten().fieldErrors.email?.[0] ?? null),
    );
    setMerchantError(
      result.success
        ? null
        : (result.error.flatten().fieldErrors.merchantId?.[0] ?? null),
    );
    return result;
  }
  useEffect(() => {
    if (!dirty.current || created) return;
    const timer = setTimeout(() => {
      const result = createOrganizationInvitationSchema.safeParse({
        email,
        role,
        ...(role === 'MERCHANT' && merchantId ? { merchantId } : {}),
        branchIds,
      });
      setEmailError(
        result.success
          ? null
          : (result.error.flatten().fieldErrors.email?.[0] ?? null),
      );
      setMerchantError(
        result.success
          ? null
          : (result.error.flatten().fieldErrors.merchantId?.[0] ?? null),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [email, role, merchantId, branchIds, created]);

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
    if (submitLock.current) return;
    const form = event.currentTarget;
    const result = validateInputs();
    setSubmissionError(null);
    if (!result.success) {
      setEmailError(result.error.flatten().fieldErrors.email?.[0] ?? null);
      focusFirstInvalidField(form);
      return;
    }

    if (!options || optionsError) return;
    submitLock.current = true;

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
      submitLock.current = false;
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
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-panel border border-hairline bg-surface p-0 text-ink shadow-overlay backdrop:bg-scrim"
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
            {optionsError && (
              <p role="alert" className="text-sm text-danger">
                {optionsError}{' '}
                <button
                  type="button"
                  onClick={() => setRevision((value) => value + 1)}
                >
                  Try again
                </button>
              </p>
            )}
            {!options && !optionsError && (
              <p role="status" className="text-sm text-muted">
                Loading access choices…
              </p>
            )}
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
                value={email}
                disabled={isSubmitting}
                onChange={(event) => {
                  dirty.current = true;
                  setEmail(event.target.value);
                }}
                onBlur={validateInputs}
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
                value={role}
                disabled={isSubmitting}
                onValueChange={(value) => {
                  dirty.current = true;
                  setRole(value as typeof role);
                  setMerchantId('');
                  setMerchantError(null);
                }}
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectControl>
            </div>
            {role === 'MERCHANT' && (
              <div className="grid gap-2">
                <label
                  className="text-sm font-bold"
                  htmlFor="invitation-merchant"
                >
                  Merchant profile
                </label>
                <div onBlur={validateInputs}>
                  <SelectControl
                    id="invitation-merchant"
                    value={merchantId}
                    required
                    disabled={isSubmitting || !options}
                    aria-invalid={Boolean(merchantError)}
                    aria-describedby={
                      merchantError ? 'invitation-merchant-error' : undefined
                    }
                    onValueChange={(value) => {
                      dirty.current = true;
                      setMerchantId(value);
                    }}
                  >
                    <option value="">Choose a merchant</option>
                    {options?.merchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.name} · {merchant.status}
                      </option>
                    ))}
                  </SelectControl>
                </div>
                {merchantError && (
                  <p
                    id="invitation-merchant-error"
                    className="text-sm text-danger"
                  >
                    {merchantError}
                  </p>
                )}
                {options?.merchants.length === 0 && (
                  <p className="text-sm text-muted">
                    Create a merchant profile before inviting a merchant user.
                  </p>
                )}
              </div>
            )}
            <fieldset disabled={isSubmitting || !options} className="min-w-0">
              <legend className="text-sm font-bold">Branch assignments</legend>
              <p className="mt-2 text-sm text-muted">
                Optional. Staff without assignments cannot access branches.
                Merchants also see their own inventory wherever placed.
              </p>
              <div className="mt-3 grid max-h-60 gap-3 overflow-y-auto">
                {options?.branches.map((branch) => (
                  <label
                    key={branch.id}
                    className="flex min-w-0 items-start gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={branchIds.includes(branch.id)}
                      disabled={
                        !branchIds.includes(branch.id) &&
                        branchIds.length >= 100
                      }
                      onChange={(event) => {
                        dirty.current = true;
                        setBranchIds((ids) =>
                          event.target.checked
                            ? [...ids, branch.id]
                            : ids.filter((id) => id !== branch.id),
                        );
                      }}
                    />
                    <span className="min-w-0 break-words">
                      {branch.name}
                      {branch.code ? ` · ${branch.code}` : ''}
                    </span>
                  </label>
                ))}
              </div>
              {options?.branches.length === 0 && (
                <p className="mt-3 text-sm text-muted">
                  No branches available. Access can be assigned later.
                </p>
              )}
              <p className="mt-2 text-xs text-muted">
                {branchIds.length}/100 selected
              </p>
            </fieldset>
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
                disabled={isSubmitting || Boolean(optionsError)}
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
