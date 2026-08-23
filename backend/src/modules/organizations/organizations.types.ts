import type { OrganizationRole } from '@prisma/client';

export interface OrganizationAccess {
  id: string;
  name: string;
  role: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
}
