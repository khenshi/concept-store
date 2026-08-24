import type {
  AuthenticatedRequest,
  OrganizationRole,
} from '@/features/organizations/organization.types';

export interface OrganizationMember {
  id: string;
  email: string;
  role: OrganizationRole;
  joinedAt: string;
}

export interface AddOrganizationMemberInput {
  email: string;
  role: OrganizationRole;
}

export type { AuthenticatedRequest };
