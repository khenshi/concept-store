import {
  getStaffSalesReport,
  getStaffSalesAnalytics,
  getMerchantSalesReport,
  getMerchantSalesAnalytics,
  getStaffSalesRankings,
  getMerchantSalesRankings,
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
  refundedAmount: '0.00',
  refundCount: '0',
  returnedUnits: '0',
  netRecordedSales: '0.00',
  refundMethods: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
    paymentMethod,
    refundedAmount: '0.00',
    refundCount: '0',
  })),
  payments: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
    paymentMethod,
    grossSales: '0.00',
    transactionCount: '0',
  })),
};
const analyticsEmpty = {
  ...empty,
  netByPaymentMethod: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
    paymentMethod,
    netRecordedSales: '0.00',
  })),
  dailyTrends: [
    {
      date: '2026-09-14',
      grossSales: '0.00',
      transactionCount: '0',
      unitsSold: '0',
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: '0.00',
    },
  ],
  topProducts: [],
  totalProducts: '0',
  topMerchants: [],
};
const staffRanking = {
  scope: 'STAFF',
  branch,
  ...range,
  page: 2,
  limit: 10,
  totalProducts: '11',
  hasNext: false,
  items: [
    {
      productId: '22222222-2222-4222-8222-222222222222',
      productName: 'Ranked product',
      sku: null,
      barcode: null,
      merchantName: 'Merchant',
      grossSales: '12.34',
      unitsSold: '2',
      refundedAmount: '0.00',
      returnedUnits: '0',
      netRecordedSales: '12.34',
    },
  ],
};
const merchantRanking = {
  scope: 'MERCHANT',
  branch,
  ...range,
  page: 1,
  limit: 10,
  totalProducts: '1',
  hasNext: false,
  items: [
    {
      productId: '22222222-2222-4222-8222-222222222222',
      productName: 'Own ranked product',
      sku: null,
      barcode: null,
      merchantName: 'Own merchant',
      ownGrossSales: '12.34',
      ownUnitsSold: '2',
      ownRefundedAmount: '0.00',
      ownReturnedUnits: '0',
      ownNetRecordedSales: '12.34',
    },
  ],
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
  it('reads one strict staff analytics snapshot from the focused route', async () => {
    const request = vi.fn().mockResolvedValue(analyticsEmpty);
    expect(
      await getStaffSalesAnalytics(request, 'org/path', branch.id, range),
    ).toEqual(analyticsEmpty);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales/analytics?${new URLSearchParams(range)}`,
    );
  });
  it.each([
    empty,
    { ...analyticsEmpty, totalProducts: '-1' },
    { ...analyticsEmpty, dailyTrends: analyticsEmpty.dailyTrends.slice(1) },
    { ...analyticsEmpty, cashierId: 'private' },
    {
      ...analyticsEmpty,
      branch: { ...branch, id: '22222222-2222-4222-8222-222222222222' },
    },
  ])(
    'rejects incomplete, inconsistent, private or stale analytics %#',
    async (response) => {
      await expect(
        getStaffSalesAnalytics(
          vi.fn().mockResolvedValue(response),
          'org',
          branch.id,
          range,
        ),
      ).rejects.toThrow();
    },
  );
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
  it('reads a server-paginated staff ranking page and validates its cursor', async () => {
    const request = vi.fn().mockResolvedValue(staffRanking);
    expect(
      await getStaffSalesRankings(request, 'org/path', branch.id, {
        ...range,
        page: 2,
      }),
    ).toEqual(staffRanking);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales/rankings?${new URLSearchParams({ ...range, page: '2' })}`,
    );
    await expect(
      getStaffSalesRankings(request, 'org', branch.id, {
        ...range,
        page: 3,
      }),
    ).rejects.toThrow();
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
    ownRefundedAmount: '0.00',
    ownRefundCount: '0',
    ownReturnedUnits: '0',
    ownNetRecordedSales: '25.00',
  };
  const ownAnalytics = {
    ...own,
    dailyTrends: [
      {
        date: '2026-09-14',
        ownGrossSales: '25.00',
        ownTransactionCount: '1',
        ownUnitsSold: '2',
        ownRefundedAmount: '0.00',
        ownRefundCount: '0',
        ownReturnedUnits: '0',
        ownNetRecordedSales: '25.00',
      },
    ],
    topProducts: [
      {
        productId: '33333333-3333-4333-8333-333333333333',
        productName: 'Own product',
        sku: null,
        barcode: null,
        merchantName: 'Own merchant',
        ownGrossSales: '25.00',
        ownUnitsSold: '2',
        ownRefundedAmount: '0.00',
        ownReturnedUnits: '0',
        ownNetRecordedSales: '25.00',
      },
    ],
    totalProducts: '1',
  };
  it('uses only the reduced merchant analytics route and contract', async () => {
    const request = vi.fn().mockResolvedValue(ownAnalytics);
    expect(
      await getMerchantSalesAnalytics(request, 'org/path', branch.id, range),
    ).toEqual(ownAnalytics);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales/analytics?${new URLSearchParams(range)}`,
    );
  });
  it.each([
    analyticsEmpty,
    { ...ownAnalytics, payments: [] },
    {
      ...ownAnalytics,
      dailyTrends: ownAnalytics.dailyTrends.map((row) => ({
        ...row,
        grossSales: '25.00',
      })),
    },
    {
      ...ownAnalytics,
      topProducts: ownAnalytics.topProducts.map((row) => ({
        ...row,
        contactName: 'private',
      })),
    },
    { ...ownAnalytics, ownGrossSales: '24.00' },
    {
      ...ownAnalytics,
      branch: { ...branch, id: '22222222-2222-4222-8222-222222222222' },
    },
  ])(
    'rejects staff, private, malformed or stale merchant analytics %#',
    async (response) => {
      await expect(
        getMerchantSalesAnalytics(
          vi.fn().mockResolvedValue(response),
          'org',
          branch.id,
          range,
        ),
      ).rejects.toThrow();
    },
  );
  it('uses the same scoped read route without fetching staff history, profiles or payments', async () => {
    const request = vi.fn().mockResolvedValue(own);
    expect(
      await getMerchantSalesReport(request, 'org/path', branch.id, range),
    ).toEqual(own);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales?${new URLSearchParams(range)}`,
    );
  });
  it('reads a merchant ranking page through the same scoped route', async () => {
    const request = vi.fn().mockResolvedValue(merchantRanking);
    expect(
      await getMerchantSalesRankings(request, 'org/path', branch.id, {
        ...range,
        page: 1,
      }),
    ).toEqual(merchantRanking);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales/rankings?${new URLSearchParams({ ...range, page: '1' })}`,
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
