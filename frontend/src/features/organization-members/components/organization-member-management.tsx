'use client';

import { useCallback, useEffect, useState } from 'react';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import {
  OperationalPanel,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { buttonStyles } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/components/organization-page-header';
import { OrganizationPageFrame } from '@/features/organizations/components/organization-page-frame';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import {
  listOrganizationInvitations,
  removeOrganizationInvitation,
  resendOrganizationInvitation,
} from '@/features/organization-invitations/api/organization-invitation-api';
import { OrganizationInvitationModal } from '@/features/organization-invitations/components/organization-invitation-modal';
import type {
  CreatedOrganizationInvitation,
  OrganizationInvitation,
} from '@/features/organization-invitations/model/organization-invitation.types';
import {
  listOrganizationMembers,
  removeOrganizationMember,
} from '../api/organization-member-api';
import type { OrganizationMember } from '../model/organization-member.types';
import { MemberAccessDialog } from './member-access-dialog';

const roleLabels: Record<OrganizationRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  MERCHANT: 'Merchant',
};

function errorMessage(cause: unknown): string {
  return cause instanceof ApiError
    ? cause.message
    : 'The request could not be completed. Please try again.';
}

function joinedDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

const mobileColumnLabelClass =
  'mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden';

function accessSummary(member: OrganizationMember): {
  label: string;
  description: string;
} {
  if (member.role === 'OWNER') {
    return { label: 'All branches', description: 'Implicit access' };
  }
  if (member.role === 'MERCHANT') {
    return member.merchantId
      ? { label: 'Merchant profile', description: 'Inherited branch access' }
      : { label: 'Not linked', description: 'Merchant profile required' };
  }
  return member.branchAccessCount === 0
    ? { label: 'No branches assigned', description: 'Explicit access' }
    : {
        label: `${member.branchAccessCount} branch${member.branchAccessCount === 1 ? '' : 'es'}`,
        description: 'Explicit access',
      };
}

export function OrganizationMemberManagement({
  organizationId,
}: {
  organizationId: string;
}) {
  const { request } = useAuth();
  const {
    organization,
    organizationStatus,
    organizationError,
    refreshOrganization,
  } = useOrganizationWorkspaceContext();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [invitationStatusTime, setInvitationStatusTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [pendingInvitationId, setPendingInvitationId] = useState<string | null>(
    null,
  );
  const [resentInvitation, setResentInvitation] =
    useState<CreatedOrganizationInvitation | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [accessMember, setAccessMember] = useState<OrganizationMember | null>(
    null,
  );
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const organizationRole = organization?.role;

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [memberResult, invitationResult] = await Promise.all([
        listOrganizationMembers(request, organizationId),
        organizationRole === 'OWNER'
          ? listOrganizationInvitations(request, organizationId)
          : Promise.resolve([]),
      ]);
      setMembers(memberResult);
      setInvitations(invitationResult);
      setInvitationStatusTime(Date.now());
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [organizationRole, organizationId, request]);

  useEffect(() => {
    if (!organization) return;
    if (organization.role !== 'OWNER') {
      return;
    }
    let active = true;
    void Promise.all([
      listOrganizationMembers(request, organizationId),
      organization.role === 'OWNER'
        ? listOrganizationInvitations(request, organizationId)
        : Promise.resolve([]),
    ])
      .then(([memberResult, invitationResult]) => {
        if (active) {
          setMembers(memberResult);
          setInvitations(invitationResult);
          setInvitationStatusTime(Date.now());
        }
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
  }, [organization, organizationId, request]);

  function replaceMember(updated: OrganizationMember) {
    setMembers((current) =>
      current.map((member) => (member.id === updated.id ? updated : member)),
    );
  }

  async function handleRemove(member: OrganizationMember) {
    const confirmed = await confirm({
      title: 'Remove this member?',
      description: `${member.email} will lose access to this organization. Their account will not be deleted.`,
      confirmLabel: 'Remove member',
      tone: 'danger',
    });
    if (!confirmed) return;

    setActionError(null);
    setSuccessMessage(null);
    setPendingMemberId(member.id);
    try {
      await removeOrganizationMember(request, organizationId, member.id);
      setMembers((current) =>
        current.filter((candidate) => candidate.id !== member.id),
      );
      setSuccessMessage(`${member.email} was removed from the organization.`);
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setPendingMemberId(null);
    }
  }

  async function handleRemoveInvitation(invitation: OrganizationInvitation) {
    if (pendingInvitationId) return;
    const pending = isPendingInvitation(invitation, Date.now());
    if (
      !(await confirm({
        title: 'Remove this invitation?',
        description: pending
          ? `${invitation.email} will be cancelled and its invitation link will become invalid.`
          : `${invitation.email} will be permanently deleted from the invitation records.`,
        confirmLabel: 'Remove invitation',
        tone: 'danger',
      }))
    )
      return;

    setActionError(null);
    setSuccessMessage(null);
    setPendingInvitationId(invitation.id);
    try {
      setInvitations((current) =>
        current.filter((item) => item.id !== invitation.id),
      );
      await removeOrganizationInvitation(
        request,
        organizationId,
        invitation.id,
      );
      if (pending) {
        setSuccessMessage(
          `The invitation for ${invitation.email} was cancelled and invalidated.`,
        );
      } else {
        setSuccessMessage(
          `The invitation for ${invitation.email} was permanently deleted.`,
        );
      }
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
      setInvitations((current) => [invitation, ...current]);
    } finally {
      setPendingInvitationId(null);
    }
  }

  async function handleResendInvitation(invitation: OrganizationInvitation) {
    if (pendingInvitationId || !isPendingInvitation(invitation, Date.now()))
      return;
    setActionError(null);
    setSuccessMessage(null);
    setResentInvitation(null);
    setPendingInvitationId(invitation.id);
    try {
      const result = await resendOrganizationInvitation(
        request,
        organizationId,
        invitation.id,
      );
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitation.id ? result.invitation : item,
        ),
      );
      setResentInvitation(result);
      setSuccessMessage(
        result.emailDelivery === 'accepted'
          ? `A fresh invitation email was accepted for ${invitation.email}.`
          : `The invitation was refreshed, but email delivery is unavailable for ${invitation.email}.`,
      );
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setPendingInvitationId(null);
    }
  }

  async function copyResentInvitationLink() {
    if (!resentInvitation) return;
    const link = `${window.location.origin}/invitations/${resentInvitation.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setSuccessMessage('The fresh invitation link was copied.');
    } catch {
      setActionError('Copy failed. Use the resend action again to try again.');
    }
  }

  if (organizationStatus === 'loading') {
    return (
      <OrganizationPageFrame>
        <p className="mt-8 text-sm text-muted" role="status">
          Loading organization…
        </p>
      </OrganizationPageFrame>
    );
  }

  if (organizationStatus === 'error' || !organization) {
    return (
      <OrganizationPageFrame>
        <section className="mt-8" role="alert">
          <h1 className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]">
            We could not load the organization.
          </h1>
          <p className="mt-4 leading-7 text-muted">
            {organizationError ?? 'The organization could not be loaded.'}
          </p>
          <button
            className={buttonStyles({ variant: 'secondary' })}
            type="button"
            onClick={() => void refreshOrganization()}
          >
            Try again
          </button>
        </section>
      </OrganizationPageFrame>
    );
  }

  const canViewMembers = organization.role === 'OWNER';
  const canManageMembers = organization.role === 'OWNER';

  return (
    <OrganizationPageFrame>
      <OrganizationPageHeader
        organization={organization}
        title="Organization members"
        description="Review staff access and the role assigned to each account."
      />

      {!canViewMembers ? (
        <section className="mt-6 card-surface p-6">
          <h2 className="m-0 text-base font-bold">Member access is limited</h2>
          <p className="mt-3 leading-7 text-muted">
            Only organization owners can view the member list.
          </p>
        </section>
      ) : (
        <>
          {loadError ? (
            <RequestError
              className="mt-8 bg-surface py-6"
              title="Members unavailable"
              message={loadError}
              onRetry={() => void load()}
            />
          ) : null}
          {successMessage ? (
            <StatusNotice>{successMessage}</StatusNotice>
          ) : null}
          {actionError ? (
            <p
              className="mt-6 rounded-lg border border-danger bg-surface p-3 text-sm text-danger"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}

          {!loadError ? (
            <div className="mt-6">
              <OperationalPanel
                className="mt-0"
                title="People with access"
                description={`${members.length} organization members · Branch assignments restrict access; owners have all-branch access`}
                action={
                  canManageMembers ? (
                    <button
                      className={buttonStyles({ variant: 'accent' })}
                      type="button"
                      onClick={() => setIsAddMemberOpen(true)}
                    >
                      Invite member
                    </button>
                  ) : null
                }
              >
                {isLoading ? (
                  <div className="px-5 pb-5 sm:px-6">
                    <ListSkeleton label="Loading members" rowClassName="h-14" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="py-10 text-center">
                    <h3 className="m-0 text-base font-bold">
                      No members found
                    </h3>
                    <p className="mx-auto mt-2 max-w-md leading-7 text-muted">
                      Invite someone to give them organization access.
                    </p>
                  </div>
                ) : (
                  <ul
                    aria-label="Organization members"
                    className="m-0 list-none p-0"
                  >
                    <li className="data-column-header hidden grid-cols-[minmax(9rem,0.9fr)_minmax(12rem,1fr)_minmax(7rem,0.65fr)_minmax(10rem,0.85fr)_minmax(7rem,0.65fr)_minmax(11rem,auto)] gap-x-5 gap-y-3 sm:grid">
                      <span>Member</span>
                      <span>Contact</span>
                      <span>Role</span>
                      <span>Access</span>
                      <span>Joined</span>
                      <span>Actions</span>
                    </li>
                    {members.map((member) => (
                      <li
                        className="data-row grid min-w-0 gap-x-5 gap-y-4 px-4 py-4 sm:grid-cols-[minmax(9rem,0.9fr)_minmax(12rem,1fr)_minmax(7rem,0.65fr)_minmax(10rem,0.85fr)_minmax(7rem,0.65fr)_minmax(11rem,auto)] sm:items-start"
                        key={member.id}
                      >
                        <div className="min-w-0 break-words">
                          <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden">
                            Member
                          </span>
                          <strong className="block text-sm font-semibold">
                            <span className="block">{member.firstName}</span>
                            <span className="block">{member.lastName}</span>
                          </strong>
                        </div>
                        <div className="min-w-0 break-words">
                          <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden">
                            Contact
                          </span>
                          <p className="m-0 break-words text-sm text-ink">
                            {member.email}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {member.phone ?? 'No phone added'}
                          </p>
                        </div>
                        {canManageMembers ? (
                          <>
                            <div className="min-w-0">
                              <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden">
                                Role
                              </span>
                              <span className="text-sm font-semibold text-ink">
                                {roleLabels[member.role]}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden">
                                Access
                              </span>
                              <strong className="block text-sm font-semibold text-ink">
                                {accessSummary(member).label}
                              </strong>
                              <p className="mt-1 text-xs text-muted">
                                {accessSummary(member).description}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden">
                                Joined
                              </span>
                              <span className="text-sm text-ink">
                                {joinedDate(member.joinedAt)}
                              </span>
                            </div>
                            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2">
                              <span className="mb-1 block basis-full text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden">
                                Actions
                              </span>
                              <button
                                className={buttonStyles({
                                  variant: 'quiet',
                                  className:
                                    'min-h-9 min-w-0 border-0 px-3 py-1.5 text-sm',
                                })}
                                type="button"
                                disabled={Boolean(pendingMemberId)}
                                aria-label={`Edit ${member.email}`}
                                onClick={() => setAccessMember(member)}
                              >
                                Edit
                              </button>
                              <button
                                className={buttonStyles({
                                  variant: 'quiet',
                                  className:
                                    'min-h-9 min-w-0 border-0 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 hover:text-danger',
                                })}
                                type="button"
                                disabled={Boolean(pendingMemberId)}
                                aria-label={`Remove ${member.email}`}
                                onClick={() => void handleRemove(member)}
                              >
                                Remove
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="min-w-0">
                            <span className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden">
                              Role
                            </span>
                            <span className="text-sm font-semibold text-ink">
                              {roleLabels[member.role]}
                            </span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </OperationalPanel>

              {canManageMembers ? (
                <InvitationList
                  invitations={invitations}
                  statusTime={invitationStatusTime}
                  pendingId={pendingInvitationId}
                  onRemove={handleRemoveInvitation}
                  onResend={handleResendInvitation}
                  resentInvitation={resentInvitation}
                  onCopyResentLink={() => void copyResentInvitationLink()}
                />
              ) : null}

              {canManageMembers && isAddMemberOpen ? (
                <OrganizationInvitationModal
                  organizationId={organizationId}
                  onClose={() => setIsAddMemberOpen(false)}
                  onCreated={(invitation) => {
                    setInvitations((current) => [
                      invitation,
                      ...current.filter((item) => item.id !== invitation.id),
                    ]);
                    setSuccessMessage(
                      `An invitation was created for ${invitation.email}.`,
                    );
                    setActionError(null);
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {confirmationDialog}
      {canManageMembers && accessMember && (
        <MemberAccessDialog
          key={`${organizationId}-${accessMember.id}`}
          organizationId={organizationId}
          member={accessMember}
          onClose={() => setAccessMember(null)}
          onMemberChanged={(updated) => {
            replaceMember(updated);
            setAccessMember((current) => (current ? updated : null));
            setSuccessMessage(`Access updated for ${updated.email}.`);
          }}
        />
      )}
    </OrganizationPageFrame>
  );
}

function InvitationList({
  invitations,
  statusTime,
  pendingId,
  onRemove,
  onResend,
  resentInvitation,
  onCopyResentLink,
}: {
  invitations: OrganizationInvitation[];
  statusTime: number;
  pendingId: string | null;
  onRemove(invitation: OrganizationInvitation): Promise<void>;
  onResend(invitation: OrganizationInvitation): Promise<void>;
  resentInvitation: CreatedOrganizationInvitation | null;
  onCopyResentLink(): void;
}) {
  return (
    <OperationalPanel
      className="mt-5"
      title="Invitations"
      description="Pending and historical organization invitations"
    >
      {invitations.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No invitations created yet."
            description="Invite a teammate when you are ready to share access."
          />
        </div>
      ) : (
        <>
          {resentInvitation ? (
            <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control bg-subtle px-4 py-3 text-sm text-muted sm:mx-5">
              <span>
                A fresh link for {resentInvitation.invitation.email} is
                available if you need to share it manually.
              </span>
              <button
                className={buttonStyles({
                  variant: 'quiet',
                  className: 'border-0 px-2 text-sm font-semibold text-ink',
                })}
                type="button"
                onClick={onCopyResentLink}
              >
                Copy link
              </button>
            </div>
          ) : null}
          <ul className="list-none p-0">
            <li className="data-column-header hidden grid-cols-[minmax(12rem,1.2fr)_minmax(7rem,0.65fr)_minmax(12rem,1.2fr)_minmax(7rem,0.65fr)_minmax(8rem,0.75fr)_minmax(8rem,auto)] gap-x-5 gap-y-3 sm:grid">
              <span>Recipient</span>
              <span>Role</span>
              <span>Access</span>
              <span>Status</span>
              <span>Expires</span>
              <span>Actions</span>
            </li>
            {invitations.map((invitation) => {
              const pending = isPendingInvitation(invitation, statusTime);
              const status = invitation.acceptedAt
                ? 'Accepted'
                : invitation.revokedAt
                  ? 'Revoked'
                  : pending
                    ? 'Pending'
                    : 'Expired';
              return (
                <li
                  className="data-row grid min-w-0 gap-x-5 gap-y-4 px-4 py-4 sm:grid-cols-[minmax(12rem,1.2fr)_minmax(7rem,0.65fr)_minmax(12rem,1.2fr)_minmax(7rem,0.65fr)_minmax(8rem,0.75fr)_minmax(8rem,auto)] sm:items-start"
                  key={invitation.id}
                >
                  <div className="min-w-0 break-words">
                    <span className={mobileColumnLabelClass}>Recipient</span>
                    <strong className="text-sm font-semibold">
                      {invitation.email}
                    </strong>
                  </div>
                  <div className="min-w-0">
                    <span className={mobileColumnLabelClass}>Role</span>
                    <span className="text-sm font-semibold text-ink">
                      {roleLabels[invitation.role]}
                    </span>
                  </div>
                  <div className="min-w-0 break-words">
                    <span className={mobileColumnLabelClass}>Access</span>
                    <span className="text-sm text-ink">
                      {invitation.role === 'MERCHANT'
                        ? invitation.merchant
                          ? `Merchant profile · ${invitation.merchant.name}`
                          : 'Merchant profile required'
                        : invitation.branches
                            ?.map(({ branch }) => branch.name)
                            .join(', ') || 'No branches assigned'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className={mobileColumnLabelClass}>Status</span>
                    <span
                      className={`text-sm font-semibold ${status === 'Pending' ? 'text-success-ink' : status === 'Revoked' ? 'text-danger' : 'text-muted'}`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className={mobileColumnLabelClass}>Expires</span>
                    <span className="text-sm text-ink">
                      {joinedDate(invitation.expiresAt)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center justify-start gap-2">
                    <span className={`${mobileColumnLabelClass} basis-full`}>
                      Actions
                    </span>
                    <button
                      className={buttonStyles({
                        variant: 'quiet',
                        className:
                          'min-h-9 min-w-0 border-0 px-3 py-1.5 text-sm text-ink hover:bg-subtle',
                      })}
                      type="button"
                      disabled={Boolean(pendingId) || !pending}
                      aria-busy={pendingId === invitation.id}
                      onClick={() => void onResend(invitation)}
                    >
                      {pendingId === invitation.id ? 'Sending…' : 'Resend'}
                    </button>
                    <button
                      className={buttonStyles({
                        variant: 'quiet',
                        className:
                          'min-h-9 min-w-0 border-0 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 hover:text-danger',
                      })}
                      type="button"
                      disabled={Boolean(pendingId)}
                      aria-busy={pendingId === invitation.id}
                      onClick={() => void onRemove(invitation)}
                    >
                      {pendingId === invitation.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </OperationalPanel>
  );
}

function isPendingInvitation(
  invitation: OrganizationInvitation,
  statusTime: number,
): boolean {
  return (
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    new Date(invitation.expiresAt).getTime() > statusTime
  );
}
