import type { z } from 'zod';
import type {
  inventoryResponseSchema,
  movementResponseSchema,
  inventoryBranchSchema,
  movementHistoryResponseSchema,
  merchantMovementHistorySchema,
  inventoryHealthSummarySchema,
  inventoryReconciliationPageSchema,
} from './inventory.schemas';

export type BranchInventory = z.infer<typeof inventoryResponseSchema>;
export type InventoryMovement = z.infer<typeof movementResponseSchema>;
export type InventoryMovementHistory = z.infer<
  typeof movementHistoryResponseSchema
>;
export type MerchantInventoryMovementHistory = z.infer<
  typeof merchantMovementHistorySchema
>;
export type InventoryMovementView =
  InventoryMovementHistory | MerchantInventoryMovementHistory;
export type InventoryBranch = z.infer<typeof inventoryBranchSchema>;
export type InventoryHealthSummary = z.infer<
  typeof inventoryHealthSummarySchema
>;
export type InventoryReconciliationPage = z.infer<
  typeof inventoryReconciliationPageSchema
>;
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
