export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchInput {
  name: string;
  code?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode?: string;
  countryCode: string;
}

export type BranchUpdateInput = Omit<
  BranchInput,
  'code' | 'addressLine2' | 'postalCode'
> & {
  code: string | null;
  addressLine2: string | null;
  postalCode: string | null;
};
