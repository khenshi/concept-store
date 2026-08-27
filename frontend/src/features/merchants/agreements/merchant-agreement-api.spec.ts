import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  activateMerchantAgreement,
  createMerchantAgreement,
  endMerchantAgreement,
  getMerchantAgreement,
  listOrganizationAgreements,
  listMerchantAgreements,
  updateMerchantAgreement,
} from './merchant-agreement-api';

describe('merchant agreement API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;
  beforeEach(() => vi.clearAllMocks());

  it('lists and creates agreements through the merchant path', async () => {
    vi.mocked(request).mockResolvedValue([]);
    await listMerchantAgreements(request, 'organization/id', 'merchant/id');
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/merchants/merchant%2Fid/agreements',
    );

    const input = {
      startDate: '2026-09-01',
      settlementSchedule: 'MONTHLY' as const,
    };
    await createMerchantAgreement(
      request,
      'organization-id',
      'merchant-id',
      input,
    );
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization-id/merchants/merchant-id/agreements',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('lists organization agreements and gets one agreement', async () => {
    vi.mocked(request).mockResolvedValue([]);
    await listOrganizationAgreements(request, 'organization/id');
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization%2Fid/merchant-agreements',
    );

    await getMerchantAgreement(request, 'organization/id', 'agreement/id');
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization%2Fid/merchant-agreements/agreement%2Fid',
    );
  });

  it('updates, activates, and ends through the agreement path', async () => {
    vi.mocked(request).mockResolvedValue({});
    const update = {
      startDate: '2026-09-01',
      endDate: null,
      fixedRentAmount: '2500.00',
      commissionRate: null,
      settlementSchedule: 'MONTHLY' as const,
    };
    await updateMerchantAgreement(
      request,
      'organization-id',
      'agreement/id',
      update,
    );
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization-id/merchant-agreements/agreement%2Fid',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(update),
      }),
    );

    await activateMerchantAgreement(request, 'organization-id', 'agreement/id');
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization-id/merchant-agreements/agreement%2Fid/activate',
      { method: 'PATCH' },
    );

    await endMerchantAgreement(
      request,
      'organization-id',
      'agreement/id',
      '2026-09-30',
    );
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization-id/merchant-agreements/agreement%2Fid/end',
      expect.objectContaining({
        body: JSON.stringify({ endDate: '2026-09-30' }),
      }),
    );
  });
});
