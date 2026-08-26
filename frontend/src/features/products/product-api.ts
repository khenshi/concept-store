import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  Product,
  ProductFilters,
  ProductInput,
  ProductStatus,
  ProductUpdateInput,
} from './product.types';

function productPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/products`;
}

export function listProducts(
  request: AuthenticatedRequest,
  organizationId: string,
  filters: ProductFilters = {},
): Promise<Product[]> {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.merchantId) query.set('merchantId', filters.merchantId);
  if (filters.status) query.set('status', filters.status);
  const suffix = query.size ? `?${query.toString()}` : '';
  return request<Product[]>(`${productPath(organizationId)}${suffix}`);
}

export function lookupProduct(
  request: AuthenticatedRequest,
  organizationId: string,
  code: string,
): Promise<Product> {
  const query = new URLSearchParams({ code });
  return request<Product>(`${productPath(organizationId)}/lookup?${query}`);
}

export function getProduct(
  request: AuthenticatedRequest,
  organizationId: string,
  productId: string,
): Promise<Product> {
  return request<Product>(
    `${productPath(organizationId)}/${encodeURIComponent(productId)}`,
  );
}

export function createProduct(
  request: AuthenticatedRequest,
  organizationId: string,
  input: ProductInput,
): Promise<Product> {
  return request<Product>(productPath(organizationId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateProduct(
  request: AuthenticatedRequest,
  organizationId: string,
  productId: string,
  input: ProductUpdateInput,
): Promise<Product> {
  return request<Product>(
    `${productPath(organizationId)}/${encodeURIComponent(productId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

export function updateProductStatus(
  request: AuthenticatedRequest,
  organizationId: string,
  productId: string,
  status: ProductStatus,
): Promise<Product> {
  return request<Product>(
    `${productPath(organizationId)}/${encodeURIComponent(productId)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
}
