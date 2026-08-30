import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import type {
  CreateSaleInput,
  PosProduct,
  PosProductFilters,
  PosProductPage,
  Sale,
  SaleFilters,
  SalePage,
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

export function checkoutSale(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  input: CreateSaleInput,
): Promise<Sale> {
  return request<Sale>(
    `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/pos/sales`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
}

function salesPath(organizationId: string, branchId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}/branches/${encodeURIComponent(branchId)}/pos/sales`;
}

export function listSales(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  filters: SaleFilters = {},
): Promise<SalePage> {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.cashierId) query.set('cashierId', filters.cashierId);
  if (filters.paymentMethod) query.set('paymentMethod', filters.paymentMethod);
  if (filters.completedFrom) query.set('completedFrom', filters.completedFrom);
  if (filters.completedTo) query.set('completedTo', filters.completedTo);
  if (filters.offset !== undefined) query.set('offset', String(filters.offset));
  if (filters.limit !== undefined) query.set('limit', String(filters.limit));
  const suffix = query.size ? `?${query}` : '';
  return request<SalePage>(`${salesPath(organizationId, branchId)}${suffix}`);
}

export function getSale(
  request: AuthenticatedRequest,
  organizationId: string,
  branchId: string,
  saleId: string,
): Promise<Sale> {
  return request<Sale>(
    `${salesPath(organizationId, branchId)}/${encodeURIComponent(saleId)}`,
  );
}
