import { describe, expect, it } from 'vitest';
import { staffSalesAnalyticsSchema } from './report.schemas';

const branch = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Main',
  code: null,
};
const base = {
  scope: 'STAFF' as const,
  branch,
  from: '2026-09-13T16:00:00.000Z',
  until: '2026-09-15T16:00:00.000Z',
  grossSales: '60.00',
  transactionCount: '3',
  unitsSold: '5',
  refundedAmount: '10.00',
  refundCount: '1',
  returnedUnits: '1',
  netRecordedSales: '50.00',
  payments: [
    {
      paymentMethod: 'CASH' as const,
      grossSales: '60.00',
      transactionCount: '3',
    },
    {
      paymentMethod: 'GCASH' as const,
      grossSales: '0.00',
      transactionCount: '0',
    },
    {
      paymentMethod: 'CARD' as const,
      grossSales: '0.00',
      transactionCount: '0',
    },
  ],
  refundMethods: [
    {
      paymentMethod: 'CASH' as const,
      refundedAmount: '10.00',
      refundCount: '1',
    },
    {
      paymentMethod: 'GCASH' as const,
      refundedAmount: '0.00',
      refundCount: '0',
    },
    {
      paymentMethod: 'CARD' as const,
      refundedAmount: '0.00',
      refundCount: '0',
    },
  ],
  dailyTrends: [
    {
      date: '2026-09-14',
      grossSales: '60.00',
      transactionCount: '3',
      unitsSold: '5',
      refundedAmount: '0.00',
      refundCount: '0',
      returnedUnits: '0',
      netRecordedSales: '60.00',
    },
    {
      date: '2026-09-15',
      grossSales: '0.00',
      transactionCount: '0',
      unitsSold: '0',
      refundedAmount: '10.00',
      refundCount: '1',
      returnedUnits: '1',
      netRecordedSales: '-10.00',
    },
  ],
  topProducts: [
    {
      productId: '22222222-2222-4222-8222-222222222222',
      productName: 'Paper',
      sku: null,
      barcode: '123',
      merchantName: 'Maker',
      grossSales: '60.00',
      unitsSold: '5',
      refundedAmount: '10.00',
      returnedUnits: '1',
      netRecordedSales: '50.00',
    },
  ],
  totalProducts: '1',
};
describe('strict staff analytics contract', () => {
  it('accepts reconciled contiguous analytics and unlimited exact amounts', () => {
    expect(staffSalesAnalyticsSchema.parse(base)).toEqual(base);
    const huge = '999999999999999999999999999999.99';
    const value = BigInt(huge.replace('.', '')) - BigInt(1000);
    const hugeNet = `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, '0')}`;
    expect(
      staffSalesAnalyticsSchema.parse({
        ...base,
        grossSales: huge,
        netRecordedSales: hugeNet,
        payments: base.payments.map((row, index) =>
          index ? row : { ...row, grossSales: huge },
        ),
        dailyTrends: base.dailyTrends.map((row, index) =>
          index ? row : { ...row, grossSales: huge, netRecordedSales: huge },
        ),
        topProducts: [
          {
            ...base.topProducts[0],
            grossSales: huge,
            netRecordedSales: hugeNet,
          },
        ],
      }).grossSales,
    ).toBe(huge);
  });
  it.each([
    { dailyTrends: base.dailyTrends.slice(1) },
    {
      dailyTrends: base.dailyTrends.map((row, index) =>
        index === 1 ? { ...row, date: '2026-09-14' } : row,
      ),
    },
    {
      dailyTrends: base.dailyTrends.map((row, index) =>
        index === 0
          ? { ...row, grossSales: '59.00', netRecordedSales: '59.00' }
          : row,
      ),
    },
    { topProducts: [...base.topProducts, base.topProducts[0]] },
    { totalProducts: '0' },
    { topProducts: [{ ...base.topProducts[0], netRecordedSales: '49.99' }] },
    { topProducts: [{ ...base.topProducts[0], unitsSold: '0' }] },
    {
      dailyTrends: base.dailyTrends.map((row, index) =>
        index ? row : { ...row, netRecordedSales: '-0.00' },
      ),
    },
    { privateActor: 'private' },
  ])(
    'rejects malformed, mismatched, duplicate or private analytics %#',
    (change) => {
      expect(
        staffSalesAnalyticsSchema.safeParse({ ...base, ...change }).success,
      ).toBe(false);
    },
  );
  it('accepts refund-only negative products and exact deterministic ordering', () => {
    const refundOnly = {
      ...base.topProducts[0],
      productId: '33333333-3333-4333-8333-333333333333',
      grossSales: '0.00',
      unitsSold: '0',
      refundedAmount: '2.00',
      returnedUnits: '1',
      netRecordedSales: '-2.00',
    };
    expect(
      staffSalesAnalyticsSchema.safeParse({
        ...base,
        topProducts: [...base.topProducts, refundOnly],
        totalProducts: '2',
      }).success,
    ).toBe(true);
    expect(
      staffSalesAnalyticsSchema.safeParse({
        ...base,
        topProducts: [refundOnly, base.topProducts[0]],
        totalProducts: '2',
      }).success,
    ).toBe(false);
  });
  it('requires exact gross, units and product-ID ranking with ten of N semantics', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      ...base.topProducts[0],
      productId: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
      grossSales: `${10 - index}.00`,
      netRecordedSales: `${10 - index}.00`,
      refundedAmount: '0.00',
      returnedUnits: '0',
    }));
    expect(
      staffSalesAnalyticsSchema.safeParse({
        ...base,
        topProducts: rows,
        totalProducts: '999999999999999999999',
      }).success,
    ).toBe(true);
    expect(
      staffSalesAnalyticsSchema.safeParse({
        ...base,
        topProducts: rows.slice(0, 9),
        totalProducts: '11',
      }).success,
    ).toBe(false);
    expect(
      staffSalesAnalyticsSchema.safeParse({
        ...base,
        topProducts: [rows[1], rows[0], ...rows.slice(2)],
        totalProducts: '10',
      }).success,
    ).toBe(false);
    const unitsTie = [
      {
        ...rows[0],
        grossSales: '5.00',
        netRecordedSales: '5.00',
        unitsSold: '1',
      },
      {
        ...rows[1],
        grossSales: '5.00',
        netRecordedSales: '5.00',
        unitsSold: '2',
      },
    ];
    expect(
      staffSalesAnalyticsSchema.safeParse({
        ...base,
        topProducts: unitsTie,
        totalProducts: '2',
      }).success,
    ).toBe(false);
  });
});
