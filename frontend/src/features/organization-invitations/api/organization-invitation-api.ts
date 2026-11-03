import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  createdInvitationResponseSchema,
  invitationPageSchema,
  invitationResponseSchema,
  createOrganizationInvitationSchema,
} from '../model/organization-invitation.schemas';
import type {
  AcceptedOrganizationInvitation,
  CreatedOrganizationInvitation,
  CreateOrganizationInvitationInput,
  OrganizationInvitation,
  OrganizationInvitationPage,
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
  query: {
    page?: number;
    q?: string;
    status?: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  } = {},
): Promise<OrganizationInvitationPage> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 1));
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.status) params.set('status', query.status);
  return invitationPageSchema.parse(
    await request<unknown>(`${organizationPath(organizationId)}?${params}`),
  );
}

export async function resendOrganizationInvitation(
  request: AuthenticatedRequest,
  organizationId: string,
  invitationId: string,
): Promise<CreatedOrganizationInvitation> {
  return createdInvitationResponseSchema.parse(
    await request<unknown>(
      `${organizationPath(organizationId)}/${encodeURIComponent(invitationId)}/resend`,
      { method: 'POST' },
    ),
  );
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

export async function removeOrganizationInvitation(
  request: AuthenticatedRequest,
  organizationId: string,
  invitationId: string,
): Promise<void> {
  await request<void>(
    `${organizationPath(organizationId)}/${encodeURIComponent(invitationId)}`,
    { method: 'DELETE' },
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
