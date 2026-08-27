'use client';

import { useCallback, useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  OperationalPage,
  OperationalPanel,
  StatusNotice,
} from '@/components/ui/operational-page';
import { RequestError } from '@/components/ui/request-error';
import { SelectControl } from '@/components/ui/select-control';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { OrganizationPageHeader } from '@/features/organizations/organization-page-header';
import type { OrganizationRole } from '@/features/organizations/organization.types';
import { useOrganizationWorkspaceContext } from '@/features/organizations/organization-workspace-context';
import {
  listOrganizationInvitations,
  revokeOrganizationInvitation,
} from '@/features/organization-invitations/organization-invitation-api';
import { OrganizationInvitationModal } from '@/features/organization-invitations/organization-invitation-modal';
import type { OrganizationInvitation } from '@/features/organization-invitations/organization-invitation.types';
import {
  listOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationMemberRole,
} from './organization-member-api';
import type { OrganizationMember } from './organization-member.types';

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
    }
  }

  if (organizationStatus === 'loading') {
    return (
      <p
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-5xl"
        role="status"
      >
        Loading organization…
      </p>
    );
  }

  if (organizationStatus === 'error' || !organization) {
    return (
      <section
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-3xl"
        role="alert"
      >
        <h1 className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]">
          We could not load the organization.
        </h1>
        <p className="mt-4 leading-7 text-slate-500">
          {organizationError ?? 'The organization could not be loaded.'}
        </p>
        <button
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
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
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="m-0 text-base font-bold">Member access is limited</h2>
          <p className="mt-3 leading-7 text-slate-500">
            Only organization owners and managers can view the member list.
          </p>
        </section>
      ) : (
        <>
          {loadError ? (
            <RequestError
              className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
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
              className="mt-6 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
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
                      className="min-h-11 rounded-[0.65rem] border-0 bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700"
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
                    <p className="mx-auto mt-2 max-w-md leading-7 text-slate-500">
                      Add a registered user to give them organization access.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                      <caption className="sr-only">
                        Organization member accounts, join dates, roles, and
                        available actions
                      </caption>
                      <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                        <tr>
                          <th className="px-6 py-3.5 font-bold" scope="col">
                            Account
                          </th>
                          <th className="px-4 py-3.5 font-bold" scope="col">
                            Joined
                          </th>
                          <th className="px-4 py-3.5 font-bold" scope="col">
                            Organization role
                          </th>
                          <th
                            className="px-6 py-3.5 text-right font-bold"
                            scope="col"
                          >
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr
                            className="border-t border-slate-200 hover:bg-slate-50/60"
                            key={member.id}
                          >
                            <th
                              className="px-6 py-4 font-bold text-slate-950"
                              scope="row"
                            >
                              <span className="block">
                                {member.firstName} {member.lastName}
                              </span>
                              <span className="mt-1 block text-xs font-normal text-slate-500">
                                {member.email}
                                {member.phone ? ` · ${member.phone}` : ''}
                              </span>
                            </th>
                            <td className="px-4 py-4 text-slate-500">
                              {joinedDate(member.joinedAt)}
                            </td>
                            <td className="px-4 py-4">
                              {canManageMembers ? (
                                <>
                                  <label
                                    className="sr-only"
                                    htmlFor={`role-${member.id}`}
                                  >
                                    Role for {member.email}
                                  </label>
                                  <SelectControl
                                    className="min-h-10 rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                                    id={`role-${member.id}`}
                                    value={member.role}
                                    disabled={pendingMemberId === member.id}
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
                                </>
                              ) : (
                                <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                  {roleLabels[member.role]}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {canManageMembers ? (
                                <button
                                  className="min-h-10 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-65"
                                  type="button"
                                  disabled={pendingMemberId === member.id}
                                  onClick={() => void handleRemove(member)}
                                >
                                  Remove
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </OperationalPanel>

              {canManageMembers ? (
                <InvitationList
                  invitations={invitations}
                  statusTime={invitationStatusTime}
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
  onRevoke,
}: {
  invitations: OrganizationInvitation[];
  statusTime: number;
  onRevoke(invitation: OrganizationInvitation): Promise<void>;
}) {
  return (
    <OperationalPanel
      title="Invitations"
      description="Pending and historical organization invitations"
    >
      {invitations.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">
          No invitations created yet.
        </p>
      ) : (
        <ul className="list-none divide-y divide-slate-200 p-0">
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
                <div>
                  <strong>{invitation.email}</strong>
                  <p className="mt-1 text-sm text-slate-500">
                    {roleLabels[invitation.role]} · {status}
                  </p>
                </div>
                {pending ? (
                  <button
                    className="min-h-10 rounded-[0.6rem] border border-slate-200 bg-white px-3 font-bold"
                    type="button"
                    onClick={() => void onRevoke(invitation)}
                  >
                    Revoke
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
