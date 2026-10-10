import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  occupancyPageSchema,
  occupancySchema,
  spacePageSchema,
  spaceSchema,
  spaceTypeSchema,
  type Occupancy,
  type Space,
} from '../model/space.schemas';
const root = (org: string) => `/organizations/${encodeURIComponent(org)}`;
const spaceRoot = (org: string, branch: string) =>
  `${root(org)}/branches/${encodeURIComponent(branch)}/spaces`;
const command = (method: string, body: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
function check<T extends Space | Occupancy>(
  row: T,
  org: string,
  branch?: string,
  merchant?: string,
): T {
  if (
    row.organizationId !== org ||
    (branch && row.branchId !== branch) ||
    (merchant && (!('merchantId' in row) || row.merchantId !== merchant))
  )
    throw new Error('Space response scope mismatch');
  return row;
}
export async function listSpaces(
  request: AuthenticatedRequest,
  org: string,
  branch: string,
  filters: {
    page?: number;
    q?: string;
    type?: string;
    status?: string;
    merchantId?: string;
    occupancy?: 'OCCUPIED' | 'VACANT';
  } = {},
) {
  const query = new URLSearchParams({ page: String(filters.page ?? 1) });
  for (const key of ['q', 'type', 'status', 'merchantId', 'occupancy'] as const)
    if (filters[key]) query.set(key, filters[key]);
  const page = spacePageSchema.parse(
    await request<unknown>(`${spaceRoot(org, branch)}?${query}`),
  );
  page.items.forEach((row) => check(row, org, branch));
  return page;
}
export async function listOccupancies(
  request: AuthenticatedRequest,
  org: string,
  scope:
    | { kind: 'merchant'; id: string; branchId?: string }
    | { kind: 'space'; id: string; branchId: string },
  filters: { page?: number; view?: 'CURRENT' | 'HISTORY' } = {},
) {
  const path =
    scope.kind === 'merchant'
      ? `${root(org)}/merchants/${encodeURIComponent(scope.id)}/spaces`
      : `${spaceRoot(org, scope.branchId)}/${encodeURIComponent(scope.id)}/occupancies`;
  const query = new URLSearchParams({ page: String(filters.page ?? 1) });
  if (filters.view) query.set('view', filters.view);
  if (scope.kind === 'merchant' && scope.branchId)
    query.set('branchId', scope.branchId);
  const page = occupancyPageSchema.parse(
    await request<unknown>(`${path}?${query}`),
  );
  page.items.forEach((row) => {
    check(
      row,
      org,
      scope.branchId,
      scope.kind === 'merchant' ? scope.id : undefined,
    );
    if (scope.kind === 'space' && row.spaceId !== scope.id)
      throw new Error('Occupancy space mismatch');
  });
  return page;
}
export async function occupiedSpaceCount(
  request: AuthenticatedRequest,
  org: string,
  merchant: string,
  branchId?: string,
) {
  return (
    await listOccupancies(
      request,
      org,
      { kind: 'merchant', id: merchant, branchId },
      { view: 'CURRENT' },
    )
  ).total;
}
export async function saveSpace(
  request: AuthenticatedRequest,
  org: string,
  branch: string,
  body: { name: string; type: string },
  id?: string,
) {
  return check(
    spaceSchema.parse(
      await request<unknown>(
        `${spaceRoot(org, branch)}${id ? `/${encodeURIComponent(id)}` : ''}`,
        command(id ? 'PATCH' : 'POST', body),
      ),
    ),
    org,
    branch,
  );
}
export async function setSpaceStatus(
  request: AuthenticatedRequest,
  org: string,
  branch: string,
  id: string,
  status: 'ACTIVE' | 'ARCHIVED',
) {
  return check(
    spaceSchema.parse(
      await request<unknown>(
        `${spaceRoot(org, branch)}/${encodeURIComponent(id)}/status`,
        command('PATCH', { status }),
      ),
    ),
    org,
    branch,
  );
}
export async function assignSpace(
  request: AuthenticatedRequest,
  org: string,
  branch: string,
  id: string,
  body: { merchantId: string; startedAt?: string; endedAt?: string },
) {
  const row = check(
    occupancySchema.parse(
      await request<unknown>(
        `${spaceRoot(org, branch)}/${encodeURIComponent(id)}/occupancies`,
        command('POST', body),
      ),
    ),
    org,
    branch,
    body.merchantId,
  );
  if (row.spaceId !== id) throw new Error('Occupancy space mismatch');
  return row;
}
export async function releaseSpace(
  request: AuthenticatedRequest,
  org: string,
  occupancy: Occupancy,
  endedAt?: string,
) {
  const row = check(
    occupancySchema.parse(
      await request<unknown>(
        `${spaceRoot(org, occupancy.branchId)}/${encodeURIComponent(occupancy.spaceId)}/occupancies/${encodeURIComponent(occupancy.id)}/release`,
        command('PATCH', endedAt ? { endedAt } : {}),
      ),
    ),
    org,
    occupancy.branchId,
    occupancy.merchantId,
  );
  if (row.id !== occupancy.id || row.spaceId !== occupancy.spaceId)
    throw new Error('Occupancy release mismatch');
  return row;
}

export async function listSpaceTypes(
  request: AuthenticatedRequest,
  org: string,
) {
  const rows = spaceTypeSchema
    .array()
    .parse(await request<unknown>(`${root(org)}/space-types`));
  if (rows.some((row) => row.organizationId !== org))
    throw new Error('Space type response scope mismatch');
  return rows;
}
export async function createSpaceType(
  request: AuthenticatedRequest,
  org: string,
  name: string,
) {
  const row = spaceTypeSchema.parse(
    await request<unknown>(
      `${root(org)}/space-types`,
      command('POST', { name }),
    ),
  );
  if (row.organizationId !== org)
    throw new Error('Space type response scope mismatch');
  return row;
}
