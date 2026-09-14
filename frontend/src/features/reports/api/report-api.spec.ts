import {
  getStaffSalesReport,
  getMerchantSalesReport,
  listReportBranches,
} from './report-api';

const branch = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Main',
  code: null,
};
const range = {
  from: '2026-09-13T16:00:00.000Z',
  until: '2026-09-14T16:00:00.000Z',
};
const empty = {
  scope: 'STAFF',
  branch,
  ...range,
  grossSales: '0.00',
  transactionCount: '0',
  unitsSold: '0',
  payments: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
    paymentMethod,
    grossSales: '0.00',
    transactionCount: '0',
  })),
};

describe('report reads', () => {
  it('uses the identity-only Reports lookup and encodes tenant identifiers', async () => {
    const request = vi.fn().mockResolvedValue([branch]);
    expect(await listReportBranches(request, 'org/path')).toEqual([branch]);
    expect(request).toHaveBeenCalledWith(
      '/organizations/org%2Fpath/reports/sales/branches',
    );
  });
  it('reads and validates the exact selected branch and range without write options', async () => {
    const request = vi.fn().mockResolvedValue(empty);
    expect(await getStaffSalesReport(request, 'org', branch.id, range)).toEqual(
      empty,
    );
    expect(request).toHaveBeenCalledWith(
      `/organizations/org/branches/${branch.id}/reports/sales?${new URLSearchParams(range)}`,
    );
  });
  it('blocks invalid ranges before making any request', async () => {
    const request = vi.fn();
    await expect(
      getStaffSalesReport(request, 'org', branch.id, {
        ...range,
        until: range.from,
      }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    {
      ...empty,
      branch: { ...branch, id: '22222222-2222-4222-8222-222222222222' },
    },
    { ...empty, from: '2026-09-13T15:00:00.000Z' },
    { ...empty, scope: 'MERCHANT' },
    { ...empty, grossSales: '1.00' },
  ])(
    'rejects stale or malformed scope instead of displaying it',
    async (response) => {
      await expect(
        getStaffSalesReport(
          vi.fn().mockResolvedValue(response),
          'org',
          branch.id,
          range,
        ),
      ).rejects.toThrow();
    },
  );
});

describe('merchant Reports API', () => {
  const own = {
    scope: 'MERCHANT',
    branch,
    ...range,
    ownGrossSales: '25.00',
    ownTransactionCount: '1',
    ownUnitsSold: '2',
  };
  it('uses the same scoped read route without fetching staff history, profiles or payments', async () => {
    const request = vi.fn().mockResolvedValue(own);
    expect(
      await getMerchantSalesReport(request, 'org/path', branch.id, range),
    ).toEqual(own);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales?${new URLSearchParams(range)}`,
    );
  });
  it.each([
    empty,
    { ...own, payments: [] },
    { ...own, ownGrossSales: '25.0' },
    {
      ...own,
      branch: { ...branch, id: '22222222-2222-4222-8222-222222222222' },
    },
    { ...own, until: '2026-09-15T16:00:00.000Z' },
  ])(
    'rejects private, staff or stale branch/range responses with no fallback',
    async (response) => {
      await expect(
        getMerchantSalesReport(
          vi.fn().mockResolvedValue(response),
          'org',
          branch.id,
          range,
        ),
      ).rejects.toThrow();
    },
  );
  it('does not read an invalid merchant period', async () => {
    const request = vi.fn();
    await expect(
      getMerchantSalesReport(request, 'org', branch.id, {
        ...range,
        until: range.from,
      }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
