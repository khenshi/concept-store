import type {
  AuthenticatedRequest,
  OrganizationMember,
} from '../model/organization-member.types';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { z } from 'zod';
import {
  accessBranchSchema,
  accessMerchantSchema,
  memberAccessEventPageSchema,
  memberPageSchema,
  memberResponseSchema,
} from '../model/member-access.schemas';
import type {
  MemberAccessEventPage,
  OrganizationMemberPage,
} from '../model/organization-member.types';

function membersPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/members`;
}

export async function listOrganizationMembers(
  request: AuthenticatedRequest,
  organizationId: string,
  query: { page?: number; q?: string } = {},
): Promise<OrganizationMemberPage> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 1));
  if (query.q?.trim()) params.set('q', query.q.trim());
  return memberPageSchema.parse(
    await request<unknown>(`${membersPath(organizationId)}?${params}`),
  );
}

export async function updateOrganizationMemberRole(
  request: AuthenticatedRequest,
  organizationId: string,
  userId: string,
  role: OrganizationRole,
  merchantId?: string,
): Promise<OrganizationMember> {
  return memberResponseSchema.parse(
    await request<unknown>(
      `${membersPath(organizationId)}/${encodeURIComponent(userId)}/role`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          ...(role === 'MERCHANT' ? { merchantId } : {}),
        }),
      },
    ),
  );
}

export async function listMemberAccessHistory(
  request: AuthenticatedRequest,
  organizationId: string,
  query: { page?: number; userId?: string } = {},
): Promise<MemberAccessEventPage> {
  const params = new URLSearchParams({ page: String(query.page ?? 1) });
  if (query.userId) params.set('userId', query.userId);
  return memberAccessEventPageSchema.parse(
    await request<unknown>(
      `${membersPath(organizationId)}/access-history?${params}`,
    ),
  );
}

export async function loadMemberAccessOptions(
  request: AuthenticatedRequest,
  organizationId: string,
) {
  const path = `/organizations/${encodeURIComponent(organizationId)}`;
  const [branches, merchants] = await Promise.all([
    request<unknown>(`${path}/branches`),
    request<unknown>(`${path}/merchants`),
  ]);
  return {
    branches: accessBranchSchema.array().parse(branches),
    merchants: accessMerchantSchema.array().parse(merchants),
  };
}

export async function listMemberBranches(
  request: AuthenticatedRequest,
  organizationId: string,
  userId: string,
) {
  return accessBranchSchema
    .array()
    .parse(
      await request<unknown>(
        `${membersPath(organizationId)}/${encodeURIComponent(userId)}/branches`,
      ),
    );
}

export function setMemberBranch(
  request: AuthenticatedRequest,
  organizationId: string,
  userId: string,
  branchId: string,
  grant: boolean,
) {
  return request<void>(
    `${membersPath(organizationId)}/${encodeURIComponent(userId)}/branches/${encodeURIComponent(branchId)}`,
    {
      method: grant ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
}

export async function setMemberMerchant(
  request: AuthenticatedRequest,
  organizationId: string,
  userId: string,
  merchantId: string,
) {
  return z.object({ merchantId: z.uuidv4() }).parse(
    await request<unknown>(
      `${membersPath(organizationId)}/${encodeURIComponent(userId)}/merchant`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId }),
      },
    ),
  );
}

export function removeOrganizationMember(
  request: AuthenticatedRequest,
  organizationId: string,
  userId: string,
): Promise<void> {
  return request<void>(
    `${membersPath(organizationId)}/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}
