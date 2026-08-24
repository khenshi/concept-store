import type { SpaceStatus, SpaceType } from '../../generated/prisma/client';

export interface SpaceRecord {
  id: string;
  organizationId: string;
  branchId: string;
  code: string;
  name: string;
  type: SpaceType;
  customType: string | null;
  status: SpaceStatus;
  createdAt: Date;
  updatedAt: Date;
}
