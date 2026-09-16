export interface InventoryReconciliationMismatch {
  inventoryId: string;
  productId: string;
  productName: string;
  sku: string | null;
  recordedQuantity: number;
  ledgerQuantity: string;
  difference: string;
}

export interface InventoryReconciliationPage {
  items: InventoryReconciliationMismatch[];
  nextCursor: string | null;
}
