import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import type { ProductFilters } from '@/features/products/model/product.types';
import {
  inventoryBranchSchema,
  inventoryListSchema,
  inventoryResponseSchema,
  movementListSchema,
  movementResponseSchema,
} from '../model/inventory.schemas';
import type {
  InventoryScope,
  InventoryDetailScope,
} from '../model/inventory.types';

const branchPath = (scope: InventoryScope) =>
  `/organizations/${encodeURIComponent(scope.organizationId)}/branches/${encodeURIComponent(scope.branchId)}`;
const path = (scope: InventoryScope) => `${branchPath(scope)}/inventory`;
const detail = (scope: InventoryDetailScope) =>
  `${path(scope)}/${encodeURIComponent(scope.inventoryId)}`;
const json = (method: string, input: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(input),
});
export async function getInventoryBranch(
  request: AuthenticatedRequest,
  scope: InventoryScope,
) {
  return inventoryBranchSchema.parse(await request<unknown>(branchPath(scope)));
}
export async function listInventory(
  request: AuthenticatedRequest,
  scope: InventoryScope,
  filters: ProductFilters = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);
  return inventoryListSchema.parse(
    await request<unknown>(`${path(scope)}${query.size ? `?${query}` : ''}`),
  );
}
export async function createPlacement(
  request: AuthenticatedRequest,
  scope: InventoryScope,
  input: { productId: string; sellingPrice: string },
) {
  return inventoryResponseSchema.parse(
    await request<unknown>(path(scope), json('POST', input)),
  );
}
export async function getInventory(
  request: AuthenticatedRequest,
  scope: InventoryDetailScope,
) {
  return inventoryResponseSchema.parse(await request<unknown>(detail(scope)));
}
export async function updateInventoryPrice(
  request: AuthenticatedRequest,
  scope: InventoryDetailScope,
  sellingPrice: string,
) {
  return inventoryResponseSchema.parse(
    await request<unknown>(
      `${detail(scope)}/price`,
      json('PATCH', { sellingPrice }),
    ),
  );
}
export async function listMovements(
  request: AuthenticatedRequest,
  scope: InventoryDetailScope,
) {
  return movementListSchema.parse(
    await request<unknown>(`${detail(scope)}/movements`),
  );
}
export async function receiveStock(
  request: AuthenticatedRequest,
  scope: InventoryDetailScope,
  input: { quantity: number; reason: string; requestId: string },
) {
  return movementResponseSchema.parse(
    await request<unknown>(`${detail(scope)}/receipts`, json('POST', input)),
  );
}
export async function adjustStock(
  request: AuthenticatedRequest,
  scope: InventoryDetailScope,
  input: { quantityChange: number; reason: string; requestId: string },
) {
  return movementResponseSchema.parse(
    await request<unknown>(`${detail(scope)}/adjustments`, json('POST', input)),
  );
}
