import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  PosProduct,
  PosProductFilters,
  PosProductPage,
} from './pos.types';

function productPath(organizationId: string, branchId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/pos/products`;
}

export function listPosProducts(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  filters: PosProductFilters = {},
): Promise<PosProductPage> {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.merchantId) query.set('merchantId', filters.merchantId);
  if (filters.offset !== undefined) query.set('offset', String(filters.offset));
  if (filters.limit !== undefined) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query}` : '';
  return request<PosProductPage>(
    `${productPath(organizationId, branchId)}${suffix}`,
  );
}

export function lookupPosProduct(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  code: string,
): Promise<PosProduct> {
  const query = new URLSearchParams({ code });
  return request<PosProduct>(
    `${productPath(organizationId, branchId)}/lookup?${query}`,
  );
}
