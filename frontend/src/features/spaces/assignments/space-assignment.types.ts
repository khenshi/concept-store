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
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  merchant: SpaceAssignmentMerchant;
  space?: SpaceAssignmentSpace;
}

export interface CreateSpaceAssignmentInput {
  merchantId: string;
  startDate: string;
}

export interface EndSpaceAssignmentInput {
  endDate: string;
}
