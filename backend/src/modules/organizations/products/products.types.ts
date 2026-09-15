import type { Prisma } from '../../../generated/prisma/client';
import type { InventoryStockStatus } from '../inventory/inventory.types';

export const productSelect = {
  id: true,
  organizationId: true,
  merchantId: true,
  name: true,
  sku: true,
  barcode: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;
export type ProductRecord = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;

export interface ProductInventoryRecord {
  id: string;
  organizationId: string;
  branchId: string;
  productId: string;
  sellingPrice: string;
  quantity: number;
  lowStockThreshold: number;
  stockStatus: InventoryStockStatus;
  createdAt: Date;
  updatedAt: Date;
  branch: { id: string; name: string; code: string | null };
}
