import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  createBranch,
  getBranch,
  listBranchDirectory,
  listBranches,
  updateBranch,
  updateBranchStatus,
} from './branch-api';
import type { BranchInput, BranchUpdateInput } from '../model/branch.types';

describe('branch API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;
  const input: BranchInput = {
    name: 'Makati Main',
    code: 'MKT-01',
    addressLine1: '123 Retail Street',
    city: 'Makati',
    province: 'Metro Manila',
    postalCode: '1200',
    countryCode: 'PH',
  };
  const updateInput: BranchUpdateInput = {
    ...input,
    code: null,
    addressLine2: null,
    postalCode: null,
  };

  beforeEach(() => vi.clearAllMocks());

  it('lists branches through the organization-scoped path', async () => {
    vi.mocked(request).mockResolvedValue([]);

    await listBranches(request, 'organization-id');

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/branches',
    );
  });

  it('creates a branch with JSON content', async () => {
    vi.mocked(request).mockResolvedValue({});

    await createBranch(request, 'organization-id', input);

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/branches',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  });

  it('gets one branch through both scoped identifiers', async () => {
    vi.mocked(request).mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Makati',
      code: null,
    });
    await getBranch(request, 'organization/id', 'branch/id');
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/branches/branch%2Fid',
    );
  });

  it('updates a branch through both scoped identifiers', async () => {
    vi.mocked(request).mockResolvedValue({});

    await updateBranch(request, 'organization/id', 'branch/id', updateInput);

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/branches/branch%2Fid',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(updateInput),
      }),
    );
  });

  it('lists the paginated staff directory with encoded filters', async () => {
    vi.mocked(request).mockResolvedValue({
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          name: 'Makati',
          code: 'MKT-01',
          status: 'ACTIVE',
          addressLine1: '123 Retail Street',
          addressLine2: null,
          city: 'Makati',
          province: 'Metro Manila',
          postalCode: '1200',
          countryCode: 'PH',
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          merchantCount: 2,
        },
      ],
      page: 2,
      limit: 10,
      total: 11,
      totalPages: 2,
      hasNext: false,
      summary: { total: 24, active: 20, inactive: 4 },
    });

    await expect(
      listBranchDirectory(request, 'organization/id', {
        search: 'Metro Manila',
        status: 'ACTIVE',
        page: 2,
      }),
    ).resolves.toMatchObject({ total: 11, summary: { inactive: 4 } });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/branches/directory?page=2&q=Metro+Manila&status=ACTIVE',
    );
  });

  it('updates a branch lifecycle status', async () => {
    vi.mocked(request).mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Makati',
      code: null,
      status: 'INACTIVE',
      addressLine1: '123 Retail Street',
      addressLine2: null,
      city: 'Makati',
      province: 'Metro Manila',
      postalCode: null,
      countryCode: 'PH',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });

    await updateBranchStatus(
      request,
      'organization/id',
      'branch/id',
      'INACTIVE',
    );

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/branches/branch%2Fid/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'INACTIVE' }),
      }),
    );
  });
  it('validates merchant identity-only responses and strips addresses', async () => {
    const identity = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Makati',
      code: null,
    };
    vi.mocked(request).mockResolvedValue({
      ...identity,
      addressLine1: 'Private address',
    });
    await expect(
      getBranch(request, 'org', identity.id, 'MERCHANT'),
    ).resolves.toEqual(identity);
    vi.mocked(request).mockResolvedValue([
      { ...identity, city: 'Private city' },
    ]);
    await expect(listBranches(request, 'org', 'MERCHANT')).resolves.toEqual([
      identity,
    ]);
    vi.mocked(request).mockResolvedValue({ ...identity, id: 'invalid' });
    await expect(
      getBranch(request, 'org', identity.id, 'MERCHANT'),
    ).rejects.toThrow();
  });
});
