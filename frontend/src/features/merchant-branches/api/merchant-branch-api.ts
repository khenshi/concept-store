import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  merchantBranchPageSchema,
  merchantBranchSchema,
} from '../model/merchant-branch.schemas';
export type AssociationScope = {
  organizationId: string;
  kind: 'merchant' | 'branch';
  id: string;
};
const root = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;
export async function listAssociations(
  request: AuthenticatedRequest,
  scope: AssociationScope,
  filters: { page?: number; q?: string; status?: string } = {},
) {
  const query = new URLSearchParams({ page: String(filters.page ?? 1) });
  if (filters.q) query.set('q', filters.q);
  if (filters.status) query.set('status', filters.status);
  const path =
    scope.kind === 'merchant'
      ? `merchants/${encodeURIComponent(scope.id)}/branches`
      : `branches/${encodeURIComponent(scope.id)}/merchants`;
  const result = merchantBranchPageSchema.parse(
    await request<unknown>(`${root(scope.organizationId)}/${path}?${query}`),
  );
  if (
    result.items.some(
      (row) =>
        row.organizationId !== scope.organizationId ||
        (scope.kind === 'merchant' ? row.merchantId : row.branchId) !==
          scope.id,
    )
  )
    throw new Error('Association response scope mismatch');
  return result;
}
export async function saveAssociation(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
  branchId: string,
  status?: 'ACTIVE' | 'INACTIVE',
) {
  const path = `${root(organizationId)}/merchants/${encodeURIComponent(merchantId)}/branches/${encodeURIComponent(branchId)}`;
  const result = merchantBranchSchema.parse(
    await request<unknown>(`${path}${status ? '/status' : ''}`, {
      method: status ? 'PATCH' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(status ? { status } : {}),
    }),
  );
  if (
    result.organizationId !== organizationId ||
    result.merchantId !== merchantId ||
    result.branchId !== branchId
  )
    throw new Error('Association response scope mismatch');
  return result;
}

export async function listActiveMerchantBranches(
  request: AuthenticatedRequest,
  organizationId: string,
  merchantId: string,
) {
  const branches: { id: string; name: string; code: string | null }[] = [];
  let page = 1;
  while (true) {
    const result = await listAssociations(
      request,
      { organizationId, kind: 'merchant', id: merchantId },
      { page, status: 'ACTIVE' },
    );
    branches.push(...result.items.map((row) => row.branch));
    if (!result.hasNext) return branches;
    page++;
  }
}
