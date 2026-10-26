'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { buttonStyles } from '@/shared/components/ui/button';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { InputControl } from '@/shared/components/ui/input-control';
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
import { BranchAccessPicker } from './branch-access-picker';
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
      ...(role !== 'MERCHANT' && branchIds.length ? { branchIds } : {}),
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
        branchIds: role === 'MERCHANT' ? [] : branchIds,
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
    <FormDialog
      title={created ? 'Invitation ready' : 'Invite a member'}
      size="compact"
      pending={isSubmitting}
      onClose={onClose}
    >
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
            placeholder="https://example.com/invite/..."
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <p
            className={`text-sm leading-6 ${created.emailDelivery === 'accepted' ? 'text-success-ink' : 'text-danger'}`}
            role="status"
          >
            {created.emailDelivery === 'accepted'
              ? 'The invitation email was accepted by the email provider.'
              : created.emailDelivery === 'disabled'
                ? 'Email delivery is disabled. Share the link below manually.'
                : 'The invitation was saved, but the email could not be sent. Share the link below manually.'}
          </p>
          {copyStatus ? (
            <p className="text-sm text-muted" role="status">
              {copyStatus}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              className={buttonStyles({ variant: 'quiet' })}
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
            <InputControl
              id="invitation-email"
              icon="mail"
              name="email"
              type="email"
              placeholder="e.g. teammate@example.com"
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
          {role === 'MERCHANT' ? (
            <p className="text-sm text-muted">
              Merchant users inherit every branch associated with the selected
              merchant profile.
            </p>
          ) : (
            <fieldset disabled={isSubmitting || !options} className="min-w-0">
              <legend className="text-sm font-bold">Branch assignments</legend>
              <p className="mt-2 text-sm text-muted">
                Optional. Staff without assignments cannot access branches.
              </p>
              {!optionsError ? (
                <BranchAccessPicker
                  branches={options?.branches ?? []}
                  selectedIds={branchIds}
                  disabled={isSubmitting}
                  loading={!options}
                  onChange={(nextIds) => {
                    dirty.current = true;
                    setBranchIds(nextIds);
                  }}
                />
              ) : null}
            </fieldset>
          )}
          <ModalActionRow
            className="mt-2"
            feedback={
              submissionError ? (
                <p className="text-sm text-danger" role="alert">
                  {submissionError}
                </p>
              ) : null
            }
          >
            <button
              className={buttonStyles({ variant: 'quiet' })}
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
          </ModalActionRow>
        </form>
      )}
    </FormDialog>
  );
}
