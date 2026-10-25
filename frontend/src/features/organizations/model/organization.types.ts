export type OrganizationRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'MERCHANT';
export type OrganizationStatus = 'ACTIVE' | 'INACTIVE';

export interface OrganizationAccess {
  id: string;
  name: string;
  role: OrganizationRole;
  status?: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

export type AuthenticatedRequest = <T>(
  path: string,
  init?: RequestInit,
) => Promise<T>;
