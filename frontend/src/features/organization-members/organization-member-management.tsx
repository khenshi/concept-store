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
      <p className="workspace-state" role="status">
        Loading organization members…
      </p>
    );
  }

  if (loadError || !organization) {
    return (
      <section className="workspace-state" role="alert">
        <h1>We could not load the organization members.</h1>
        <p>{loadError ?? 'The organization could not be loaded.'}</p>
        <button
          className="text-button"
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
    <section className="member-workspace" aria-labelledby="member-title">
      <div className="workspace-heading">
        <div>
          <p className="workspace-context">{organization.name}</p>
          <h1 id="member-title">Organization members</h1>
          <p>Review staff access and the role assigned to each account.</p>
        </div>
        <span className="role-badge">{organization.role.toLowerCase()}</span>
      </div>

      <OrganizationNavigation
        organizationId={organizationId}
        active="members"
        showMembers={canViewMembers}
      />

      {!canViewMembers ? (
        <section className="member-panel permission-panel">
          <h2>Member access is limited</h2>
          <p>Only organization owners and managers can view the member list.</p>
        </section>
      ) : (
        <>
          {successMessage ? (
            <p className="success-message" role="status">
              {successMessage}
            </p>
          ) : null}
          {actionError ? (
            <p className="form-alert member-action-alert" role="alert">
              {actionError}
            </p>
          ) : null}

          <div
            className={
              canManageMembers
                ? 'member-layout'
                : 'member-layout member-layout-readonly'
            }
          >
            <section
              className="member-panel"
              aria-labelledby="member-list-title"
            >
              <div className="panel-heading">
                <h2 id="member-list-title">People with access</h2>
                <span>{members.length}</span>
              </div>

              {members.length === 0 ? (
                <div className="member-empty">
                  <h3>No members found</h3>
                  <p>Add a registered user to give them organization access.</p>
                </div>
              ) : (
                <ul className="member-list">
                  {members.map((member) => (
                    <li key={member.id}>
                      <div className="member-summary">
                        <strong>{member.email}</strong>
                        <span>Joined {joinedDate(member.joinedAt)}</span>
                      </div>
                      {canManageMembers ? (
                        <div className="member-controls">
                          <label
                            className="sr-only"
                            htmlFor={`role-${member.id}`}
                          >
                            Role for {member.email}
                          </label>
                          <select
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
                            type="button"
                            disabled={pendingMemberId === member.id}
                            onClick={() => void handleRemove(member)}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className="role-badge">
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
    <section className="member-panel" aria-labelledby="add-member-title">
      <div className="panel-heading">
        <h2 id="add-member-title">Add a member</h2>
      </div>
      <p className="panel-description">
        The person must already have a registered Concept Store account.
      </p>
      <form className="member-form" onSubmit={handleSubmit} noValidate>
        {submissionError ? (
          <p className="form-alert" role="alert">
            {submissionError}
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="member-email">Account email</label>
          <input
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
            <p id="member-email-error" className="field-error">
              {emailError}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="member-role">Organization role</label>
          <select id="member-role" name="role" defaultValue="CASHIER">
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </div>
        <button
          className="primary-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Adding member…' : 'Add member'}
        </button>
      </form>
    </section>
  );
}
