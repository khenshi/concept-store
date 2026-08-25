export interface SpaceAssignmentMerchant {
  id: string;
  name: string;
  code: string | null;
}

export interface SpaceAssignment {
  id: string;
  organizationId: string;
  branchId: string;
  spaceId: string;
  merchantId: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  merchant: SpaceAssignmentMerchant;
}

export interface CreateSpaceAssignmentInput {
  merchantId: string;
  startDate: string;
}

export interface EndSpaceAssignmentInput {
  endDate: string;
}
