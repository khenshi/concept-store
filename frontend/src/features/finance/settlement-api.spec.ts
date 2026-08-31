import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  generateSettlement,
  generateOffCycleSettlement,
  generateMissingSettlements,
  getSettlementSummary,
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

  it('submits only generation inputs to the trusted endpoint', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = {
      merchantId: 'merchant-id',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    };
    await generateSettlement(request, 'organization-id', input);
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/settlements',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
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

  it('loads filtered metrics and submits documented off-cycle drafts', async () => {
    vi.mocked(request).mockResolvedValue({});
    await getSettlementSummary(request, 'organization-id', {
      branchId: 'branch-id',
      periodFrom: '2026-08-01',
    });
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization-id/settlements/summary?branchId=branch-id&periodFrom=2026-08-01',
    );

    const input = {
      merchantId: 'merchant-id',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-15',
      reason: 'Merchant exit',
    };
    await generateOffCycleSettlement(request, 'organization-id', input);
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization-id/settlements/off-cycle',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );

    await generateMissingSettlements(request, 'organization-id');
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization-id/settlements/generate-missing',
      { method: 'POST' },
    );
  });
});
