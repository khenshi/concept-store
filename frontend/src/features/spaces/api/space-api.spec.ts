import {
  assignSpace,
  listOccupancies,
  listSpaces,
  listSpaceTypes,
  createSpaceType,
  occupiedSpaceCount,
  releaseSpace,
} from './space-api';
import {
  branch,
  merchant,
  occupancy,
  org,
  page,
  space,
  spaceId,
} from '../model/space.test-fixtures';
describe('Space API contracts', () => {
  const request = vi.fn();
  beforeEach(() => vi.resetAllMocks());
  it('encodes scoped pagination and filters', async () => {
    request.mockResolvedValue(page([space]));
    await listSpaces(request, org, branch, {
      type: 'Custom & type',
      status: 'ACTIVE',
      q: 'Rack',
      occupancy: 'VACANT',
    });
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('type=Custom+%26+type'),
    );
  });
  it('serializes occupancy without changing default requests', async () => {
    request.mockResolvedValue(page([space]));
    await listSpaces(request, org, branch, { occupancy: 'OCCUPIED' });
    expect(request).toHaveBeenLastCalledWith(
      expect.stringContaining('occupancy=OCCUPIED'),
    );
    await listSpaces(request, org, branch);
    expect(request).toHaveBeenLastCalledWith(
      expect.not.stringContaining('occupancy='),
    );
  });
  it('rejects cross-tenant and wrong branch list responses', async () => {
    request.mockResolvedValue(page([{ ...space, organizationId: merchant }]));
    await expect(listSpaces(request, org, branch)).rejects.toThrow(
      'scope mismatch',
    );
    request.mockResolvedValue(page([{ ...space, branchId: merchant }]));
    await expect(listSpaces(request, org, branch)).rejects.toThrow(
      'scope mismatch',
    );
  });
  it('rejects occupancy identity mismatches and strips contacts', async () => {
    request.mockResolvedValue(
      page([
        { ...occupancy, merchant: { ...occupancy.merchant, phone: 'private' } },
      ]),
    );
    const result = await listOccupancies(request, org, {
      kind: 'merchant',
      id: merchant,
    });
    expect(JSON.stringify(result)).not.toContain('private');
    request.mockResolvedValue(page([{ ...occupancy, spaceId: branch }]));
    await expect(
      listOccupancies(request, org, { kind: 'merchant', id: merchant }),
    ).rejects.toThrow();
  });
  it('counts only current occupancy with an optional branch restriction', async () => {
    request.mockResolvedValue(page([occupancy]));
    expect(await occupiedSpaceCount(request, org, merchant, branch)).toBe(1);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining(`view=CURRENT&branchId=${branch}`),
    );
  });
  it('sends assignment dates without client tenant fields and verifies returned space', async () => {
    request.mockResolvedValue(occupancy);
    await assignSpace(request, org, branch, spaceId, {
      merchantId: merchant,
      startedAt: occupancy.startedAt,
    });
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
      merchantId: merchant,
      startedAt: occupancy.startedAt,
    });
    request.mockResolvedValue({
      ...occupancy,
      spaceId: branch,
      space: { ...occupancy.space, id: branch },
    });
    await expect(
      assignSpace(request, org, branch, spaceId, { merchantId: merchant }),
    ).rejects.toThrow('space mismatch');
  });
  it('releases only the selected occupancy identity', async () => {
    request.mockResolvedValue({
      ...occupancy,
      endedAt: '2026-01-02T00:00:00Z',
      releaseReason: 'MANUAL',
    });
    await releaseSpace(request, org, occupancy);
    expect(request.mock.calls[0][0]).toContain(`/${occupancy.id}/release`);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({});
  });
});

it('validates tenant ownership of shared type reads and creates', async () => {
  const request = vi
    .fn()
    .mockResolvedValue([{ id: spaceId, organizationId: org, name: 'Rack' }]);
  expect(await listSpaceTypes(request, org)).toHaveLength(1);
  expect(request).toHaveBeenCalledWith(`/organizations/${org}/space-types`);
  request.mockResolvedValue({ id: spaceId, organizationId: org, name: 'Rack' });
  await createSpaceType(request, org, 'Rack');
  expect(JSON.parse(request.mock.calls.at(-1)![1].body)).toEqual({
    name: 'Rack',
  });
  request.mockResolvedValue([
    { id: spaceId, organizationId: merchant, name: 'Private' },
  ]);
  await expect(listSpaceTypes(request, org)).rejects.toThrow('scope mismatch');
  request.mockResolvedValue({
    id: spaceId,
    organizationId: merchant,
    name: 'Private',
  });
  await expect(createSpaceType(request, org, 'Private')).rejects.toThrow(
    'scope mismatch',
  );
});
