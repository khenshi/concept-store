import type { Product } from '../../../generated/prisma/client';

export type ProductRecord = Product;

export interface ProductInventoryRecord {
  id: string;
  organizationId: string;
  branchId: string;
  productId: string;
  sellingPrice: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
  branch: { id: string; name: string; code: string | null };
}
