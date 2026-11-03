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
  branchAccessCount: number;
  joinedAt: string;
  merchantId?: string | null;
}

export interface OrganizationMemberPage {
  items: OrganizationMember[];
  page: number;
  limit: 15;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export type MemberAccessEvent = {
  id: string;
  occurredAt: string;
  operation:
    | 'ROLE_CHANGED'
    | 'MERCHANT_LINKED'
    | 'MERCHANT_UNLINKED'
    | 'BRANCH_GRANTED'
    | 'BRANCH_REVOKED'
    | 'MEMBER_REMOVED';
  actorId: string;
  actorName: string;
  targetUserId: string;
  targetName: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
};

export interface MemberAccessEventPage {
  items: MemberAccessEvent[];
  page: number;
  limit: 15;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export type { AuthenticatedRequest };
