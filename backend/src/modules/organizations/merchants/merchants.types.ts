import type { MerchantStatus } from '../../../generated/prisma/client';

export interface MerchantRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  contactName: string;
  email: string | null;
  phone: string;
  status: MerchantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MerchantDirectoryPage {
  items: (MerchantRecord | MerchantIdentity)[];
  page: number;
  limit: 15;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface MerchantIdentity {
  id: string;
  name: string;
  code: string | null;
  status: MerchantStatus;
}
