export interface SpaceAssignmentMerchant {
  id: string;
  name: string;
  code: string | null;
}

export interface SpaceAssignmentSpace {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
}

export interface SpaceAssignment {
  id: string;
  organizationId: string;
  branchId: string;
  spaceId: string;
  merchantId: string;
  agreementId: string | null;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  merchant: SpaceAssignmentMerchant;
  space?: SpaceAssignmentSpace;
}

export interface EndSpaceAssignmentInput {
  endDate: string;
}
