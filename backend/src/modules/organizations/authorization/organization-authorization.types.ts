import type {
  OrganizationRole,
  OrganizationStatus,
} from '../../../generated/prisma/client';

export interface OrganizationContext {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  merchantId?: string | null;
  status?: OrganizationStatus;
}
