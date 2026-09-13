import type { OrganizationRole } from '@/features/organizations/model/organization.types';

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  merchantId?: string | null;
  merchant?: {
    id: string;
    name: string;
    code: string | null;
    status: string;
  } | null;
  branches?: { branch: { id: string; name: string; code: string | null } }[];
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
  branchIds?: string[];
  merchantId?: string;
  email: string;
  role: Extract<OrganizationRole, 'MANAGER' | 'CASHIER' | 'MERCHANT'>;
}
