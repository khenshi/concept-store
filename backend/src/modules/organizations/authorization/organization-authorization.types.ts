import type { OrganizationRole } from '../../../generated/prisma/client';

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}
