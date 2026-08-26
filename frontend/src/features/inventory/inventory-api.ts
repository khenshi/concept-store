import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  InventoryAdjustmentInput,
  InventoryFilters,
  InventoryMovementFilters,
  InventoryMovementPage,
  InventoryOperation,
  InventoryPage,
  StockInInput,
} from './inventory.types';

function inventoryPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/inventory`;
}

export function listInventory(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: InventoryFilters = {},
): Promise<InventoryPage> {
  const query = new URLSearchParams();
  if (filters.branchId) query.set('branchId', filters.branchId);
  if (filters.merchantId) query.set('merchantId', filters.merchantId);
  if (filters.productId) query.set('productId', filters.productId);
  if (filters.status) query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  if (filters.offset !== undefined) query.set('offset', String(filters.offset));
  if (filters.limit !== undefined) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query}` : '';
  return request<InventoryPage>(`${inventoryPath(organizationId)}${suffix}`);
}

export function listInventoryMovements(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: InventoryMovementFilters = {},
): Promise<InventoryMovementPage> {
  const query = new URLSearchParams();
  if (filters.branchId) query.set('branchId', filters.branchId);
  if (filters.productId) query.set('productId', filters.productId);
  if (filters.type) query.set('type', filters.type);
  if (filters.cursor) query.set('cursor', filters.cursor);
  if (filters.limit !== undefined) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query}` : '';
  return request<InventoryMovementPage>(
    `${inventoryPath(organizationId)}/movements${suffix}`,
  );
}

export function stockIn(
  request: AuthenticatedRequest,
  organizationId: string,
  input: StockInInput,
): Promise<InventoryOperation> {
  return request<InventoryOperation>(
    `${inventoryPath(organizationId)}/stock-in`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function adjustInventory(
  request: AuthenticatedRequest,
  organizationId: string,
  input: InventoryAdjustmentInput,
): Promise<InventoryOperation> {
  return request<InventoryOperation>(
    `${inventoryPath(organizationId)}/adjustments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}
