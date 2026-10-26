import {
  reportAccount,
  mergeAccountFlows,
} from '@/features/reports/model/report.test-fixtures';
import {
  getStaffSalesReport,
  getStaffSalesAnalytics,
  getMerchantSalesReport,
  getMerchantSalesAnalytics,
  getStaffSalesRankings,
  getMerchantSalesRankings,
  getStaffTransactions,
  getMerchantTransactions,
  listReportBranches,
  resolveReportPeriod,
  getReportDailyPage,
} from './report-api';
const branch = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Main',
  code: null,
};
const branchScope = { kind: 'branch' as const, branchId: branch.id };
const allScope = { kind: 'all' as const };
const range = {
  from: '2026-09-13T16:00:00.000Z',
  until: '2026-09-14T16:00:00.000Z',
};
describe('resolved report periods and daily pages', () => {
  it('requires explicit All time mode and checks scope and concrete bounds', async () => {
    const request = vi.fn().mockResolvedValue({
      scope: 'STAFF',
      branch,
      ...range,
      hasActivity: true,
    });
    await expect(
      resolveReportPeriod(request, 'org', branchScope, range.until, false),
    ).resolves.toMatchObject({ from: range.from });
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('mode=ALL_TIME&until='),
    );
    await expect(
      resolveReportPeriod(request, 'org', branchScope, range.until, true),
    ).rejects.toThrow();
    request.mockResolvedValue({
      scope: 'STAFF',
      branch,
      from: null,
      until: range.until,
      hasActivity: false,
    });
    await expect(
      resolveReportPeriod(request, 'org', branchScope, range.until, false),
    ).resolves.toMatchObject({ from: null, hasActivity: false });
    request.mockResolvedValue({
      scope: 'STAFF',
      branch,
      from: null,
      until: range.until,
      hasActivity: true,
    });
    await expect(
      resolveReportPeriod(request, 'org', branchScope, range.until, false),
    ).rejects.toThrow();
  });
  it('checks daily rows against their exact scope, branch, range and page', async () => {
    const data = {
      scope: 'STAFF',
      branch,
      ...range,
      page: 1,
      limit: 15,
      total: 1,
      totalPages: 1,
      items: [
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
    };
    const request = vi.fn().mockResolvedValue(data);
    await expect(
      getReportDailyPage(
        request,
        'org',
        branchScope,
        { ...range, page: 1 },
        false,
      ),
    ).resolves.toEqual(data);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('page=1&limit=15'),
    );
    await expect(
      getReportDailyPage(
        request,
        'org',
        branchScope,
        { ...range, page: 1 },
        true,
      ),
    ).rejects.toThrow();
    await expect(
      getReportDailyPage(
        request,
        'org',
        { kind: 'branch', branchId: '22222222-2222-4222-8222-222222222222' },
        { ...range, page: 1 },
        false,
      ),
    ).rejects.toThrow();
    await expect(
      getReportDailyPage(
        request,
        'org',
        branchScope,
        { ...range, page: 2 },
        false,
      ),
    ).rejects.toThrow();
  });
  it('resolves and paginates All Branches periods without fabricating a branch', async () => {
    const periodRequest = vi.fn().mockResolvedValue({
      scope: 'STAFF',
      reportScope: 'ALL',
      branchCount: 0,
      from: null,
      until: range.until,
      hasActivity: false,
    });
    await expect(
      resolveReportPeriod(periodRequest, 'org', allScope, range.until, false),
    ).resolves.toMatchObject({
      reportScope: 'ALL',
      branchCount: 0,
      from: null,
      hasActivity: false,
    });
    expect(periodRequest).toHaveBeenCalledWith(
      `/organizations/org/reports/sales/all/period?mode=ALL_TIME&until=${encodeURIComponent(range.until)}`,
    );
    const allDaily = {
      scope: 'STAFF',
      reportScope: 'ALL',
      branchCount: 2,
      ...range,
      page: 1,
      limit: 15,
      total: 1,
      totalPages: 1,
      items: [
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
    };
    const dailyRequest = vi.fn().mockResolvedValue(allDaily);
    await expect(
      getReportDailyPage(
        dailyRequest,
        'org',
        allScope,
        { ...range, page: 1 },
        false,
      ),
    ).resolves.toEqual(allDaily);
    expect(dailyRequest).toHaveBeenCalledWith(
      `/organizations/org/reports/sales/all/daily?${new URLSearchParams({ ...range, page: '1', limit: '15' })}`,
    );
    const { branch: _rankingBranch, ...rankingBase } = staffRanking;
    void _rankingBranch;
    const allRanking = {
      ...rankingBase,
      reportScope: 'ALL' as const,
      branchCount: 2,
    };
    const rankingRequest = vi.fn().mockResolvedValue(allRanking);
    await expect(
      getStaffSalesRankings(rankingRequest, 'org', allScope, {
        ...range,
        page: 2,
      }),
    ).resolves.toEqual(allRanking);
    expect(rankingRequest).toHaveBeenCalledWith(
      `/organizations/org/reports/sales/all/rankings?${new URLSearchParams({ ...range, page: '2', sortBy: 'GROSS_SALES' })}`,
    );
  });
});
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
  paymentAccounts: mergeAccountFlows(
    ['CASH', 'GCASH', 'CARD'].map((paymentMethod) =>
      reportAccount(paymentMethod, {
        received: '0.00',
        transactionCount: '0',
      }),
    ),
    ['CASH', 'GCASH', 'CARD'].map((paymentMethod) =>
      reportAccount(paymentMethod, {
        refunded: '0.00',
        refundCount: '0',
      }),
    ),
  ),
};
const analyticsEmpty = {
  ...empty,
  paymentAccounts: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) =>
    reportAccount(paymentMethod, {
      netReceived: '0.00',
    }),
  ),
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
  sortBy: 'GROSS_SALES',
  merchantId: null,
  page: 2,
  limit: 15,
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
  sortBy: 'GROSS_SALES',
  merchantId: null,
  page: 1,
  limit: 15,
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
const staffTransactions = {
  scope: 'STAFF' as const,
  branch,
  ...range,
  page: 1,
  limit: 15,
  total: 2,
  totalPages: 1,
  items: [
    {
      type: 'SALE' as const,
      id: '33333333-3333-4333-8333-333333333333',
      saleId: '33333333-3333-4333-8333-333333333333',
      refundId: null,
      completedAt: '2026-09-14T05:00:00.000Z',
      reference: 'RCPT-001',
      amount: '25.00',
      paymentAccountId: '77777777-7777-4777-8777-777777777777',
      paymentAccountName: 'Cash',
      paymentAccountIsCash: true,
      paymentAccountRequiresReference: false,
      actorName: 'Cashier One',
      merchantNames: ['Maker'],
    },
    {
      type: 'REFUND' as const,
      id: '44444444-4444-4444-8444-444444444444',
      saleId: '33333333-3333-4333-8333-333333333333',
      refundId: '44444444-4444-4444-8444-444444444444',
      completedAt: '2026-09-14T06:00:00.000Z',
      reference: 'REF-001',
      amount: '5.00',
      paymentAccountId: '77777777-7777-4777-8777-777777777777',
      paymentAccountName: 'Cash',
      paymentAccountIsCash: true,
      paymentAccountRequiresReference: false,
      actorName: 'Manager One',
      merchantNames: ['Maker'],
    },
  ],
};
const merchantTransactions = {
  scope: 'MERCHANT' as const,
  branch,
  ...range,
  page: 1,
  limit: 15,
  total: 1,
  totalPages: 1,
  items: [
    {
      type: 'SALE' as const,
      id: '33333333-3333-4333-8333-333333333333',
      saleId: '33333333-3333-4333-8333-333333333333',
      refundId: null,
      completedAt: '2026-09-14T05:00:00.000Z',
      reference: 'RCPT-001',
      amount: '12.50',
    },
  ],
};
const { branch: _emptyBranch, ...allEmptyBase } = empty;
void _emptyBranch;
const allEmpty = {
  ...allEmptyBase,
  reportScope: 'ALL' as const,
  branchCount: 2,
};
const { branch: _analyticsBranch, ...allAnalyticsBase } = analyticsEmpty;
void _analyticsBranch;
const allAnalyticsEmpty = {
  ...allAnalyticsBase,
  reportScope: 'ALL' as const,
  branchCount: 2,
};
const { branch: _transactionsBranch, ...allTransactionsBase } =
  staffTransactions;
void _transactionsBranch;
const allStaffTransactions = {
  ...allTransactionsBase,
  reportScope: 'ALL' as const,
  branchCount: 2,
  items: staffTransactions.items.map((item) => ({ ...item, branch })),
};
const { branch: _merchantTransactionsBranch, ...allMerchantTransactionsBase } =
  merchantTransactions;
void _merchantTransactionsBranch;
const allMerchantTransactions = {
  ...allMerchantTransactionsBase,
  reportScope: 'ALL' as const,
  branchCount: 2,
  items: merchantTransactions.items.map((item) => ({ ...item, branch })),
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
    expect(
      await getStaffSalesReport(request, 'org', branchScope, range),
    ).toEqual(empty);
    expect(request).toHaveBeenCalledWith(
      `/organizations/org/branches/${branch.id}/reports/sales?${new URLSearchParams(range)}`,
    );
  });
  it('reads all-branch staff reports using explicit aggregate metadata and routes', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(allEmpty)
      .mockResolvedValueOnce(allAnalyticsEmpty)
      .mockResolvedValueOnce(allStaffTransactions);
    await expect(
      getStaffSalesReport(request, 'org', allScope, range),
    ).resolves.toEqual(allEmpty);
    await expect(
      getStaffSalesAnalytics(request, 'org', allScope, range),
    ).resolves.toEqual(allAnalyticsEmpty);
    await expect(
      getStaffTransactions(request, 'org', allScope, {
        ...range,
        page: 1,
        limit: 15,
      }),
    ).resolves.toEqual(allStaffTransactions);
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      `/organizations/org/reports/sales/all?${new URLSearchParams(range)}`,
      `/organizations/org/reports/sales/all/analytics?${new URLSearchParams(range)}`,
      `/organizations/org/reports/transactions/all?${new URLSearchParams({ ...range, page: '1', limit: '15' })}`,
    ]);
  });
  it('rejects all-scope responses that omit count or transaction source branches', async () => {
    await expect(
      getStaffSalesReport(
        vi.fn().mockResolvedValue({ ...allEmpty, branchCount: undefined }),
        'org',
        allScope,
        range,
      ),
    ).rejects.toThrow();
    await expect(
      getStaffTransactions(
        vi.fn().mockResolvedValue({
          ...allStaffTransactions,
          items: allStaffTransactions.items.map(
            ({ branch: source, ...item }) => {
              expect(source).toEqual(branch);
              return item;
            },
          ),
        }),
        'org',
        allScope,
        { ...range, page: 1, limit: 15 },
      ),
    ).rejects.toThrow();
  });
  it('reads one strict staff analytics snapshot from the focused route', async () => {
    const request = vi.fn().mockResolvedValue(analyticsEmpty);
    expect(
      await getStaffSalesAnalytics(request, 'org/path', branchScope, range),
    ).toEqual(analyticsEmpty);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales/analytics?${new URLSearchParams(range)}`,
    );
  });
  it('reads and validates a filtered staff transaction page', async () => {
    const request = vi.fn().mockResolvedValue(staffTransactions);
    expect(
      await getStaffTransactions(request, 'org/path', branchScope, {
        ...range,
        page: 1,
        limit: 15,
        type: 'REFUND',
        q: 'REF-001',
      }),
    ).toEqual(staffTransactions);
    expect(request).toHaveBeenCalledWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/transactions?${new URLSearchParams({ ...range, page: '1', limit: '15', type: 'REFUND', q: 'REF-001' })}`,
    );
  });
  it('keeps merchant transaction responses reduced to own snapshots', async () => {
    const request = vi.fn().mockResolvedValue(merchantTransactions);
    await expect(
      getMerchantTransactions(request, 'org', branchScope, {
        ...range,
        page: 1,
        limit: 15,
      }),
    ).resolves.toEqual(merchantTransactions);
    expect(request).toHaveBeenCalledWith(
      `/organizations/org/branches/${branch.id}/reports/transactions?${new URLSearchParams({ ...range, page: '1', limit: '15' })}`,
    );
    const allRequest = vi.fn().mockResolvedValue(allMerchantTransactions);
    await expect(
      getMerchantTransactions(allRequest, 'org', allScope, {
        ...range,
        page: 1,
        limit: 15,
      }),
    ).resolves.toEqual(allMerchantTransactions);
    expect(allRequest).toHaveBeenCalledWith(
      `/organizations/org/reports/transactions/all?${new URLSearchParams({ ...range, page: '1', limit: '15' })}`,
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
          branchScope,
          range,
        ),
      ).rejects.toThrow();
    },
  );
  it('blocks invalid ranges before making any request', async () => {
    const request = vi.fn();
    await expect(
      getStaffSalesReport(request, 'org', branchScope, {
        ...range,
        until: range.from,
      }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it('reads a server-paginated staff ranking page and validates its cursor', async () => {
    const request = vi.fn().mockResolvedValue(staffRanking);
    expect(
      await getStaffSalesRankings(request, 'org/path', branchScope, {
        ...range,
        page: 2,
      }),
    ).toEqual(staffRanking);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales/rankings?${new URLSearchParams({ ...range, page: '2', sortBy: 'GROSS_SALES' })}`,
    );
    await expect(
      getStaffSalesRankings(request, 'org', branchScope, {
        ...range,
        page: 3,
      }),
    ).rejects.toThrow();
  });
  it('serializes ranking metric and merchant filters and validates their echo', async () => {
    const merchantId = '44444444-4444-4444-8444-444444444444';
    const response = {
      ...staffRanking,
      page: 1,
      sortBy: 'UNITS_SOLD' as const,
      merchantId,
    };
    const request = vi.fn().mockResolvedValue(response);
    await expect(
      getStaffSalesRankings(request, 'org', branchScope, {
        ...range,
        page: 1,
        sortBy: 'UNITS_SOLD',
        merchantId,
      }),
    ).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith(
      `/organizations/org/branches/${branch.id}/reports/sales/rankings?${new URLSearchParams({ ...range, page: '1', sortBy: 'UNITS_SOLD', merchantId })}`,
    );
    await expect(
      getStaffSalesRankings(
        vi.fn().mockResolvedValue({ ...response, sortBy: 'GROSS_SALES' }),
        'org',
        branchScope,
        { ...range, page: 1, sortBy: 'UNITS_SOLD', merchantId },
      ),
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
          branchScope,
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
      await getMerchantSalesAnalytics(request, 'org/path', branchScope, range),
    ).toEqual(ownAnalytics);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales/analytics?${new URLSearchParams(range)}`,
    );
  });
  it.each([
    analyticsEmpty,
    { ...ownAnalytics, paymentAccounts: [] },
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
          branchScope,
          range,
        ),
      ).rejects.toThrow();
    },
  );
  it('uses the same scoped read route without fetching staff history, profiles or payments', async () => {
    const request = vi.fn().mockResolvedValue(own);
    expect(
      await getMerchantSalesReport(request, 'org/path', branchScope, range),
    ).toEqual(own);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales?${new URLSearchParams(range)}`,
    );
  });
  it('uses the explicit all-branch endpoint while retaining the merchant-only projection', async () => {
    const { branch: _branch, ...allOwnBase } = own;
    void _branch;
    const allOwn = {
      ...allOwnBase,
      reportScope: 'ALL' as const,
      branchCount: 2,
    };
    const { branch: _analyticsBranch, ...allOwnAnalyticsBase } = ownAnalytics;
    void _analyticsBranch;
    const allOwnAnalytics = {
      ...allOwnAnalyticsBase,
      reportScope: 'ALL' as const,
      branchCount: 2,
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce(allOwn)
      .mockResolvedValueOnce(allOwnAnalytics);
    await expect(
      getMerchantSalesReport(request, 'org', allScope, range),
    ).resolves.toEqual(allOwn);
    await expect(
      getMerchantSalesAnalytics(request, 'org', allScope, range),
    ).resolves.toEqual(allOwnAnalytics);
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      `/organizations/org/reports/sales/all?${new URLSearchParams(range)}`,
      `/organizations/org/reports/sales/all/analytics?${new URLSearchParams(range)}`,
    ]);
    const { branch: _transactionBranch, ...allMerchantPageBase } =
      merchantTransactions;
    void _transactionBranch;
    const allMerchantPage = {
      ...allMerchantPageBase,
      reportScope: 'ALL' as const,
      branchCount: 2,
      items: merchantTransactions.items.map((item) => ({ ...item, branch })),
    };
    const transactionRequest = vi.fn().mockResolvedValue(allMerchantPage);
    await expect(
      getMerchantTransactions(transactionRequest, 'org', allScope, {
        ...range,
        page: 1,
        limit: 15,
      }),
    ).resolves.toEqual(allMerchantPage);
    expect(transactionRequest).toHaveBeenCalledWith(
      `/organizations/org/reports/transactions/all?${new URLSearchParams({ ...range, page: '1', limit: '15' })}`,
    );
  });
  it('reads a merchant ranking page through the same scoped route', async () => {
    const request = vi.fn().mockResolvedValue(merchantRanking);
    expect(
      await getMerchantSalesRankings(request, 'org/path', branchScope, {
        ...range,
        page: 1,
      }),
    ).toEqual(merchantRanking);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      `/organizations/org%2Fpath/branches/${branch.id}/reports/sales/rankings?${new URLSearchParams({ ...range, page: '1', sortBy: 'GROSS_SALES' })}`,
    );
  });
  it.each([
    empty,
    { ...own, paymentAccounts: [] },
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
          branchScope,
          range,
        ),
      ).rejects.toThrow();
    },
  );
  it('does not read an invalid merchant period', async () => {
    const request = vi.fn();
    await expect(
      getMerchantSalesReport(request, 'org', branchScope, {
        ...range,
        until: range.from,
      }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
