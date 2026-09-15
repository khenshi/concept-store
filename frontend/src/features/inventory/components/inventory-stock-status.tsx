import type { InventoryStockStatus } from '../model/inventory.types';

const styles: Record<InventoryStockStatus, string> = {
  IN_STOCK: 'border-success/20 bg-success/5 text-success',
  LOW_STOCK: 'border-warning/20 bg-warning/5 text-warning',
  OUT_OF_STOCK: 'border-danger/20 bg-danger/5 text-danger',
};

export function inventoryStockStatusLabel(status: InventoryStockStatus) {
  if (status === 'OUT_OF_STOCK') return 'Out of stock';
  if (status === 'LOW_STOCK') return 'Low stock';
  return 'In stock';
}

export function InventoryStockStatusBadge({
  status,
}: {
  status: InventoryStockStatus;
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {inventoryStockStatusLabel(status)}
    </span>
  );
}
