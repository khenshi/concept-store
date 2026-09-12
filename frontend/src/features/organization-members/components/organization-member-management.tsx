'use client';

import { useCallback, useEffect, useState } from 'react';
import { ListSkeleton } from '@/shared/components/ui/list-skeleton';
import { useConfirmationDialog } from '@/shared/components/ui/confirmation-dialog';
import {
  OperationalPage,
  OperationalPanel,
  StatusNotice,
} from '@/shared/components/ui/operational-page';
import { RequestError } from '@/shared/components/ui/request-error';
import { buttonStyles } from '@/shared/components/ui/button';
import { SelectControl } from '@/shared/components/ui/select-control';
import { ApiError } from '@/features/auth/api/auth-client';
import { useAuth } from '@/features/auth/model/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/components/organization-page-header';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/components/organization-workspace-context';
import {
  listOrganizationInvitations,
  revokeOrganizationInvitation,
} from '@/features/organization-invitations/api/organization-invitation-api';
import { OrganizationInvitationModal } from '@/features/organization-invitations/components/organization-invitation-modal';
import type { OrganizationInvitation } from '@/features/organization-invitations/model/organization-invitation.types';
import {
  listOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationMemberRole,
} from '../api/organization-member-api';
import type { OrganizationMember } from '../model/organization-member.types';

const roles: OrganizationRole[] = ['OWNER', 'MANAGER', 'CASHIER', 'MERCHANT'];

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
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
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
    if (organization.role !== 'OWNER' && organization.role !== 'MANAGER') {
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

  async function handleRoleChange(
    member: OrganizationMember,
    role: OrganizationRole,
  ) {
    if (role === member.role) return;
    const confirmed = await confirm({
      title: `Change ${member.email}'s role?`,
      description: `Change this member from ${roleLabels[member.role]} to ${roleLabels[role]}. Their organization access will immediately follow the new role.`,
      confirmLabel: 'Change role',
      tone: role === 'OWNER' ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    setActionError(null);
    setSuccessMessage(null);
    setPendingMemberId(member.id);
    try {
      const updated = await updateOrganizationMemberRole(
        request,
        organizationId,
        member.id,
        role,
      );
      replaceMember(updated);
      setSuccessMessage(`${updated.email} is now ${roleLabels[updated.role]}.`);
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setPendingMemberId(null);
    }
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

  async function handleRevoke(invitation: OrganizationInvitation) {
    if (pendingInvitationId) return;
    if (
      !(await confirm({
        title: 'Revoke this invitation?',
        description: `${invitation.email} will no longer be able to use its invitation link.`,
        confirmLabel: 'Revoke invitation',
        tone: 'danger',
      }))
    )
      return;

    setActionError(null);
    setSuccessMessage(null);
    setPendingInvitationId(invitation.id);
    try {
      const revoked = await revokeOrganizationInvitation(
        request,
        organizationId,
        invitation.id,
      );
      setInvitations((current) =>
        current.map((item) => (item.id === revoked.id ? revoked : item)),
      );
      setSuccessMessage(`The invitation for ${revoked.email} was revoked.`);
    } catch (cause: unknown) {
      setActionError(errorMessage(cause));
    } finally {
      setPendingInvitationId(null);
    }
  }

  if (organizationStatus === 'loading') {
    return (
      <p className="p-6 text-sm text-muted" role="status">
        Loading organization…
      </p>
    );
  }

  if (organizationStatus === 'error' || !organization) {
    return (
      <section className="mx-auto w-full max-w-3xl p-6" role="alert">
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
    );
  }

  const canViewMembers =
    organization.role === 'OWNER' || organization.role === 'MANAGER';
  const canManageMembers = organization.role === 'OWNER';

  return (
    <OperationalPage>
      <OrganizationPageHeader
        organization={organization}
        title="Organization members"
        description="Review staff access and the role assigned to each account."
      />

      {!canViewMembers ? (
        <section className="mt-6 rounded-panel border border-hairline bg-surface p-6">
          <h2 className="m-0 text-base font-bold">Member access is limited</h2>
          <p className="mt-3 leading-7 text-muted">
            Only organization owners and managers can view the member list.
          </p>
        </section>
      ) : (
        <>
          {loadError ? (
            <RequestError
              className="mt-6 rounded-panel border border-hairline bg-surface p-6"
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
                title="People with access"
                description={`${members.length} organization members · Roles apply across the organization; branch access is not configured yet`}
                action={
                  canManageMembers ? (
                    <button
                      className={buttonStyles({ variant: 'primary' })}
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
                    className="m-0 list-none divide-y divide-hairline p-0"
                  >
                    {members.map((member) => (
                      <li
                        className="grid min-w-0 gap-4 px-5 py-5 hover:bg-subtle sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                        key={member.id}
                      >
                        <div className="min-w-0 break-words">
                          <strong className="block text-sm font-semibold">
                            {member.firstName} {member.lastName}
                          </strong>
                          <p className="mt-1 text-xs leading-5 text-muted">
                            {member.email}
                            {member.phone ? ` · ${member.phone}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            Joined {joinedDate(member.joinedAt)}
                          </p>
                        </div>
                        {canManageMembers ? (
                          <div className="flex min-w-0 flex-wrap items-center gap-3">
                            <div className="min-w-0 flex-1 sm:w-40">
                              <label
                                className="sr-only"
                                htmlFor={`role-${member.id}`}
                              >
                                Role for {member.email}
                              </label>
                              <SelectControl
                                id={`role-${member.id}`}
                                value={member.role}
                                disabled={Boolean(pendingMemberId)}
                                onValueChange={(value) =>
                                  void handleRoleChange(
                                    member,
                                    value as OrganizationRole,
                                  )
                                }
                              >
                                {roles.map((role) => (
                                  <option key={role} value={role}>
                                    {roleLabels[role]}
                                  </option>
                                ))}
                              </SelectControl>
                            </div>
                            <button
                              className={buttonStyles({ variant: 'secondary' })}
                              type="button"
                              disabled={Boolean(pendingMemberId)}
                              aria-label={`Remove ${member.email}`}
                              onClick={() => void handleRemove(member)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <span className="w-fit rounded-full bg-selected px-3 py-1.5 text-xs font-medium text-ink">
                            {roleLabels[member.role]}
                          </span>
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
                  onRevoke={handleRevoke}
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
    </OperationalPage>
  );
}

function InvitationList({
  invitations,
  statusTime,
  pendingId,
  onRevoke,
}: {
  invitations: OrganizationInvitation[];
  statusTime: number;
  pendingId: string | null;
  onRevoke(invitation: OrganizationInvitation): Promise<void>;
}) {
  return (
    <OperationalPanel
      title="Invitations"
      description="Pending and historical organization invitations"
    >
      {invitations.length === 0 ? (
        <p className="p-6 text-sm text-muted">No invitations created yet.</p>
      ) : (
        <ul className="list-none divide-y divide-hairline p-0">
          {invitations.map((invitation) => {
            const pending =
              !invitation.acceptedAt &&
              !invitation.revokedAt &&
              new Date(invitation.expiresAt).getTime() > statusTime;
            const status = invitation.acceptedAt
              ? 'Accepted'
              : invitation.revokedAt
                ? 'Revoked'
                : pending
                  ? 'Pending'
                  : 'Expired';
            return (
              <li
                className="flex items-center justify-between gap-4 px-6 py-4 max-sm:grid"
                key={invitation.id}
              >
                <div className="min-w-0 break-words">
                  <strong>{invitation.email}</strong>
                  <p className="mt-1 text-sm text-muted">
                    {roleLabels[invitation.role]} · {status}
                  </p>
                </div>
                {pending ? (
                  <button
                    className={buttonStyles({ variant: 'secondary' })}
                    type="button"
                    disabled={Boolean(pendingId)}
                    aria-busy={pendingId === invitation.id}
                    onClick={() => void onRevoke(invitation)}
                  >
                    {pendingId === invitation.id ? 'Revoking…' : 'Revoke'}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </OperationalPanel>
  );
}
