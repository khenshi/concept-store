import { scope } from '@/features/pos/model/pos.test-fixtures';
import { staffRefund } from '../model/refund.test-fixtures';
import { listBranchRefunds } from './branch-refund-api';
import { refundLocation } from '../model/branch-refunds';

export const branchPage = {
  scope: 'STAFF',
  ...scope,
  page: 1,
  limit: 15,
  total: 1,
  totalPages: 1,
  items: [
    {
      id: staffRefund.id,
      saleId: staffRefund.saleId,
      receiptCode: staffRefund.receiptCode,
      refundCode: staffRefund.refundCode,
      completedAt: staffRefund.completedAt,
      paymentMethod: staffRefund.paymentMethod,
      total: staffRefund.total,
    },
  ],
};
describe('branch refund contract', () => {
  const request = vi.fn();
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue(branchPage);
  });
  it('requests paginated history with literal search, actual method and independent refund dates', async () => {
    const location = refundLocation(
      new URLSearchParams('q=REF%25&method=CASH&fromDay=2026-10-21'),
    );
    await expect(
      listBranchRefunds(request, scope, 'MANAGER', location.query),
    ).resolves.toEqual(branchPage);
    const url = new URL(request.mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toBe(
      `/organizations/${scope.organizationId}/branches/${scope.branchId}/refunds`,
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '1',
      limit: '15',
      q: 'REF%',
      paymentMethod: 'CASH',
      from: '2026-10-20T16:00:00.000Z',
      until: '2026-10-21T16:00:00.000Z',
    });
    expect(request.mock.calls[0]).toHaveLength(1);
  });
  it.each(['MERCHANT', 'CASHIER'] as const)(
    'does not request staff history for %s',
    async (role) => {
      await expect(
        listBranchRefunds(request, scope, role, { page: 1, limit: 15 }),
      ).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...branchPage, branchId: staffRefund.id },
    { ...branchPage, organizationId: staffRefund.id },
    { ...branchPage, page: 2 },
    { ...branchPage, totalPages: 2 },
    {
      ...branchPage,
      items: [branchPage.items[0], branchPage.items[0]],
      total: 2,
    },
    {
      ...branchPage,
      items: [{ ...branchPage.items[0], reason: 'private field' }],
    },
    { ...branchPage, items: [{ ...branchPage.items[0], total: '0.00' }] },
  ])(
    'rejects inconsistent scope, pagination and summary payloads',
    async (page) => {
      request.mockResolvedValue(page);
      await expect(
        listBranchRefunds(request, scope, 'OWNER', { page: 1, limit: 15 }),
      ).rejects.toThrow();
    },
  );
  it('rejects partial, reversed or unknown query parameters before requesting', async () => {
    for (const extra of [
      { from: '2026-10-21T00:00:00Z' },
      { from: '2026-10-22T00:00:00Z', until: '2026-10-21T00:00:00Z' },
      { private: true },
    ])
      await expect(
        listBranchRefunds(request, scope, 'OWNER', {
          page: 1,
          limit: 15,
          ...extra,
        }),
      ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('normalizes invalid route pagination, selection IDs and dates', () => {
    const location = refundLocation(
      new URLSearchParams(
        'page=-1&salePage=2.5&fromDay=no&sale=wrong&refund=wrong&method=NO',
      ),
    );
    expect(location.query).toEqual({
      page: 1,
      limit: 15,
      q: undefined,
      paymentMethod: undefined,
    });
    expect(location.saleId).toBeUndefined();
    expect(location.refundId).toBeUndefined();
    expect(location.saleQuery.page).toBe(1);
  });
  it.each(['0001-01-01', '2026-02-30'])(
    'normalizes unsupported calendar bounds without crashing: %s',
    (day) => {
      expect(
        refundLocation(new URLSearchParams({ fromDay: day })).dates,
      ).toEqual({ fromDay: '', throughDay: '' });
    },
  );
  it('supports the final Manila day while keeping exclusive UTC bounds within year 9999', () => {
    expect(
      refundLocation(new URLSearchParams({ fromDay: '9999-12-31' })).query,
    ).toMatchObject({
      from: '9999-12-30T16:00:00.000Z',
      until: '9999-12-31T16:00:00.000Z',
    });
  });
});
