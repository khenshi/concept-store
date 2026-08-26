import { Prisma } from '../../generated/prisma/client';
import type {
  Inventory,
  InventoryMovement,
} from '../../generated/prisma/client';

export interface InventoryOperationRecord {
  inventory: Inventory;
  movement: InventoryMovement;
}

export const inventoryViewInclude = {
  product: {
    include: { merchant: { select: { id: true, name: true, code: true } } },
  },
  branch: { select: { id: true, name: true, code: true } },
} satisfies Prisma.InventoryInclude;

export type InventoryViewRow = Prisma.InventoryGetPayload<{
  include: typeof inventoryViewInclude;
}>;

export interface InventoryViewRecord extends Omit<InventoryViewRow, 'product'> {
  product: Omit<InventoryViewRow['product'], 'sellingPrice'> & {
    sellingPrice: string;
  };
}

export interface InventoryPageRecord {
  items: InventoryViewRecord[];
  total: number;
  offset: number;
  limit: number;
}

export const movementViewInclude = {
  product: { select: { id: true, name: true, sku: true, barcode: true } },
  branch: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, email: true } },
} satisfies Prisma.InventoryMovementInclude;

export type InventoryMovementViewRecord = Prisma.InventoryMovementGetPayload<{
  include: typeof movementViewInclude;
}>;

export interface InventoryMovementPageRecord {
  items: InventoryMovementViewRecord[];
  nextCursor: string | null;
}
