import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  createMerchant,
  getMerchant,
  listMerchants,
  updateMerchant,
  updateMerchantBranches,
  updateMerchantStatus,
} from './merchant-api';
import type { MerchantInput, MerchantUpdateInput } from './merchant.types';

describe('merchant API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;
  const input: MerchantInput = {
    name: 'Amihan Goods',
    code: 'AMIHAN-01',
    contactName: 'Maria Santos',
    email: 'maria@amihan.example',
    phone: '+63 917 123 4567',
    branchIds: ['branch-id'],
  };

  beforeEach(() => vi.clearAllMocks());

  it('lists merchants with encoded filters', async () => {
    vi.mocked(request).mockResolvedValue([]);
    await listMerchants(request, 'organization/id', {
      search: 'Amihan goods',
      status: 'ACTIVE',
    });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/merchants?search=Amihan+goods&status=ACTIVE',
    );
  });

  it('creates and retrieves merchants through tenant-scoped paths', async () => {
    vi.mocked(request).mockResolvedValue({});
    await createMerchant(request, 'organization-id', input);
    await getMerchant(request, 'organization-id', 'merchant/id');
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/organizations/organization-id/merchants',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/organizations/organization-id/merchants/merchant%2Fid',
    );
  });

  it('updates profile and status through separate endpoints', async () => {
    vi.mocked(request).mockResolvedValue({});
    const update: MerchantUpdateInput = {
      name: input.name,
      code: null,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
    };
    await updateMerchant(request, 'organization-id', 'merchant-id', update);
    await updateMerchantStatus(
      request,
      'organization-id',
      'merchant-id',
      'SUSPENDED',
    );
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/organizations/organization-id/merchants/merchant-id',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(update),
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/organizations/organization-id/merchants/merchant-id/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'SUSPENDED' }),
      }),
    );
  });

  it('replaces merchant branches through the assignment endpoint', async () => {
    vi.mocked(request).mockResolvedValue({});
    await updateMerchantBranches(request, 'organization-id', 'merchant-id', [
      'branch-1',
    ]);
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/merchants/merchant-id/branches',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchIds: ['branch-1'] }),
      },
    );
  });
});
