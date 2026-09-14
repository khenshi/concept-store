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

export type InventoryMovementRecord = Omit<
  InventoryMovement,
  'saleItemId' | 'refundItemId'
>;

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
