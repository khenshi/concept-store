import type {
  AddOrganizationMemberInput,
  AuthenticatedRequest,
  OrganizationMember,
} from './organization-member.types';
import type { OrganizationRole } from '@/features/organizations/organization.types';

function membersPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/members`;
}

export function listOrganizationMembers(
  request: AuthenticatedRequest,
  organizationId: string,
): Promise<OrganizationMember[]> {
  return request<OrganizationMember[]>(membersPath(organizationId));
}

export function addOrganizationMember(
  request: AuthenticatedRequest,
  organizationId: string,
  input: AddOrganizationMemberInput,
): Promise<OrganizationMember> {
  return request<OrganizationMember>(membersPath(organizationId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateOrganizationMemberRole(
  request: AuthenticatedRequest,
  organizationId: string,
  userId: string,
  role: OrganizationRole,
): Promise<OrganizationMember> {
  return request<OrganizationMember>(
    `${membersPath(organizationId)}/${encodeURIComponent(userId)}/role`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    },
  );
}

export function removeOrganizationMember(
  request: AuthenticatedRequest,
  organizationId: string,
  userId: string,
): Promise<void> {
  return request<void>(
    `${membersPath(organizationId)}/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}
