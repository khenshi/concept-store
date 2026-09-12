import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  productListResponseSchema,
  productResponseSchema,
  productPlacementListSchema,
} from '../model/product.schemas';
import type {
  ProductFilters,
  ProductInput,
  ProductProfileInput,
  ProductStatus,
} from '../model/product.types';

const path = (org: string, id?: string) =>
  `/organizations/${encodeURIComponent(org)}/products${id ? `/${encodeURIComponent(id)}` : ''}`;
const body = (method: string, input: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(input),
});

export async function listProducts(
  request: AuthenticatedRequest,
  org: string,
  filters: ProductFilters = {},
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);
  return productListResponseSchema.parse(
    await request<unknown>(`${path(org)}${query.size ? `?${query}` : ''}`),
  );
}
export async function getProduct(
  request: AuthenticatedRequest,
  org: string,
  id: string,
) {
  return productResponseSchema.parse(await request<unknown>(path(org, id)));
}
export async function createProduct(
  request: AuthenticatedRequest,
  org: string,
  input: ProductInput,
) {
  return productResponseSchema.parse(
    await request<unknown>(path(org), body('POST', input)),
  );
}
export async function updateProduct(
  request: AuthenticatedRequest,
  org: string,
  id: string,
  input: ProductProfileInput,
) {
  return productResponseSchema.parse(
    await request<unknown>(path(org, id), body('PATCH', input)),
  );
}
export async function updateProductStatus(
  request: AuthenticatedRequest,
  org: string,
  id: string,
  status: ProductStatus,
) {
  return productResponseSchema.parse(
    await request<unknown>(
      `${path(org, id)}/status`,
      body('PATCH', { status }),
    ),
  );
}
export async function getProductPlacements(
  request: AuthenticatedRequest,
  org: string,
  id: string,
) {
  return productPlacementListSchema.parse(
    await request<unknown>(`${path(org, id)}/inventory`),
  );
}
