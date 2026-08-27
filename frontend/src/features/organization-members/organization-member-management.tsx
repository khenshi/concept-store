'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
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
  addOrganizationMember,
  listOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationMemberRole,
} from './organization-member-api';
import { addOrganizationMemberSchema } from './organization-member.schemas';
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setMembers(await listOrganizationMembers(request, organizationId));
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, request]);

  useEffect(() => {
    if (!organization) return;
    if (organization.role !== 'OWNER' && organization.role !== 'MANAGER') {
      return;
    }
    let active = true;
    void listOrganizationMembers(request, organizationId)
      .then((memberResult) => {
        if (active) setMembers(memberResult);
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
                      Add member
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

              {canManageMembers && isAddMemberOpen ? (
                <AddMemberForm
                  organizationId={organizationId}
                  onCancel={() => setIsAddMemberOpen(false)}
                  onAdded={(member) => {
                    setMembers((current) => [...current, member]);
                    setSuccessMessage(
                      `${member.email} was added as ${roleLabels[member.role]}.`,
                    );
                    setActionError(null);
                    setIsAddMemberOpen(false);
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

function AddMemberForm({
  organizationId,
  onAdded,
  onCancel,
}: {
  organizationId: string;
  onAdded(member: OrganizationMember): void;
  onCancel(): void;
}) {
  const { request } = useAuth();
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) onCancel();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSubmitting, onCancel]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = addOrganizationMemberSchema.safeParse({
      email: formData.get('email'),
      role: formData.get('role'),
    });

    setEmailError(null);
    setSubmissionError(null);
    if (!result.success) {
      setEmailError(result.error.flatten().fieldErrors.email?.[0] ?? null);
      window.requestAnimationFrame(() => {
        const emailField = form.elements.namedItem('email');
        if (emailField instanceof HTMLElement) emailField.focus();
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const member = await addOrganizationMember(
        request,
        organizationId,
        result.data,
      );
      form.reset();
      onAdded(member);
    } catch (cause: unknown) {
      setSubmissionError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2
          className="text-xl font-bold tracking-tight text-slate-950"
          id="add-member-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Add a member
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          The person must already have a registered Concept Store account.
        </p>
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
          {submissionError ? (
            <p
              className="m-0 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
              role="alert"
            >
              {submissionError}
            </p>
          ) : null}
          <div className="grid gap-2">
            <label className="text-sm font-bold" htmlFor="member-email">
              Account email
            </label>
            <input
              className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 aria-invalid:border-red-600"
              id="member-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'member-email-error' : undefined}
            />
            {emailError ? (
              <p id="member-email-error" className="m-0 text-sm text-red-600">
                {emailError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-bold" htmlFor="member-role">
              Organization role
            </label>
            <SelectControl
              className="min-h-12 w-full rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2.5"
              id="member-role"
              name="role"
              defaultValue="CASHIER"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </SelectControl>
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-3">
            <button
              className="min-h-11 rounded-[0.6rem] border border-slate-200 bg-white px-4 font-bold text-slate-700"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="min-h-11 cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding member…' : 'Add member'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
