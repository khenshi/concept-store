import type { OrganizationRole } from '../../../generated/prisma/client';

export interface OrganizationInvitationView {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreatedOrganizationInvitation {
  invitation: OrganizationInvitationView;
  token: string;
}

export interface OrganizationInvitationPreview {
  organizationName: string;
  email: string;
  role: OrganizationRole;
  expiresAt: Date;
}

export interface AcceptedOrganizationInvitation {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
}
