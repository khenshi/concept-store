import type { OrganizationRole } from '../../../generated/prisma/client';

export interface OrganizationMember {
  id: string;
  email: string;
  role: OrganizationRole;
  joinedAt: Date;
}
