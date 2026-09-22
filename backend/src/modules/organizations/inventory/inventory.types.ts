import type {
  InventoryMovement,
  MerchantStatus,
  ProductStatus,
} from '../../../generated/prisma/client';

export const inventoryProductSelect = {
  id: true,
  merchantId: true,
  name: true,
  sku: true,
  barcode: true,
  status: true,
  merchant: { select: { id: true, name: true, status: true } },
} as const;

export interface BranchInventoryRecord {
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
  product: {
    id: string;
    merchantId: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    status: ProductStatus;
    merchant: { id: string; name: string; status: MerchantStatus };
  };
}

export interface InventoryHealthSummary {
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export enum InventoryStockStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export function deriveInventoryStockStatus(input: {
  quantity: number;
  lowStockThreshold: number;
}): InventoryStockStatus {
  if (input.quantity === 0) return InventoryStockStatus.OUT_OF_STOCK;
  if (input.lowStockThreshold > 0 && input.quantity <= input.lowStockThreshold)
    return InventoryStockStatus.LOW_STOCK;
  return InventoryStockStatus.IN_STOCK;
}

export type InventoryMovementRecord = Omit<
  InventoryMovement,
  'saleItemId' | 'refundItemId'
>;

export type InventoryMovementHistoryRecord = Omit<
  InventoryMovementRecord,
  'createdById'
> & {
  actorName: string;
};

export type MerchantMovementHistoryRecord = Omit<
  InventoryMovementHistoryRecord,
  'actorName'
>;

export interface InventoryMovementPage<T = InventoryMovementRecord> {
  items: T[];
  nextCursor: string | null;
}

// Internal checkout relationships are not part of the inventory history contract.
export const inventoryMovementSelect = {
  id: true,
  organizationId: true,
  branchId: true,
  branchInventoryId: true,
  type: true,
  quantityChange: true,
  quantityAfter: true,
  reason: true,
  createdById: true,
  requestId: true,
  createdAt: true,
} as const;

export const inventoryMovementHistorySelect = {
  id: true,
  organizationId: true,
  branchId: true,
  branchInventoryId: true,
  type: true,
  quantityChange: true,
  quantityAfter: true,
  reason: true,
  requestId: true,
  createdAt: true,
  createdBy: { select: { firstName: true, lastName: true } },
} as const;
