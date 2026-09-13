import type {
  AuthenticatedRequest,
  OrganizationRole,
} from '@/features/organizations/model/organization.types';
import type { PosScope } from '@/features/pos/model/pos.types';
import { completedSaleSchema } from '@/features/pos/model/checkout';
import {
  merchantSaleSchema,
  merchantSalesPageSchema,
  staffSalesPageSchema,
  sellingBranchesSchema,
  salesQuerySchema,
  type SalesQuery,
} from '../model/sales.schemas';

const salesPath = (scope: PosScope) =>
  `/organizations/${encodeURIComponent(scope.organizationId)}/branches/${encodeURIComponent(scope.branchId)}/sales`;
export async function listSales(
  request: AuthenticatedRequest,
  scope: PosScope,
  role: OrganizationRole,
  input: SalesQuery,
) {
  const query = salesQuerySchema.parse(input);
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
    ...(query.from ? { from: query.from } : {}),
    ...(query.until ? { until: query.until } : {}),
  });
  const raw = await request<unknown>(`${salesPath(scope)}?${params}`);
  const result =
    role === 'MERCHANT'
      ? { kind: 'merchant' as const, page: merchantSalesPageSchema.parse(raw) }
      : { kind: 'staff' as const, page: staffSalesPageSchema.parse(raw) };
  if (
    new Set(result.page.items.map((sale) => sale.id)).size !==
      result.page.items.length ||
    result.page.page !== query.page ||
    result.page.limit !== query.limit ||
    result.page.items.some(
      (sale) =>
        sale.branchId !== scope.branchId ||
        ('organizationId' in sale &&
          sale.organizationId !== scope.organizationId),
    )
  )
    throw new Error('Sales response scope is inconsistent.');
  return result;
}
export async function getSale(
  request: AuthenticatedRequest,
  scope: PosScope,
  role: OrganizationRole,
  saleId: string,
) {
  const raw = await request<unknown>(
    `${salesPath(scope)}/${encodeURIComponent(saleId)}`,
  );
  const result =
    role === 'MERCHANT'
      ? { kind: 'merchant' as const, sale: merchantSaleSchema.parse(raw) }
      : { kind: 'staff' as const, sale: completedSaleSchema.parse(raw) };
  if (
    result.sale.id !== saleId ||
    result.sale.branchId !== scope.branchId ||
    ('organizationId' in result.sale &&
      result.sale.organizationId !== scope.organizationId)
  )
    throw new Error('Sale response scope is inconsistent.');
  return result;
}
export async function listSellingBranches(
  request: AuthenticatedRequest,
  organizationId: string,
) {
  return sellingBranchesSchema.parse(
    await request<unknown>(
      `/organizations/${encodeURIComponent(organizationId)}/sales/branches`,
    ),
  );
}
