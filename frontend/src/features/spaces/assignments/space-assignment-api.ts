import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  CreateSpaceAssignmentInput,
  EndSpaceAssignmentInput,
  SpaceAssignment,
} from './space-assignment.types';

function organizationPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}`;
}

export function listSpaceAssignments(
  request: AuthenticatedRequest,
  organizationId: string,
  spaceId: string,
): Promise<SpaceAssignment[]> {
  return request<SpaceAssignment[]>(
    `${organizationPath(organizationId)}/spaces/${encodeURIComponent(spaceId)}/assignments`,
  );
}

export function listBranchSpaceAssignments(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
): Promise<SpaceAssignment[]> {
  return request<SpaceAssignment[]>(
    `${organizationPath(organizationId)}/branches/${encodeURIComponent(branchId)}/space-assignments`,
  );
}

export function createSpaceAssignment(
  request: AuthenticatedRequest,
  organizationId: string,
  spaceId: string,
  input: CreateSpaceAssignmentInput,
): Promise<SpaceAssignment> {
  return request<SpaceAssignment>(
    `${organizationPath(organizationId)}/spaces/${encodeURIComponent(spaceId)}/assignments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function endSpaceAssignment(
  request: AuthenticatedRequest,
  organizationId: string,
  assignmentId: string,
  input: EndSpaceAssignmentInput,
): Promise<SpaceAssignment> {
  return request<SpaceAssignment>(
    `${organizationPath(organizationId)}/space-assignments/${encodeURIComponent(assignmentId)}/end`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}
