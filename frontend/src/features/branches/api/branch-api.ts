import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import type {
  Branch,
  BranchInput,
  BranchUpdateInput,
  BranchView,
} from '../model/branch.types';
import {
  branchIdentitySchema,
  branchResponseSchema,
  branchViewSchema,
} from '../model/branch.schemas';

function branchPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/branches`;
}

export async function listBranches(
  request: AuthenticatedRequest,
  organizationId: string,
  role?: string,
): Promise<BranchView[]> {
  const result = await request<unknown>(branchPath(organizationId));
  return (
    role === 'MERCHANT'
      ? branchIdentitySchema
      : role
        ? branchResponseSchema
        : branchViewSchema
  )
    .array()
    .parse(result);
}

export function createBranch(
  request: AuthenticatedRequest,
  organizationId: string,
  input: BranchInput,
): Promise<Branch> {
  return request<Branch>(branchPath(organizationId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getBranch(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  role?: string,
): Promise<BranchView> {
  const result = await request<unknown>(
    `${branchPath(organizationId)}/${encodeURIComponent(branchId)}`,
  );
  return (
    role === 'MERCHANT'
      ? branchIdentitySchema
      : role
        ? branchResponseSchema
        : branchViewSchema
  ).parse(result);
}

export function updateBranch(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: BranchUpdateInput,
): Promise<Branch> {
  return request<Branch>(
    `${branchPath(organizationId)}/${encodeURIComponent(branchId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}
