import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import { getBranch } from '@/features/branches/api/branch-api';
import type { OrganizationRole } from '@/features/organizations/model/organization.types';
import {
  posCatalogSchema,
  posCodeMatchesSchema,
  posCodeSchema,
} from '../model/pos.schemas';
import type { PosScope } from '../model/pos.types';

const path = (scope: PosScope) =>
  `/organizations/${encodeURIComponent(scope.organizationId)}/branches/${encodeURIComponent(scope.branchId)}/pos/products`;
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
) {
  const q = search.trim();
  if (q.length > 254)
    throw new Error('Search must contain 254 characters or fewer.');
  return posCatalogSchema.parse(
    await request<unknown>(
      `${path(scope)}${q ? `?${new URLSearchParams({ q })}` : ''}`,
    ),
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
