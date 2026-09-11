import type { AuthenticatedRequest } from '@/features/organizations/model/organization.types';
import {
  createMerchant,
  getMerchant,
  listMerchants,
  updateMerchant,
  updateMerchantStatus,
} from './merchant-api';

describe('merchant API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;
  const merchant = {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Amihan Home Studio',
    code: 'AMIHAN-HOME',
    contactName: 'Mara Santos',
    email: 'mara@amihan.example.com',
    phone: '+63 917 555 0101',
    status: 'ACTIVE',
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
  };

  beforeEach(() => vi.clearAllMocks());

  it('lists through the scoped path with encoded search and status filters', async () => {
    vi.mocked(request).mockResolvedValue([merchant]);

    await expect(
      listMerchants(request, merchant.organizationId, {
        q: 'home & studio',
        status: 'ACTIVE',
      }),
    ).resolves.toEqual([merchant]);
    expect(request).toHaveBeenCalledWith(
      `/organizations/${merchant.organizationId}/merchants?q=home+%26+studio&status=ACTIVE`,
    );
  });

  it('uses scoped and encoded paths for create, read, update, and status', async () => {
    vi.mocked(request).mockResolvedValue(merchant);
    const input = {
      name: merchant.name,
      code: merchant.code,
      contactName: merchant.contactName,
      email: merchant.email,
      phone: merchant.phone,
    };

    await createMerchant(request, 'organization/id', input);
    await getMerchant(request, 'organization/id', 'merchant/id');
    await updateMerchant(request, 'organization/id', 'merchant/id', input);
    await updateMerchantStatus(
      request,
      'organization/id',
      'merchant/id',
      'ENDED',
    );

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/organizations/organization%2Fid/merchants',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/organizations/organization%2Fid/merchants/merchant%2Fid',
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      '/organizations/organization%2Fid/merchants/merchant%2Fid',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(input) }),
    );
    expect(request).toHaveBeenNthCalledWith(
      4,
      '/organizations/organization%2Fid/merchants/merchant%2Fid/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'ENDED' }),
      }),
    );
  });

  it('rejects malformed API responses before they reach the UI', async () => {
    vi.mocked(request).mockResolvedValue({ ...merchant, status: 'ARCHIVED' });

    await expect(
      getMerchant(request, merchant.organizationId, merchant.id),
    ).rejects.toThrow();
  });
});
