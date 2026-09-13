import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  createBranch,
  getBranch,
  listBranches,
  updateBranch,
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
