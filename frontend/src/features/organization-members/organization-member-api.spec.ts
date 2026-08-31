import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  addOrganizationMember,
  listOrganizationMembers,
  linkOrganizationMerchantAccount,
  removeOrganizationMember,
  updateOrganizationMemberRole,
} from './organization-member-api';

describe('organization member API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;

  beforeEach(() => vi.clearAllMocks());

  it('lists members through the organization-scoped path', async () => {
    vi.mocked(request).mockResolvedValue([]);

    await listOrganizationMembers(request, 'organization/id');

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/members',
    );
  });

  it('adds an existing user with a role', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = { email: 'manager@example.com', role: 'MANAGER' as const };

    await addOrganizationMember(request, 'organization-id', input);

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/members',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  });

  it('updates a member role through both scoped identifiers', async () => {
    vi.mocked(request).mockResolvedValue({});

    await updateOrganizationMemberRole(
      request,
      'organization/id',
      'user/id',
      'CASHIER',
    );

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/members/user%2Fid/role',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ role: 'CASHIER' }),
      }),
    );
  });

  it('removes a member through both scoped identifiers', async () => {
    vi.mocked(request).mockResolvedValue(undefined);

    await removeOrganizationMember(request, 'organization/id', 'user/id');

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/members/user%2Fid',
      { method: 'DELETE' },
    );
  });

  it('links a merchant-role member through tenant-scoped identifiers', async () => {
    vi.mocked(request).mockResolvedValue({});

    await linkOrganizationMerchantAccount(
      request,
      'organization/id',
      'user/id',
      'merchant-id',
    );

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/members/user%2Fid/merchant-account',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ merchantId: 'merchant-id' }),
      }),
    );
  });
});
