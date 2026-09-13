import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  listOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationMemberRole,
  listMemberBranches,
  setMemberBranch,
  setMemberMerchant,
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

  it('updates a member role through both scoped identifiers', async () => {
    vi.mocked(request).mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'member@example.test',
      firstName: 'Test',
      lastName: 'Member',
      phone: null,
      role: 'CASHIER',
      merchantId: null,
      joinedAt: '2026-09-13T00:00:00Z',
    });

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
  it('uses scoped grant/revoke and merchant-link commands without role or tenant body fields', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    vi.mocked(request).mockResolvedValue(undefined);
    await setMemberBranch(request, 'org/id', 'user/id', 'branch/id', true);
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/org%2Fid/members/user%2Fid/branches/branch%2Fid',
      expect.objectContaining({ method: 'PUT', body: '{}' }),
    );
    await setMemberBranch(request, 'org/id', 'user/id', 'branch/id', false);
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/org%2Fid/members/user%2Fid/branches/branch%2Fid',
      expect.objectContaining({ method: 'DELETE', body: '{}' }),
    );
    vi.mocked(request).mockResolvedValue({ merchantId: id });
    await setMemberMerchant(request, 'org/id', 'user/id', id);
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/org%2Fid/members/user%2Fid/merchant',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ merchantId: id }),
      }),
    );
  });
  it('rejects malformed assignment responses before rendering', async () => {
    vi.mocked(request).mockResolvedValue([
      { id: 'bad', name: 'Branch', code: null },
    ]);
    await expect(listMemberBranches(request, 'org', 'user')).rejects.toThrow();
  });
});
