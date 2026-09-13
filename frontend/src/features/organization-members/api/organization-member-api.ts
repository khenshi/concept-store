import type {
  AuthenticatedRequest,
  OrganizationMember,
} from '../model/organization-member.types';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import { z } from 'zod';
import {
  accessBranchSchema,
  accessMerchantSchema,
  memberResponseSchema,
} from '../model/member-access.schemas';

function membersPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/members`;
}

export async function listOrganizationMembers(
  request: AuthenticatedRequest,
  organizationId: string,
): Promise<OrganizationMember[]> {
  return memberResponseSchema
    .array()
    .parse(await request<unknown>(membersPath(organizationId)));
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
