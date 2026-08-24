import type { MerchantStatus } from '../../generated/prisma/client';

export interface MerchantRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  contactName: string;
  email: string;
  phone: string;
  status: MerchantStatus;
  createdAt: Date;
  updatedAt: Date;
}
