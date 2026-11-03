import type { OrganizationRole } from '../../../generated/prisma/client';

export interface OrganizationMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: OrganizationRole;
  merchantId: string | null;
  branchAccessCount: number;
  joinedAt: Date;
}

export interface OrganizationMemberPage {
  items: OrganizationMember[];
  page: number;
  limit: 15;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface MemberAccessEventView {
  id: string;
  occurredAt: Date;
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
  beforeState: unknown;
  afterState: unknown;
}

export interface MemberAccessEventPage {
  items: MemberAccessEventView[];
  page: number;
  limit: 15;
  total: number;
  totalPages: number;
  hasNext: boolean;
}
