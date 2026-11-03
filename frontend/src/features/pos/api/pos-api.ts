import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  getBranch,
  listBranches,
  listBranchOptions,
} from '@/features/branches/api/branch-api';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import {
  posCatalogPageSchema,
  posCodeMatchesSchema,
  posCodeSchema,
} from '../model/pos.schemas';
import type { PosScope } from '../model/pos.types';

const path = (scope: PosScope) =>
  `/organizations/${encodeURIComponent(scope.organizationId)}/branches/${encodeURIComponent(scope.branchId)}/pos/products`;
export async function listPosBranches(
  request: AuthenticatedRequest,
  organizationId: string,
  role: OrganizationRole,
) {
  if (role === 'MERCHANT') throw new Error('Merchants cannot access POS.');
  const branches = await listBranches(request, organizationId, role);
  return branches.map((branch) => {
    if (
      !('organizationId' in branch) ||
      branch.organizationId !== organizationId
    )
      throw new Error('Branch scope is inconsistent.');
    return { id: branch.id, name: branch.name, code: branch.code };
  });
}

export async function listPosBranchOptions(
  request: AuthenticatedRequest,
  organizationId: string,
  role: OrganizationRole,
  query: { search?: string; page?: number } = {},
) {
  if (role === 'MERCHANT') throw new Error('Merchants cannot access POS.');
  return listBranchOptions(request, organizationId, query);
}
export async function getPosBranch(
  request: AuthenticatedRequest,
  scope: PosScope,
  role: OrganizationRole,
) {
  const branch = await getBranch(
    request,
    scope.organizationId,
    scope.branchId,
    role,
  );
  if (
    branch.id !== scope.branchId ||
    ('organizationId' in branch &&
      branch.organizationId !== scope.organizationId)
  )
    throw new Error('Branch scope is inconsistent.');
  return { id: branch.id, name: branch.name, code: branch.code };
}
export async function searchPosProducts(
  request: AuthenticatedRequest,
  scope: PosScope,
  search = '',
  cursor?: string,
) {
  const q = search.trim();
  if (q.length > 254)
    throw new Error('Search must contain 254 characters or fewer.');
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (cursor) query.set('cursor', cursor);
  const suffix = query.size ? `?${query}` : '';
  return posCatalogPageSchema.parse(
    await request<unknown>(`${path(scope)}${suffix}`),
  );
}
export async function lookupPosCode(
  request: AuthenticatedRequest,
  scope: PosScope,
  input: string,
) {
  const code = posCodeSchema.parse(input);
  return posCodeMatchesSchema.parse(
    await request<unknown>(
      `${path(scope)}/code?${new URLSearchParams({ code })}`,
    ),
  );
}
