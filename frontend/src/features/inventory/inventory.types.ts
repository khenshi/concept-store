import type { Product, ProductStatus } from '@/features/products/product.types';

export type InventoryMovementType = 'STOCK_IN' | 'ADJUSTMENT';

export interface InventoryBranchSummary {
  id: string;
  name: string;
  code: string | null;
}

export interface InventoryItem {
  organizationId: string;
  branchId: string;
  productId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product: Product;
  branch: InventoryBranchSummary;
}

export interface InventoryPage {
  items: InventoryItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface InventoryFilters {
  branchId?: string;
  merchantId?: string;
  productId?: string;
  status?: ProductStatus;
  search?: string;
  offset?: number;
  limit?: number;
}

export interface InventoryMovement {
  id: string;
  organizationId: string;
  branchId: string;
  productId: string;
  quantityChange: number;
  type: InventoryMovementType;
  referenceId: string | null;
  note: string | null;
  createdById: string;
  createdAt: string;
  product: Pick<Product, 'id' | 'name' | 'sku' | 'barcode'>;
  branch: InventoryBranchSummary;
  createdBy: { id: string; email: string };
}

export interface InventoryMovementPage {
  items: InventoryMovement[];
  nextCursor: string | null;
}

export interface InventoryMovementFilters {
  branchId?: string;
  productId?: string;
  type?: InventoryMovementType;
  cursor?: string;
  limit?: number;
}

export interface StockInInput {
  productId: string;
  branchId: string;
  quantity: number;
  referenceId?: string;
  note?: string;
}

export interface InventoryAdjustmentInput {
  productId: string;
  branchId: string;
  quantityChange: number;
  note: string;
  referenceId?: string;
}

export interface InventoryOperation {
  inventory: Omit<InventoryItem, 'product' | 'branch'>;
  movement: Omit<InventoryMovement, 'product' | 'branch' | 'createdBy'>;
}
