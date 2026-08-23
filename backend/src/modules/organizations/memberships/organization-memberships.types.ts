import type { OrganizationRole } from '@prisma/client';

export interface OrganizationMember {
  id: string;
  email: string;
  role: OrganizationRole;
  joinedAt: Date;
}
