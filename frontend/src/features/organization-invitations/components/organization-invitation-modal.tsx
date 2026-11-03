'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { FormDialog } from '@/shared/components/ui/form-dialog';
import { buttonStyles } from '@/shared/components/ui/button';
import { ModalActionRow } from '@/shared/components/ui/modal-action-row';
import { InputControl } from '@/shared/components/ui/input-control';
import { SelectControl } from '@/shared/components/ui/select-control';
import {
  PagedOptionSelect,
  type PagedOption,
} from '@/shared/components/ui/paged-option-select';
import {
  TextField,
  focusFirstInvalidField,
} from '@/shared/components/ui/text-field';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { createOrganizationInvitation } from '../api/organization-invitation-api';
import { createOrganizationInvitationSchema } from '../model/organization-invitation.schemas';
import { listBranchOptions } from '@/features/branches/api/branch-api';
import { listMerchantOptions } from '@/features/merchants/api/merchant-api';
import { BranchAccessPicker } from './branch-access-picker';
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
  const [merchantOption, setMerchantOption] = useState<PagedOption | null>(
    null,
  );
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [merchantError, setMerchantError] = useState<string | null>(null);
  const dirty = useRef(false);
  const submitLock = useRef(false);
  const loadMerchantPage = useCallback(
    (query: string, page: number) =>
      listMerchantOptions(
        request,
        organizationId,
        { search: query, page },
        'OWNER',
      ),
    [organizationId, request],
  );
  const loadBranchPage = useCallback(
    (query: string, page: number) =>
      listBranchOptions(request, organizationId, { search: query, page }),
    [organizationId, request],
  );
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
                setMerchantOption(null);
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
                <PagedOptionSelect
                  id="invitation-merchant"
                  value={merchantId}
                  disabled={isSubmitting}
                  selectedOption={merchantOption}
                  placeholder="Choose a merchant"
                  searchPlaceholder="Search merchants"
                  emptyMessage="No active merchants found."
                  loadPage={loadMerchantPage}
                  aria-invalid={Boolean(merchantError)}
                  aria-describedby="invitation-merchant-error"
                  onValueChange={(value) => {
                    dirty.current = true;
                    setMerchantId(value);
                  }}
                  onOptionChange={setMerchantOption}
                />
              </div>
              {merchantError && (
                <p
                  id="invitation-merchant-error"
                  className="text-sm text-danger"
                >
                  {merchantError}
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
            <fieldset disabled={isSubmitting} className="min-w-0">
              <legend className="text-sm font-bold">Branch assignments</legend>
              <p className="mt-2 text-sm text-muted">
                Optional. Staff without assignments cannot access branches.
              </p>
              <BranchAccessPicker
                branches={[]}
                loadPage={loadBranchPage}
                selectedIds={branchIds}
                disabled={isSubmitting}
                onChange={(nextIds) => {
                  dirty.current = true;
                  setBranchIds(nextIds);
                }}
              />
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating invitation…' : 'Create invitation'}
            </button>
          </ModalActionRow>
        </form>
      )}
    </FormDialog>
  );
}
