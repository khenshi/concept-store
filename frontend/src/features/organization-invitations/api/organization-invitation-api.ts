import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  createdInvitationResponseSchema,
  invitationResponseSchema,
  createOrganizationInvitationSchema,
} from '../model/organization-invitation.schemas';
import type {
  AcceptedOrganizationInvitation,
  CreatedOrganizationInvitation,
  CreateOrganizationInvitationInput,
  OrganizationInvitation,
  OrganizationInvitationPreview,
} from '../model/organization-invitation.types';

function organizationPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/invitations`;
}

export async function createOrganizationInvitation(
  request: AuthenticatedRequest,
  organizationId: string,
  input: CreateOrganizationInvitationInput,
): Promise<CreatedOrganizationInvitation> {
  return createdInvitationResponseSchema.parse(
    await request<unknown>(organizationPath(organizationId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createOrganizationInvitationSchema.parse(input)),
    }),
  );
}

export async function listOrganizationInvitations(
  request: AuthenticatedRequest,
  organizationId: string,
): Promise<OrganizationInvitation[]> {
  return invitationResponseSchema
    .array()
    .parse(await request<unknown>(organizationPath(organizationId)));
}

export async function revokeOrganizationInvitation(
  request: AuthenticatedRequest,
  organizationId: string,
  invitationId: string,
): Promise<OrganizationInvitation> {
  return invitationResponseSchema.parse(
    await request<unknown>(
      `${organizationPath(organizationId)}/${encodeURIComponent(invitationId)}/revoke`,
      { method: 'PATCH' },
    ),
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
