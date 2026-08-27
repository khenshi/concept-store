import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  AcceptedOrganizationInvitation,
  CreatedOrganizationInvitation,
  CreateOrganizationInvitationInput,
  OrganizationInvitation,
  OrganizationInvitationPreview,
} from './organization-invitation.types';

function organizationPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/invitations`;
}

export function createOrganizationInvitation(
  request: AuthenticatedRequest,
  organizationId: string,
  input: CreateOrganizationInvitationInput,
): Promise<CreatedOrganizationInvitation> {
  return request<CreatedOrganizationInvitation>(
    organizationPath(organizationId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function listOrganizationInvitations(
  request: AuthenticatedRequest,
  organizationId: string,
): Promise<OrganizationInvitation[]> {
  return request<OrganizationInvitation[]>(organizationPath(organizationId));
}

export function revokeOrganizationInvitation(
  request: AuthenticatedRequest,
  organizationId: string,
  invitationId: string,
): Promise<OrganizationInvitation> {
  return request<OrganizationInvitation>(
    `${organizationPath(organizationId)}/${encodeURIComponent(invitationId)}/revoke`,
    { method: 'PATCH' },
  );
}

export function previewOrganizationInvitation(
  request: AuthenticatedRequest,
  token: string,
): Promise<OrganizationInvitationPreview> {
  return request<OrganizationInvitationPreview>(
    `/organization-invitations/${encodeURIComponent(token)}`,
  );
}

export function acceptOrganizationInvitation(
  request: AuthenticatedRequest,
  token: string,
): Promise<AcceptedOrganizationInvitation> {
  return request<AcceptedOrganizationInvitation>(
    `/organization-invitations/${encodeURIComponent(token)}/accept`,
    { method: 'POST' },
  );
}
