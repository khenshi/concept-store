import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import type {
  Branch,
  BranchDirectoryPage,
  BranchStatus,
  BranchInput,
  BranchUpdateInput,
  BranchView,
} from '../model/branch.types';
import {
  branchDirectoryPageSchema,
  branchIdentitySchema,
  branchResponseSchema,
  branchViewSchema,
} from '../model/branch.schemas';

function branchPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/branches`;
}

function branchDirectoryPath(organizationId: string): string {
  return `${branchPath(organizationId)}/directory`;
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

export async function listBranchDirectory(
  request: AuthenticatedRequest,
  organizationId: string,
  query: {
    search?: string;
    status?: BranchStatus;
    page: number;
  },
): Promise<BranchDirectoryPage> {
  const params = new URLSearchParams({ page: String(query.page) });
  if (query.search) params.set('q', query.search);
  if (query.status) params.set('status', query.status);
  return branchDirectoryPageSchema.parse(
    await request<unknown>(`${branchDirectoryPath(organizationId)}?${params}`),
  );
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

export async function updateBranchStatus(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  status: BranchStatus,
): Promise<Branch> {
  return branchResponseSchema.parse(
    await request<unknown>(
      `${branchPath(organizationId)}/${encodeURIComponent(branchId)}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    ),
  );
}
