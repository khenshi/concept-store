import type { z } from 'zod';
import type {
  inventoryResponseSchema,
  movementResponseSchema,
  inventoryBranchSchema,
  merchantMovementSchema,
} from './inventory.schemas';

export type BranchInventory = z.infer<typeof inventoryResponseSchema>;
export type InventoryMovement = z.infer<typeof movementResponseSchema>;
export type InventoryMovementView =
  InventoryMovement | z.infer<typeof merchantMovementSchema>;
export type InventoryBranch = z.infer<typeof inventoryBranchSchema>;
export type InventoryStockStatus = BranchInventory['stockStatus'];
export interface InventoryFilters {
  q?: string;
  merchantId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  stockStatus?: InventoryStockStatus;
}
export interface InventoryScope {
  organizationId: string;
  branchId: string;
}
export interface InventoryDetailScope extends InventoryScope {
  inventoryId: string;
}
