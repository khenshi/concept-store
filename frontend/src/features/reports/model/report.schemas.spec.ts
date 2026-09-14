import {
  reportBranchesSchema,
  reportQuerySchema,
  staffSalesReportSchema,
  merchantSalesReportSchema,
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
  refundedAmount: '0.00',
  refundCount: '0',
  returnedUnits: '0',
  netRecordedSales: '60.00',
  refundMethods: ['CASH', 'GCASH', 'CARD'].map((paymentMethod) => ({
    paymentMethod,
    refundedAmount: '0.00',
    refundCount: '0',
  })),
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
  it('requires the complete refund group rather than pretending legacy gross-only data has zeros', () => {
    const legacy = Object.fromEntries(
      Object.entries(report).filter(
        ([key]) =>
          ![
            'refundedAmount',
            'refundCount',
            'returnedUnits',
            'netRecordedSales',
            'refundMethods',
          ].includes(key),
      ),
    );
    expect(staffSalesReportSchema.safeParse(legacy).success).toBe(false);
  });
  it('accepts reconciled reports and fully zero empty periods', () => {
    expect(staffSalesReportSchema.parse(report)).toEqual(report);
    expect(
      staffSalesReportSchema.safeParse({
        ...report,
        grossSales: '0.00',
        transactionCount: '0',
        unitsSold: '0',
        netRecordedSales: '0.00',
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
      netRecordedSales: grossSales,
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

describe('strict merchant own-sales contracts', () => {
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
  it('accepts only own totals and distinct matching transaction counts', () => {
    expect(merchantSalesReportSchema.parse(own)).toEqual(own);
    expect(
      merchantSalesReportSchema.safeParse({
        ...own,
        ownGrossSales: '0.00',
        ownTransactionCount: '0',
        ownUnitsSold: '0',
        ownNetRecordedSales: '0.00',
      }).success,
    ).toBe(true);
  });
  it.each([
    'payments',
    'paymentMethod',
    'paymentReference',
    'cashTender',
    'change',
    'cashierId',
    'total',
    'grossSales',
    'transactionCount',
    'unitsSold',
    'items',
    'contactName',
    'phone',
    'requestId',
  ])(
    'rejects private/staff field %s rather than silently stripping it',
    (key) => {
      expect(
        merchantSalesReportSchema.safeParse({ ...own, [key]: 'private' })
          .success,
      ).toBe(false);
    },
  );
  it('rejects staff reports even if they describe a single-merchant sale', () => {
    expect(merchantSalesReportSchema.safeParse(report).success).toBe(false);
    expect(
      merchantSalesReportSchema.safeParse({ ...own, scope: 'STAFF' }).success,
    ).toBe(false);
  });
  it('retains exact large own amounts and counters without sale-size limits', () => {
    expect(
      merchantSalesReportSchema.parse({
        ...own,
        ownGrossSales: '999999999999999999999999999999.01',
        ownNetRecordedSales: '999999999999999999999999999999.01',
        ownTransactionCount: '9007199254740993',
        ownUnitsSold: '9007199254740994',
      }).ownTransactionCount,
    ).toBe('9007199254740993');
  });
  it('rejects malformed counts/amounts and impossible own totals safely', () => {
    for (const invalid of [
      { ...own, ownGrossSales: '25' },
      { ...own, ownTransactionCount: '-1' },
      { ...own, ownUnitsSold: '0' },
      { ...own, ownTransactionCount: '0' },
      { ...own, ownGrossSales: '0.00' },
      { ...own, until: range.from },
    ])
      expect(merchantSalesReportSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('expanded refund-aware report compatibility', () => {
  const refunded = {
    ...report,
    refundedAmount: '70.01',
    refundCount: '2',
    returnedUnits: '3',
    netRecordedSales: '-10.01',
    refundMethods: [
      { paymentMethod: 'CASH', refundedAmount: '0.00', refundCount: '0' },
      { paymentMethod: 'GCASH', refundedAmount: '10.00', refundCount: '1' },
      { paymentMethod: 'CARD', refundedAmount: '60.01', refundCount: '1' },
    ],
  };
  const own = {
    scope: 'MERCHANT',
    branch,
    ...range,
    ownGrossSales: '0.00',
    ownTransactionCount: '0',
    ownUnitsSold: '0',
    ownRefundedAmount: '25.00',
    ownRefundCount: '1',
    ownReturnedUnits: '2',
    ownNetRecordedSales: '-25.00',
  };
  it('accepts complete negative-net staff and own refund-only periods', () => {
    expect(staffSalesReportSchema.parse(refunded)).toEqual(refunded);
    expect(merchantSalesReportSchema.parse(own)).toEqual(own);
  });
  it('accepts explicit zero refunds and canonical zero net without negative zero', () => {
    expect(
      staffSalesReportSchema.safeParse({
        ...report,
        refundedAmount: '0.00',
        refundCount: '0',
        returnedUnits: '0',
        netRecordedSales: '60.00',
        refundMethods: refunded.refundMethods.map((row) => ({
          ...row,
          refundedAmount: '0.00',
          refundCount: '0',
        })),
      }).success,
    ).toBe(true);
    expect(
      merchantSalesReportSchema.safeParse({
        ...own,
        ownRefundedAmount: '0.00',
        ownRefundCount: '0',
        ownReturnedUnits: '0',
        ownNetRecordedSales: '0.00',
      }).success,
    ).toBe(true);
  });
  it.each([
    'refundedAmount',
    'refundCount',
    'returnedUnits',
    'netRecordedSales',
    'refundMethods',
  ])('rejects incomplete staff refund groups without %s', (key) => {
    expect(
      staffSalesReportSchema.safeParse({ ...refunded, [key]: undefined })
        .success,
    ).toBe(false);
  });
  it.each([
    'ownRefundedAmount',
    'ownRefundCount',
    'ownReturnedUnits',
    'ownNetRecordedSales',
  ])('rejects incomplete own refund groups without %s', (key) => {
    expect(
      merchantSalesReportSchema.safeParse({ ...own, [key]: undefined }).success,
    ).toBe(false);
  });
  it.each(['-0.00', '+10.01', '-010.01', '-10.0', '-1e1', 'NaN', '10.01'])(
    'rejects noncanonical or unreconciled signed net %s safely',
    (netRecordedSales) => {
      expect(
        staffSalesReportSchema.safeParse({ ...refunded, netRecordedSales })
          .success,
      ).toBe(false);
      expect(
        merchantSalesReportSchema.safeParse({
          ...own,
          ownNetRecordedSales: netRecordedSales,
        }).success,
      ).toBe(false);
    },
  );
  it('rejects mismatched method sums/counts, duplicate methods and impossible returned units', () => {
    for (const invalid of [
      { ...refunded, refundCount: '3' },
      { ...refunded, returnedUnits: '1' },
      { ...refunded, refundedAmount: '-70.01' },
      { ...refunded, refundMethods: refunded.refundMethods.slice(1) },
      {
        ...refunded,
        refundMethods: [
          refunded.refundMethods[0],
          refunded.refundMethods[1],
          refunded.refundMethods[1],
        ],
      },
      {
        ...refunded,
        refundMethods: refunded.refundMethods.map((row) => ({
          ...row,
          refundedAmount: 'NaN',
        })),
      },
      {
        ...refunded,
        refundMethods: refunded.refundMethods.map((row) => ({
          ...row,
          refundCount: '1e1',
        })),
      },
    ])
      expect(staffSalesReportSchema.safeParse(invalid).success).toBe(false);
    expect(
      merchantSalesReportSchema.safeParse({ ...own, ownReturnedUnits: '0' })
        .success,
    ).toBe(false);
    expect(
      merchantSalesReportSchema.safeParse({ ...own, ownRefundCount: '0' })
        .success,
    ).toBe(false);
  });
  it('reconciles unlimited exact aggregate money above Decimal precision limits', () => {
    const gross = '9999999999999999999999999999999999999999999999999999.99';
    const refund = '9999999999999999999999999999999999999999999999999999.98';
    const huge = {
      ...report,
      grossSales: gross,
      payments: report.payments.map((row, i) => ({
        ...row,
        grossSales: i ? '0.00' : gross,
        transactionCount: i ? '0' : '3',
      })),
      refundedAmount: refund,
      refundCount: '1',
      returnedUnits: '1',
      netRecordedSales: '0.01',
      refundMethods: refunded.refundMethods.map((row, i) => ({
        ...row,
        refundedAmount: i ? '0.00' : refund,
        refundCount: i ? '0' : '1',
      })),
    };
    expect(staffSalesReportSchema.parse(huge).netRecordedSales).toBe('0.01');
    expect(
      merchantSalesReportSchema.parse({
        ...own,
        ownGrossSales: gross,
        ownTransactionCount: '1',
        ownUnitsSold: '1',
        ownRefundedAmount: refund,
        ownNetRecordedSales: '0.01',
      }).ownNetRecordedSales,
    ).toBe('0.01');
  });
  it('does not permit staff refund data or private metadata in own responses', () => {
    for (const field of [
      'refundMethods',
      'refundedAmount',
      'refundCount',
      'returnedUnits',
      'netRecordedSales',
      'reason',
      'createdById',
      'refundCommand',
    ])
      expect(
        merchantSalesReportSchema.safeParse({ ...own, [field]: 'PRIVATE' })
          .success,
      ).toBe(false);
    expect(
      staffSalesReportSchema.safeParse({
        ...refunded,
        refundMethods: refunded.refundMethods.map((row) => ({
          ...row,
          paymentReference: 'PRIVATE',
        })),
      }).success,
    ).toBe(false);
  });
});
