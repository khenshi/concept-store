'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '@/features/auth/auth-client';
import { useAuth } from '@/features/auth/auth-context';
import { getOrganization } from '@/features/organizations/organization-api';
import { OrganizationNavigation } from '@/features/organizations/organization-navigation';
import type {
  OrganizationAccess,
  OrganizationRole,
} from '@/features/organizations/organization.types';
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
  const [organization, setOrganization] = useState<OrganizationAccess | null>(
    null,
  );
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const organizationResult = await getOrganization(request, organizationId);
      setOrganization(organizationResult);

      if (
        organizationResult.role === 'OWNER' ||
        organizationResult.role === 'MANAGER'
      ) {
        setMembers(await listOrganizationMembers(request, organizationId));
      } else {
        setMembers([]);
      }
    } catch (cause: unknown) {
      setLoadError(errorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, request]);

  useEffect(() => {
    let active = true;
    void getOrganization(request, organizationId)
      .then(async (organizationResult) => {
        if (!active) return;
        setOrganization(organizationResult);

        if (
          organizationResult.role === 'OWNER' ||
          organizationResult.role === 'MANAGER'
        ) {
          const memberResult = await listOrganizationMembers(
            request,
            organizationId,
          );
          if (active) setMembers(memberResult);
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
  }, [organizationId, request]);

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
    const confirmed = window.confirm(
      `Remove ${member.email} from this organization?`,
    );
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

  if (isLoading) {
    return (
      <p
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-5xl"
        role="status"
      >
        Loading organization members…
      </p>
    );
  }

  if (loadError || !organization) {
    return (
      <section
        className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-3xl"
        role="alert"
      >
        <h1 className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]">
          We could not load the organization members.
        </h1>
        <p className="mt-4 leading-7 text-slate-500">
          {loadError ?? 'The organization could not be loaded.'}
        </p>
        <button
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 font-bold text-emerald-700 underline underline-offset-3"
          type="button"
          onClick={() => void load()}
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
    <section
      className="mx-auto mt-[clamp(4rem,10vh,7rem)] w-full max-w-5xl"
      aria-labelledby="member-title"
    >
      <div className="flex items-start justify-between gap-6 max-sm:grid">
        <div>
          <p className="mb-2 text-sm font-bold text-emerald-700">
            {organization.name}
          </p>
          <h1
            className="max-w-none text-[clamp(2rem,6vw,3rem)] leading-tight font-bold tracking-[-0.04em]"
            id="member-title"
          >
            Organization members
          </h1>
          <p className="mt-4 leading-7 text-slate-500">
            Review staff access and the role assigned to each account.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 capitalize">
          {organization.role.toLowerCase()}
        </span>
      </div>

      <OrganizationNavigation
        organizationId={organizationId}
        active="members"
        showMembers={canViewMembers}
        showMerchants={canViewMembers}
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
          {successMessage ? (
            <p
              className="mt-6 rounded-lg border border-green-600 bg-white px-4 py-3"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}
          {actionError ? (
            <p
              className="mt-6 rounded-lg border border-red-600 bg-white p-3 text-sm text-red-600"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}

          <div
            className={`mt-6 grid items-start gap-5 ${canManageMembers ? 'md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]' : 'grid-cols-1'}`}
          >
            <section
              className="rounded-xl border border-slate-200 bg-white p-6"
              aria-labelledby="member-list-title"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="m-0 text-base font-bold" id="member-list-title">
                  People with access
                </h2>
                <span className="min-w-7 rounded-full bg-emerald-100 px-2 py-1 text-center text-xs font-bold text-emerald-700">
                  {members.length}
                </span>
              </div>

              {members.length === 0 ? (
                <div className="py-10 text-center">
                  <h3 className="m-0 text-base font-bold">No members found</h3>
                  <p className="mx-auto mt-2 max-w-md leading-7 text-slate-500">
                    Add a registered user to give them organization access.
                  </p>
                </div>
              ) : (
                <ul className="mt-5 list-none p-0">
                  {members.map((member) => (
                    <li
                      className="flex items-center justify-between gap-4 border-b border-slate-200 py-4 last:border-b-0 max-sm:grid max-sm:items-stretch"
                      key={member.id}
                    >
                      <div className="grid gap-1">
                        <strong>{member.email}</strong>
                        <span className="text-sm text-slate-500">
                          Joined {joinedDate(member.joinedAt)}
                        </span>
                      </div>
                      {canManageMembers ? (
                        <div className="flex items-center gap-2 max-sm:flex-wrap max-sm:items-stretch">
                          <label
                            className="sr-only"
                            htmlFor={`role-${member.id}`}
                          >
                            Role for {member.email}
                          </label>
                          <select
                            className="min-h-10 rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                            id={`role-${member.id}`}
                            value={member.role}
                            disabled={pendingMemberId === member.id}
                            onChange={(event) =>
                              void handleRoleChange(
                                member,
                                event.target.value as OrganizationRole,
                              )
                            }
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>
                                {roleLabels[role]}
                              </option>
                            ))}
                          </select>
                          <button
                            className="min-h-10 cursor-pointer rounded-[0.6rem] border border-slate-200 bg-white px-3 py-2 text-sm font-bold disabled:cursor-wait disabled:opacity-65"
                            type="button"
                            disabled={pendingMemberId === member.id}
                            onClick={() => void handleRemove(member)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          {roleLabels[member.role]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {canManageMembers ? (
              <AddMemberForm
                organizationId={organizationId}
                onAdded={(member) => {
                  setMembers((current) => [...current, member]);
                  setSuccessMessage(
                    `${member.email} was added as ${roleLabels[member.role]}.`,
                  );
                  setActionError(null);
                }}
              />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function AddMemberForm({
  organizationId,
  onAdded,
}: {
  organizationId: string;
  onAdded(member: OrganizationMember): void;
}) {
  const { request } = useAuth();
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <section
      className="rounded-xl border border-slate-200 bg-white p-6"
      aria-labelledby="add-member-title"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="m-0 text-base font-bold" id="add-member-title">
          Add a member
        </h2>
      </div>
      <p className="mt-4 leading-7 text-slate-500">
        The person must already have a registered Concept Store account.
      </p>
      <form className="mt-5 grid gap-4" onSubmit={handleSubmit} noValidate>
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
          <select
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
          </select>
        </div>
        <button
          className="w-fit min-h-11 cursor-pointer rounded-[0.65rem] border-0 bg-emerald-600 px-4.5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Adding member…' : 'Add member'}
        </button>
      </form>
    </section>
  );
}
