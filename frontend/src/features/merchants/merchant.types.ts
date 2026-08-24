export type MerchantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ENDED';

export interface Merchant {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  contactName: string;
  email: string;
  phone: string;
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
  branches: MerchantBranchSummary[];
}

export interface MerchantBranchSummary {
  id: string;
  name: string;
  code: string | null;
}

export interface MerchantInput {
  name: string;
  code?: string;
  contactName: string;
  email: string;
  phone: string;
  branchIds: string[];
}

export type MerchantUpdateInput = Omit<MerchantInput, 'code' | 'branchIds'> & {
  code: string | null;
};

export interface MerchantFilters {
  search?: string;
  status?: MerchantStatus;
}
