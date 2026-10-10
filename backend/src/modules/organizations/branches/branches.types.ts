import type { BranchStatus } from '../../../generated/prisma/client';

export interface BranchRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  status: BranchStatus;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  countryCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BranchDirectoryItem extends BranchRecord {
  merchantCount: number;
}

export interface BranchDirectoryPage {
  items: BranchDirectoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  summary: {
    total: number;
    active: number;
    inactive: number;
  };
}
