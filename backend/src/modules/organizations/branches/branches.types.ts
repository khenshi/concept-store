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

export interface BranchOverview {
  branch: BranchRecord;
  statistics: {
    todaySaleCount: number;
    todayGrossSales: string;
    inventoryUnits: number;
    outOfStockProducts: number;
    totalSpaces: number;
    occupiedSpaces: number;
    vacantSpaces: number;
    activeMerchants: number;
  };
}
