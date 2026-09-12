import {
  merchant,
  placement,
  product,
} from '@/features/products/model/product.test-fixtures';
import type {
  BranchInventory,
  InventoryBranch,
  InventoryMovement,
} from './inventory.types';

export const scope = {
  organizationId: product.organizationId,
  branchId: placement.branchId,
  inventoryId: placement.id,
};
export const inventory: BranchInventory = {
  id: placement.id,
  organizationId: placement.organizationId,
  branchId: placement.branchId,
  productId: placement.productId,
  sellingPrice: placement.sellingPrice,
  quantity: placement.quantity,
  createdAt: placement.createdAt,
  updatedAt: placement.updatedAt,
  product: {
    id: product.id,
    merchantId: merchant.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    status: product.status,
    merchant: { id: merchant.id, name: merchant.name, status: merchant.status },
  },
};
export const branch: InventoryBranch = {
  ...placement.branch,
  organizationId: product.organizationId,
};
export const movement: InventoryMovement = {
  id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  organizationId: scope.organizationId,
  branchId: scope.branchId,
  branchInventoryId: scope.inventoryId,
  type: 'RECEIPT',
  quantityChange: 10,
  quantityAfter: 10,
  reason: 'Opening delivery',
  createdById: '11111111-1111-4111-8111-111111111111',
  requestId: '22222222-2222-4222-8222-222222222222',
  createdAt: merchant.createdAt,
};
