export const MERCHANT_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'ENDED',
] as const;

export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

export interface Merchant {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  contactName: string;
  email: string | null;
  phone: string;
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
}

export type MerchantSummary = Pick<Merchant, 'id' | 'name' | 'code' | 'status'>;
export type MerchantView = Merchant | MerchantSummary;

export interface MerchantInput {
  name: string;
  code?: string;
  contactName: string;
  email?: string;
  phone: string;
}

export type MerchantUpdateInput = Omit<MerchantInput, 'code' | 'email'> & {
  code: string | null;
  email: string | null;
};

export interface MerchantFilters {
  q?: string;
  status?: MerchantStatus;
}
