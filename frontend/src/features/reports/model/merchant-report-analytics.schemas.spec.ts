import { describe, expect, it } from 'vitest';
import {
  merchantDailyReportPageSchema,
  merchantSalesAnalyticsSchema,
} from './report.schemas';
it('validates own-only server daily rows and pagination', () => {
  const page = {
    scope: 'MERCHANT',
    branch: base.branch,
    from: base.from,
    until: base.until,
    page: 1,
    limit: 15,
    total: 1,
    totalPages: 1,
    items: base.dailyTrends,
  };
  expect(merchantDailyReportPageSchema.safeParse(page).success).toBe(true);
  expect(
    merchantDailyReportPageSchema.safeParse({
      ...page,
      items: [{ ...base.dailyTrends[0], grossSales: '99.00' }],
    }).success,
  ).toBe(false);
  expect(
    merchantDailyReportPageSchema.safeParse({
      ...page,
      items: [{ ...base.dailyTrends[0], ownNetRecordedSales: '25.00' }],
    }).success,
  ).toBe(false);
});
it('reconciles monthly own-only buckets without exposing staff fields', () => {
  const dailyTrends = Array.from({ length: 25 }, (_, index) => ({
    ...base.dailyTrends[0],
    date: `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`,
    ...(index
      ? {
          ownGrossSales: '0.00',
          ownTransactionCount: '0',
          ownUnitsSold: '0',
          ownRefundedAmount: '0.00',
          ownRefundCount: '0',
          ownReturnedUnits: '0',
          ownNetRecordedSales: '0.00',
        }
      : {}),
  }));
  const report = {
    ...base,
    from: '2023-12-31T16:00:00Z',
    until: '2026-01-01T16:00:00Z',
    granularity: 'MONTH',
    dailyTrends,
  };
  expect(merchantSalesAnalyticsSchema.safeParse(report).success).toBe(true);
  expect(
    merchantSalesAnalyticsSchema.safeParse({
      ...report,
      dailyTrends: dailyTrends.slice(1),
    }).success,
  ).toBe(false);
  expect(
    merchantSalesAnalyticsSchema.safeParse({
      ...report,
      dailyTrends: dailyTrends.map((row) => ({ ...row, grossSales: '99.00' })),
    }).success,
  ).toBe(false);
});
const base = {
  scope: 'MERCHANT' as const,
  branch: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Main',
    code: null,
  },
  from: '2026-09-13T16:00:00.000Z',
  until: '2026-09-14T16:00:00.000Z',
  ownGrossSales: '25.00',
  ownTransactionCount: '1',
  ownUnitsSold: '2',
  ownRefundedAmount: '5.00',
  ownRefundCount: '1',
  ownReturnedUnits: '1',
  ownNetRecordedSales: '20.00',
  dailyTrends: [
    {
      date: '2026-09-14',
      ownGrossSales: '25.00',
      ownTransactionCount: '1',
      ownUnitsSold: '2',
      ownRefundedAmount: '5.00',
      ownRefundCount: '1',
      ownReturnedUnits: '1',
      ownNetRecordedSales: '20.00',
    },
  ],
  topProducts: [
    {
      productId: '22222222-2222-4222-8222-222222222222',
      productName: 'Saved own item',
      sku: null,
      barcode: null,
      merchantName: 'Saved merchant',
      ownGrossSales: '25.00',
      ownUnitsSold: '2',
      ownRefundedAmount: '5.00',
      ownReturnedUnits: '1',
      ownNetRecordedSales: '20.00',
    },
  ],
  totalProducts: '1',
};
describe('strict merchant analytics contract', () => {
  it('accepts only reconciled own-only analytics and assigned-unlinked zeros', () => {
    expect(merchantSalesAnalyticsSchema.parse(base)).toEqual(base);
    const zeroDay = {
      date: '2026-09-14',
      ownGrossSales: '0.00',
      ownTransactionCount: '0',
      ownUnitsSold: '0',
      ownRefundedAmount: '0.00',
      ownRefundCount: '0',
      ownReturnedUnits: '0',
      ownNetRecordedSales: '0.00',
    };
    expect(
      merchantSalesAnalyticsSchema.safeParse({
        ...base,
        ownGrossSales: '0.00',
        ownTransactionCount: '0',
        ownUnitsSold: '0',
        ownRefundedAmount: '0.00',
        ownRefundCount: '0',
        ownReturnedUnits: '0',
        ownNetRecordedSales: '0.00',
        dailyTrends: [zeroDay],
        topProducts: [],
        totalProducts: '0',
      }).success,
    ).toBe(true);
  });
  it('accepts refund-only own historical products with negative net', () => {
    expect(
      merchantSalesAnalyticsSchema.safeParse({
        ...base,
        ownGrossSales: '0.00',
        ownTransactionCount: '0',
        ownUnitsSold: '0',
        ownNetRecordedSales: '-5.00',
        dailyTrends: [
          {
            ...base.dailyTrends[0],
            ownGrossSales: '0.00',
            ownTransactionCount: '0',
            ownUnitsSold: '0',
            ownNetRecordedSales: '-5.00',
          },
        ],
        topProducts: [
          {
            ...base.topProducts[0],
            ownGrossSales: '0.00',
            ownUnitsSold: '0',
            ownNetRecordedSales: '-5.00',
          },
        ],
      }).success,
    ).toBe(true);
  });
  it('keeps exact own values above JavaScript and single-sale limits', () => {
    const huge = '999999999999999999999999999999.99';
    const changed = {
      ...base,
      ownGrossSales: huge,
      ownTransactionCount: '9007199254740993',
      ownUnitsSold: '9007199254740994',
      ownRefundedAmount: '0.00',
      ownRefundCount: '0',
      ownReturnedUnits: '0',
      ownNetRecordedSales: huge,
      dailyTrends: [
        {
          ...base.dailyTrends[0],
          ownGrossSales: huge,
          ownTransactionCount: '9007199254740993',
          ownUnitsSold: '9007199254740994',
          ownRefundedAmount: '0.00',
          ownRefundCount: '0',
          ownReturnedUnits: '0',
          ownNetRecordedSales: huge,
        },
      ],
      topProducts: [
        {
          ...base.topProducts[0],
          ownGrossSales: huge,
          ownUnitsSold: '9007199254740994',
          ownRefundedAmount: '0.00',
          ownReturnedUnits: '0',
          ownNetRecordedSales: huge,
        },
      ],
    };
    expect(merchantSalesAnalyticsSchema.parse(changed).ownGrossSales).toBe(
      huge,
    );
  });
  it.each([
    { grossSales: '25.00' },
    { paymentAccounts: [] },
    { paymentAccounts: [] },
    {
      dailyTrends: base.dailyTrends.map((row) => ({
        ...row,
        transactionCount: '1',
      })),
    },
    {
      topProducts: base.topProducts.map((row) => ({
        ...row,
        refundedAmount: '5.00',
      })),
    },
    {
      dailyTrends: base.dailyTrends.map((row) => ({
        ...row,
        ownNetRecordedSales: '19.99',
      })),
    },
    {
      topProducts: base.topProducts.map((row) => ({
        ...row,
        contactName: 'private',
      })),
    },
    { totalProducts: '0' },
  ])(
    'rejects staff/private fields or inconsistent own analytics %#',
    (change) => {
      expect(
        merchantSalesAnalyticsSchema.safeParse({ ...base, ...change }).success,
      ).toBe(false);
    },
  );
});
