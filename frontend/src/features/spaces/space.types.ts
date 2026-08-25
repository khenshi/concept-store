export type SpaceType =
  'RACK' | 'SHELF' | 'CABINET' | 'BOOTH' | 'TABLE' | 'DRAWER' | 'CUSTOM';

export type SpaceStatus = 'ACTIVE' | 'INACTIVE';

export interface Space {
  id: string;
  organizationId: string;
  branchId: string;
  code: string;
  name: string;
  type: SpaceType;
  customType: string | null;
  status: SpaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceInput {
  code: string;
  name: string;
  type: SpaceType;
  customType?: string;
  status?: SpaceStatus;
}

export type SpaceUpdateInput = Omit<SpaceInput, 'customType'> & {
  customType: string | null;
};
