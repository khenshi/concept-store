import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import { createBranch, listBranches, updateBranch } from './branch-api';
import type { BranchInput, BranchUpdateInput } from './branch.types';

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
});
