import type {
  Inventory,
  InventoryMovement,
} from '../../generated/prisma/client';

export interface InventoryOperationRecord {
  inventory: Inventory;
  movement: InventoryMovement;
}
