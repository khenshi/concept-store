import type { OrganizationRole } from '../../../generated/prisma/client';

export interface OrganizationMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: OrganizationRole;
  joinedAt: Date;
}
