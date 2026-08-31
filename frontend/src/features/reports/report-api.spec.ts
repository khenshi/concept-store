import type { AuthenticatedRequest } from '@/features/organizations/organization.types';
import {
  getInventoryReport,
  getMerchantDashboard,
  getMerchantReport,
  getReportsOverview,
  getSalesReport,
} from './report-api';

describe('report API', () => {
  const request = vi.fn() as unknown as AuthenticatedRequest;

  beforeEach(() => vi.clearAllMocks());

  it('uses tenant-scoped report routes and bounded filters', async () => {
    vi.mocked(request).mockResolvedValue({});
    const filters = {
      from: '2026-08-01',
      to: '2026-08-31',
      branchId: 'branch-id',
      merchantId: 'merchant-id',
      offset: 0,
      limit: 50,
    };

    await getReportsOverview(request, 'organization id', filters);
    expect(request).toHaveBeenLastCalledWith(
      '/organizations/organization%20id/reports/overview?from=2026-08-01&to=2026-08-31&branchId=branch-id&merchantId=merchant-id&offset=0&limit=50',
    );

    await getSalesReport(request, 'organization-id', filters);
    await getInventoryReport(request, 'organization-id', filters);
    await getMerchantReport(request, 'organization-id', filters);
    expect(vi.mocked(request).mock.calls.map(([path]) => path)).toEqual([
      expect.stringContaining('/reports/overview?'),
      expect.stringContaining('/reports/sales?'),
      expect.stringContaining('/reports/inventory?'),
      expect.stringContaining('/reports/merchants?'),
    ]);
  });

  it('loads merchant identity from the self-service route', async () => {
    vi.mocked(request).mockResolvedValue({});

    await getMerchantDashboard(request, 'organization/id', {
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(request).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/reports/merchant-dashboard?from=2026-08-01&to=2026-08-31',
    );
  });
});
