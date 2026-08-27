import type { OrganizationRole } from '@/features/organizations/organization.types';

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedOrganizationInvitation {
  invitation: OrganizationInvitation;
  token: string;
}

export interface OrganizationInvitationPreview {
  organizationName: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
}

export interface AcceptedOrganizationInvitation {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
}

export interface CreateOrganizationInvitationInput {
  email: string;
  role: Extract<OrganizationRole, 'MANAGER' | 'CASHIER' | 'MERCHANT'>;
}
