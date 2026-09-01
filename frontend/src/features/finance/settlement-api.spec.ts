import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  closeLivePayable,
  listLivePayables,
  listSettlements,
  recordPayout,
  settlementAction,
} from './settlement-api';

describe('settlement API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;
  beforeEach(() => vi.clearAllMocks());

  it('lists settlements using organization-scoped filters', async () => {
    vi.mocked(request).mockResolvedValue({});
    await listSettlements(request, 'organization id', {
      merchantId: 'merchant-id',
      status: 'APPROVED',
      limit: 30,
    });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%20id/settlements?merchantId=merchant-id&status=APPROVED&limit=30',
    );
  });

  it('loads and closes live merchant payables', async () => {
    vi.mocked(request).mockResolvedValue({});
    await listLivePayables(request, 'organization-id', {
      merchantId: 'merchant-id',
      branchId: 'branch-id',
    });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/settlements/payables?merchantId=merchant-id&branchId=branch-id',
    );
    await closeLivePayable(request, 'organization-id', 'merchant-id');
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization-id/settlements/payables/merchant-id/close',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses dedicated lifecycle and payout actions', async () => {
    vi.mocked(request).mockResolvedValue({});
    await settlementAction(
      request,
      'organization-id',
      'settlement-id',
      'approve',
    );
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/settlements/settlement-id/approve',
      expect.objectContaining({ method: 'POST' }),
    );

    const payout = {
      method: 'GCASH' as const,
      referenceNumber: 'REF-1',
      paidAt: '2026-08-31T04:00:00.000Z',
    };
    await recordPayout(request, 'organization-id', 'settlement-id', payout);
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization-id/settlements/settlement-id/payout',
      expect.objectContaining({ body: JSON.stringify(payout) }),
    );
  });
});
