import { Prisma } from '../../generated/prisma/client';

export const posInventoryInclude = {
  product: {
    include: { merchant: { select: { id: true, name: true, code: true } } },
  },
} satisfies Prisma.InventoryInclude;

export type PosInventoryRow = Prisma.InventoryGetPayload<{
  include: typeof posInventoryInclude;
}>;

export interface PosProductRecord {
  id: string;
  branchId: string;
  merchantId: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: string;
  quantity: number;
  available: boolean;
  merchant: PosInventoryRow['product']['merchant'];
}

export interface PosProductPageRecord {
  items: PosProductRecord[];
  total: number;
  offset: number;
  limit: number;
}
