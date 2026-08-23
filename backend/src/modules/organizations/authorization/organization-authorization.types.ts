import type { OrganizationRole } from '@prisma/client';

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}
