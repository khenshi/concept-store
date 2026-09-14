import {
  reportBranchesSchema,
  reportQuerySchema,
  staffSalesReportSchema,
} from './report.schemas';

export const branch = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Main',
  code: 'MAIN',
};
export const range = {
  from: '2026-09-13T16:00:00.000Z',
  until: '2026-09-14T16:00:00.000Z',
};
export const report = {
  scope: 'STAFF' as const,
  branch,
  ...range,
  grossSales: '60.00',
  transactionCount: '3',
  unitsSold: '5',
  payments: [
    {
      paymentMethod: 'CASH' as const,
      grossSales: '10.00',
      transactionCount: '1',
    },
    {
      paymentMethod: 'GCASH' as const,
      grossSales: '20.00',
      transactionCount: '1',
    },
    {
      paymentMethod: 'CARD' as const,
      grossSales: '30.00',
      transactionCount: '1',
    },
  ],
};

describe('strict staff report contracts', () => {
  it('accepts reconciled reports and fully zero empty periods', () => {
    expect(staffSalesReportSchema.parse(report)).toEqual(report);
    expect(
      staffSalesReportSchema.safeParse({
        ...report,
        grossSales: '0.00',
        transactionCount: '0',
        unitsSold: '0',
        payments: report.payments.map((p) => ({
          ...p,
          grossSales: '0.00',
          transactionCount: '0',
        })),
      }).success,
    ).toBe(true);
  });
  it('retains aggregate amounts and counts above single-sale and JavaScript limits', () => {
    const grossSales = '999999999999999999999999999999.01';
    const transactionCount = '9007199254740993';
    const huge = {
      ...report,
      grossSales,
      transactionCount,
      unitsSold: transactionCount,
      payments: report.payments.map((p, i) => ({
        ...p,
        grossSales: i ? '0.00' : grossSales,
        transactionCount: i ? '0' : transactionCount,
      })),
    };
    expect(staffSalesReportSchema.parse(huge).grossSales).toBe(grossSales);
  });
  it.each(['60', '60.0', '060.00', '-60.00', '6e1', 'NaN'])(
    'rejects noncanonical amount %s safely',
    (grossSales) => {
      expect(
        staffSalesReportSchema.safeParse({ ...report, grossSales }).success,
      ).toBe(false);
    },
  );
  it.each(['03', '-3', '3.0', '3e0'])(
    'rejects noncanonical count %s safely',
    (transactionCount) => {
      expect(
        staffSalesReportSchema.safeParse({ ...report, transactionCount })
          .success,
      ).toBe(false);
    },
  );
  it('rejects mismatched totals/counts, duplicate methods and impossible quantities', () => {
    for (const invalid of [
      { ...report, grossSales: '61.00' },
      { ...report, transactionCount: '4' },
      { ...report, unitsSold: '2' },
      {
        ...report,
        payments: [report.payments[0], report.payments[0], report.payments[2]],
      },
      { ...report, payments: report.payments.slice(1) },
    ])
      expect(staffSalesReportSchema.safeParse(invalid).success).toBe(false);
  });
  it('never accepts merchant-shaped or private fields as a staff report', () => {
    expect(
      staffSalesReportSchema.safeParse({ ...report, scope: 'MERCHANT' })
        .success,
    ).toBe(false);
    expect(
      staffSalesReportSchema.safeParse({ ...report, cashierId: 'private' })
        .success,
    ).toBe(false);
    expect(
      staffSalesReportSchema.safeParse({
        ...report,
        payments: report.payments.map((p) => ({ ...p, reference: 'private' })),
      }).success,
    ).toBe(false);
  });
  it('requires a bounded strict UTC range', () => {
    for (const invalid of [
      { from: range.from },
      { ...range, until: range.from },
      { ...range, from: '2026-09-14T00:00:00+08:00' },
      { ...range, until: '2028-09-14T16:00:00Z' },
      { ...range, page: 1 },
    ])
      expect(reportQuerySchema.safeParse(invalid).success).toBe(false);
  });
  it('accepts only distinct identity-only branch options', () => {
    expect(reportBranchesSchema.parse([branch])).toEqual([branch]);
    expect(reportBranchesSchema.safeParse([branch, branch]).success).toBe(
      false,
    );
    expect(
      reportBranchesSchema.safeParse([{ ...branch, address: 'private' }])
        .success,
    ).toBe(false);
    expect(
      reportBranchesSchema.safeParse([{ ...branch, id: 'not-a-uuid' }]).success,
    ).toBe(false);
  });
});
