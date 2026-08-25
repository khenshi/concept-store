import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import { createSpace, listSpaces, updateSpace } from './space-api';
import type { SpaceInput, SpaceUpdateInput } from './space.types';

describe('space API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;
  const input: SpaceInput = {
    code: 'RACK-A01',
    name: 'Front display rack',
    type: 'RACK',
    status: 'ACTIVE',
  };

  beforeEach(() => vi.clearAllMocks());

  it('lists spaces through the tenant and branch-scoped path', async () => {
    vi.mocked(request).mockResolvedValue([]);

    await listSpaces(request, 'organization/id', 'branch/id');

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/branches/branch%2Fid/spaces',
    );
  });

  it('creates a space in the selected branch', async () => {
    vi.mocked(request).mockResolvedValue({});

    await createSpace(request, 'organization-id', 'branch-id', input);

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/branches/branch-id/spaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  });

  it('updates a space through the organization-scoped identifier', async () => {
    vi.mocked(request).mockResolvedValue({});
    const update: SpaceUpdateInput = { ...input, customType: null };

    await updateSpace(request, 'organization-id', 'space/id', update);

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/spaces/space%2Fid',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(update),
      }),
    );
  });
});
