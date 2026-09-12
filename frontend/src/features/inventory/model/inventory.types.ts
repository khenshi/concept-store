import type { z } from 'zod';
import type {
  inventoryResponseSchema,
  movementResponseSchema,
  inventoryBranchSchema,
} from './inventory.schemas';

export type BranchInventory = z.infer<typeof inventoryResponseSchema>;
export type InventoryMovement = z.infer<typeof movementResponseSchema>;
export type InventoryBranch = z.infer<typeof inventoryBranchSchema>;
export interface InventoryScope {
  organizationId: string;
  branchId: string;
}
export interface InventoryDetailScope extends InventoryScope {
  inventoryId: string;
}
