import type {
  AuthenticatedRequest,
  OrganizationAccess,
} from './organization.types';

export function listOrganizations(
  request: AuthenticatedRequest,
): Promise<OrganizationAccess[]> {
  return request<OrganizationAccess[]>('/organizations');
}

export function createOrganization(
  request: AuthenticatedRequest,
  name: string,
): Promise<OrganizationAccess> {
  return request<OrganizationAccess>('/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function getOrganization(
  request: AuthenticatedRequest,
  organizationId: string,
): Promise<OrganizationAccess> {
  return request<OrganizationAccess>(
    `/organizations/${encodeURIComponent(organizationId)}`,
  );
}
