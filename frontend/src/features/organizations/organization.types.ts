export type OrganizationRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'MERCHANT';

export interface OrganizationAccess {
  id: string;
  name: string;
  role: OrganizationRole;
  createdAt: string;
  updatedAt: string;
}

export type AuthenticatedRequest = <T>(
  path: string,
  init?: RequestInit,
) => Promise<T>;
