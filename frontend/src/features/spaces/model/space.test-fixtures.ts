import type { Occupancy, SpaceListItem } from './space.schemas';
export const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  branch = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  merchant = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  spaceId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const timestamp = '2026-01-01T00:00:00.000Z';
export const occupancy: Occupancy = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  organizationId: org,
  branchId: branch,
  merchantId: merchant,
  spaceId,
  startedAt: timestamp,
  endedAt: null,
  releaseReason: null,
  releasedBy: null,
  space: { id: spaceId, name: 'Rack A1', type: 'Rack', status: 'ACTIVE' },
  branch: { id: branch, name: 'Main branch', code: null },
  merchant: { id: merchant, name: 'Amihan', code: null },
};
export const space: SpaceListItem = {
  id: spaceId,
  organizationId: org,
  branchId: branch,
  name: 'Rack A1',
  type: 'Rack',
  status: 'ACTIVE',
  createdAt: timestamp,
  updatedAt: timestamp,
  currentOccupancy: null,
};
export const page = <T>(items: T[]) => ({
  items,
  page: 1,
  limit: 15 as const,
  total: items.length,
  totalPages: items.length ? 1 : 0,
  hasNext: false,
});
