import type {
  AuthenticatedRequest,
  OrganizationRole,
} from '@/features/organizations/model/organization.types';

export interface OrganizationMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: OrganizationRole;
  joinedAt: string;
  merchantId?: string | null;
}

export type { AuthenticatedRequest };
