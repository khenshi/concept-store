export interface BranchRecord {
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
  createdAt: Date;
  updatedAt: Date;
}
