import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type { Branch, BranchInput, BranchUpdateInput } from './branch.types';

function branchPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/branches`;
}

export function listBranches(
  request: AuthenticatedRequest,
  organizationId: string,
): Promise<Branch[]> {
  return request<Branch[]>(branchPath(organizationId));
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
