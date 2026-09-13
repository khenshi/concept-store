import type { OrganizationRole } from '../../../generated/prisma/client';

export interface OrganizationInvitationView {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  merchantId: string | null;
  merchant: {
    id: string;
    name: string;
    code: string | null;
    status: string;
  } | null;
  branches: { branch: { id: string; name: string; code: string | null } }[];
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
