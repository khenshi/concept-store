import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  collectAgreementPrepayment,
  listSpaceAvailability,
  transitionAgreement,
} from './merchant-agreement-api';

describe('merchant agreement API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;

  beforeEach(() => vi.clearAllMocks());

  it('requests advisory availability with the agreement period', async () => {
    vi.mocked(request).mockResolvedValue([]);
    await listSpaceAvailability(
      request,
      'organization id',
      '2026-09-10',
      12,
      '11111111-1111-4111-8111-111111111111',
    );
    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%20id/spaces/availability?activationAt=2026-09-10&durationMonths=12&excludeAgreementId=11111111-1111-4111-8111-111111111111',
    );
  });

  it('uses POST only for submission and PATCH for later transitions', async () => {
    vi.mocked(request).mockResolvedValue({});
    await transitionAgreement(request, 'org', 'agreement', 'submit');
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/org/merchant-agreements/agreement/submit',
      expect.objectContaining({ method: 'POST' }),
    );
    await transitionAgreement(request, 'org', 'agreement', 'approve');
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/org/merchant-agreements/agreement/approve',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('sends idempotent pending collection details', async () => {
    vi.mocked(request).mockResolvedValue({});
    const input = {
      amount: '2500.00',
      method: 'GCASH',
      referenceNumber: 'PAY-1',
      occurredAt: '2026-09-10T01:00:00.000Z',
      requestId: '22222222-2222-4222-8222-222222222222',
    };
    await collectAgreementPrepayment(
      request,
      'org',
      'agreement',
      'FIRST_RENT',
      input,
    );
    expect(request).toHaveBeenCalledWith(
      '/organizations/org/merchant-agreements/agreement/prepayments/FIRST_RENT/collections',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
});
