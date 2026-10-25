import type {
  OrganizationRole,
  OrganizationStatus,
} from '../../generated/prisma/client';

export interface OrganizationAccess {
  id: string;
  name: string;
  status: OrganizationStatus;
  role: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
}
