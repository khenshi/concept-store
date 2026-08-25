import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type { Space, SpaceInput, SpaceUpdateInput } from './space.types';

function organizationPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}`;
}

export function listSpaces(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
): Promise<Space[]> {
  return request<Space[]>(
    `${organizationPath(organizationId)}/branches/${encodeURIComponent(branchId)}/spaces`,
  );
}

export function createSpace(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: SpaceInput,
): Promise<Space> {
  return request<Space>(
    `${organizationPath(organizationId)}/branches/${encodeURIComponent(branchId)}/spaces`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function updateSpace(
  request: AuthenticatedRequest,
  organizationId: string,
  spaceId: string,
  input: SpaceUpdateInput,
): Promise<Space> {
  return request<Space>(
    `${organizationPath(organizationId)}/spaces/${encodeURIComponent(spaceId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}
