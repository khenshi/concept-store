import { z } from 'zod';
import { moneyCents } from '@/features/pos/model/checkout';

const amount = z.string().regex(/^(?:0|[1-9]\d*)\.\d{2}$/);
const integer = z.string().regex(/^(?:0|[1-9]\d*)$/);
const signedAmount = z.string().regex(/^(?!-0\.00$)-?(?:0|[1-9]\d*)\.\d{2}$/);
const refundMethodSchema = z
  .object({
    paymentMethod: z.enum(['CASH', 'GCASH', 'CARD']),
    refundedAmount: amount,
    refundCount: integer,
  })
  .strict();
function validRefunds(
  gross: string,
  refunded: string,
  count: string,
  units: string,
  net: string,
) {
  if (
    !amount.safeParse(gross).success ||
    !amount.safeParse(refunded).success ||
    !integer.safeParse(count).success ||
    !integer.safeParse(units).success ||
    !signedAmount.safeParse(net).success
  )
    return false;
  return (
    BigInt(net.replace('.', '')) === moneyCents(gross) - moneyCents(refunded) &&
    (BigInt(count) === BigInt(0)
      ? moneyCents(refunded) === BigInt(0) && BigInt(units) === BigInt(0)
      : moneyCents(refunded) > BigInt(0) && BigInt(units) >= BigInt(count))
  );
}
const utc = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  .datetime();
export const reportQuerySchema = z
  .object({ from: utc, until: utc })
  .strict()
  .refine((range) => {
    const length = Date.parse(range.until) - Date.parse(range.from);
    return length > 0 && length <= 366 * 86400000;
  }, 'Choose a valid UTC report period of no more than 366 days.');
export const reportBranchSchema = z
  .object({
    id: z.uuidv4(),
    name: z.string().min(1),
    code: z.string().nullable(),
  })
  .strict();
export const reportBranchesSchema = reportBranchSchema
  .array()
  .refine(
    (branches) =>
      new Set(branches.map((branch) => branch.id)).size === branches.length,
    'Report branches must be distinct.',
  );
const paymentSchema = z
  .object({
    paymentMethod: z.enum(['CASH', 'GCASH', 'CARD']),
    grossSales: amount,
    transactionCount: integer,
  })
  .strict();
export const staffSalesReportSchema = z
  .object({
    scope: z.literal('STAFF'),
    branch: reportBranchSchema,
    from: utc,
    until: utc,
    grossSales: amount,
    transactionCount: integer,
    unitsSold: integer,
    payments: paymentSchema.array().length(3),
    refundedAmount: amount,
    refundCount: integer,
    returnedUnits: integer,
    netRecordedSales: signedAmount,
    refundMethods: refundMethodSchema.array().length(3),
  })
  .strict()
  .superRefine((report, context) => {
    {
      const {
        refundedAmount,
        refundCount,
        returnedUnits,
        netRecordedSales,
        refundMethods,
      } = report;
      if (
        !validRefunds(
          report.grossSales,
          refundedAmount,
          refundCount,
          returnedUnits,
          netRecordedSales,
        ) ||
        refundMethods.some(
          (row) =>
            !amount.safeParse(row.refundedAmount).success ||
            !integer.safeParse(row.refundCount).success,
        ) ||
        new Set(refundMethods.map((row) => row.paymentMethod)).size !== 3 ||
        refundMethods.reduce(
          (sum, row) => sum + moneyCents(row.refundedAmount),
          BigInt(0),
        ) !== moneyCents(refundedAmount) ||
        refundMethods.reduce(
          (sum, row) => sum + BigInt(row.refundCount),
          BigInt(0),
        ) !== BigInt(refundCount) ||
        refundMethods.some(
          (row) =>
            (BigInt(row.refundCount) === BigInt(0)) !==
            (moneyCents(row.refundedAmount) === BigInt(0)),
        )
      )
        context.addIssue({
          code: 'custom',
          message:
            'Refund totals, methods and net recorded sales do not reconcile.',
        });
    }
    if (
      !reportQuerySchema.safeParse({ from: report.from, until: report.until })
        .success
    )
      context.addIssue({ code: 'custom', message: 'Invalid report range.' });
    // Invalid child fields must not be passed to BigInt.
    if (
      !amount.safeParse(report.grossSales).success ||
      !integer.safeParse(report.transactionCount).success ||
      !integer.safeParse(report.unitsSold).success ||
      report.payments.some(
        (payment) =>
          !amount.safeParse(payment.grossSales).success ||
          !integer.safeParse(payment.transactionCount).success,
      )
    )
      return;
    if (
      new Set(report.payments.map((payment) => payment.paymentMethod)).size !==
        3 ||
      report.payments.reduce(
        (total, payment) => total + moneyCents(payment.grossSales),
        BigInt(0),
      ) !== moneyCents(report.grossSales) ||
      report.payments.reduce(
        (total, payment) => total + BigInt(payment.transactionCount),
        BigInt(0),
      ) !== BigInt(report.transactionCount) ||
      (BigInt(report.transactionCount) === BigInt(0)
        ? moneyCents(report.grossSales) !== BigInt(0) ||
          BigInt(report.unitsSold) !== BigInt(0)
        : moneyCents(report.grossSales) <= BigInt(0) ||
          BigInt(report.unitsSold) < BigInt(report.transactionCount)) ||
      report.payments.some(
        (payment) =>
          (BigInt(payment.transactionCount) === BigInt(0)) !==
          (moneyCents(payment.grossSales) === BigInt(0)),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Sales report totals and payment counts do not reconcile.',
      });
    }
  });
export type ReportBranch = z.infer<typeof reportBranchSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type StaffSalesReport = z.infer<typeof staffSalesReportSchema>;

export const merchantSalesReportSchema = z
  .object({
    scope: z.literal('MERCHANT'),
    branch: reportBranchSchema,
    from: utc,
    until: utc,
    ownGrossSales: amount,
    ownTransactionCount: integer,
    ownUnitsSold: integer,
    ownRefundedAmount: amount,
    ownRefundCount: integer,
    ownReturnedUnits: integer,
    ownNetRecordedSales: signedAmount,
  })
  .strict()
  .superRefine((report, context) => {
    {
      const {
        ownRefundedAmount,
        ownRefundCount,
        ownReturnedUnits,
        ownNetRecordedSales,
      } = report;
      if (
        !validRefunds(
          report.ownGrossSales,
          ownRefundedAmount,
          ownRefundCount,
          ownReturnedUnits,
          ownNetRecordedSales,
        )
      )
        context.addIssue({
          code: 'custom',
          message: 'Own refunds and net recorded sales do not reconcile.',
        });
    }
    if (
      !reportQuerySchema.safeParse({ from: report.from, until: report.until })
        .success
    )
      context.addIssue({
        code: 'custom',
        message: 'Invalid own-sales report range.',
      });
    if (
      !amount.safeParse(report.ownGrossSales).success ||
      !integer.safeParse(report.ownTransactionCount).success ||
      !integer.safeParse(report.ownUnitsSold).success
    )
      return;
    const count = BigInt(report.ownTransactionCount);
    if (
      count === BigInt(0)
        ? moneyCents(report.ownGrossSales) !== BigInt(0) ||
          BigInt(report.ownUnitsSold) !== BigInt(0)
        : moneyCents(report.ownGrossSales) <= BigInt(0) ||
          BigInt(report.ownUnitsSold) < count
    )
      context.addIssue({
        code: 'custom',
        message: 'Own-sales amounts, transactions and units are inconsistent.',
      });
  });
export type MerchantSalesReport = z.infer<typeof merchantSalesReportSchema>;

const analyticsIdentity = z
  .object({
    productId: z.uuidv4(),
    productName: z.string().min(1),
    sku: z.string().nullable(),
    barcode: z.string().nullable(),
    merchantName: z.string().min(1),
  })
  .strict();
const staffDailyTrend = z
  .object({
    date: z.iso.date(),
    grossSales: amount,
    transactionCount: integer,
    unitsSold: integer,
    refundedAmount: amount,
    refundCount: integer,
    returnedUnits: integer,
    netRecordedSales: signedAmount,
  })
  .strict();
const staffTopProduct = analyticsIdentity
  .extend({
    grossSales: amount,
    unitsSold: integer,
    refundedAmount: amount,
    returnedUnits: integer,
    netRecordedSales: signedAmount,
  })
  .strict();
const staffTopMerchant = z
  .object({
    merchantId: z.uuidv4(),
    merchantName: z.string().min(1),
    grossSales: amount,
  })
  .strict();
const staffNetPaymentMethod = z
  .object({
    paymentMethod: z.enum(['CASH', 'GCASH', 'CARD']),
    netRecordedSales: signedAmount,
  })
  .strict();

function manilaDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return `${value('year').padStart(4, '0')}-${value('month')}-${value('day')}`;
}
function expectedTrendDays(from: string, until: string) {
  const first = Date.parse(`${manilaDay(new Date(from))}T00:00:00Z`);
  const last = Date.parse(
    `${manilaDay(new Date(Date.parse(until) - 1))}T00:00:00Z`,
  );
  return Array.from({ length: (last - first) / 86400000 + 1 }, (_, index) =>
    new Date(first + index * 86400000).toISOString().slice(0, 10),
  );
}
function analyticsValid(
  report: {
    from: string;
    until: string;
    grossSales: string;
    netRecordedSales?: string;
    transactionCount: string;
    unitsSold: string;
    refundedAmount: string;
    refundCount: string;
    returnedUnits: string;
    dailyTrends: z.infer<typeof staffDailyTrend>[];
    topProducts: z.infer<typeof staffTopProduct>[];
    topMerchants?: z.infer<typeof staffTopMerchant>[];
    netByPaymentMethod?: z.infer<typeof staffNetPaymentMethod>[];
    totalProducts: string;
  },
  context: z.RefinementCtx,
) {
  const days = expectedTrendDays(report.from, report.until);
  const sumMoney = (field: 'grossSales' | 'refundedAmount') =>
    report.dailyTrends.reduce(
      (sum, row) => sum + moneyCents(row[field]),
      BigInt(0),
    );
  const sumInteger = (
    field: 'transactionCount' | 'unitsSold' | 'refundCount' | 'returnedUnits',
  ) =>
    report.dailyTrends.reduce(
      (sum, row) => sum + BigInt(row[field]),
      BigInt(0),
    );
  const productIds = report.topProducts.map((row) => row.productId);
  const topMerchants: z.infer<typeof staffTopMerchant>[] = Array.isArray(
    report.topMerchants,
  )
    ? (report.topMerchants as z.infer<typeof staffTopMerchant>[])
    : [];
  const merchantIds = topMerchants.map((row) => row?.merchantId ?? '');
  const merchantRowsValid = topMerchants.every(
    (row) => staffTopMerchant.safeParse(row).success,
  );
  const merchantSalesValid =
    report.topMerchants === undefined ||
    (merchantRowsValid &&
      topMerchants.every((row, index) => {
        const previous = topMerchants[index - 1];
        return (
          moneyCents(row.grossSales) > BigInt(0) &&
          (!previous ||
            moneyCents(previous.grossSales) > moneyCents(row.grossSales) ||
            (previous.grossSales === row.grossSales &&
              previous.merchantId < row.merchantId))
        );
      }));
  const topMerchantGross = topMerchants.reduce((sum, row) => {
    const parsed = staffTopMerchant.safeParse(row);
    return (
      sum + (parsed.success ? moneyCents(parsed.data.grossSales) : BigInt(0))
    );
  }, BigInt(0));
  const netByPaymentMethod = Array.isArray(report.netByPaymentMethod)
    ? report.netByPaymentMethod
    : [];
  const netMethodRowsValid = netByPaymentMethod.every(
    (row) => staffNetPaymentMethod.safeParse(row).success,
  );
  const netMethodIds = netByPaymentMethod.map(
    (row) => row?.paymentMethod ?? '',
  );
  const netMethodTotal = netByPaymentMethod.reduce((sum, row) => {
    const parsed = staffNetPaymentMethod.safeParse(row);
    return (
      sum +
      (parsed.success
        ? BigInt(parsed.data.netRecordedSales.replace('.', ''))
        : BigInt(0))
    );
  }, BigInt(0));
  const reportNet = signedAmount.safeParse(report.netRecordedSales);
  const productsValid = report.topProducts.every((row, index) => {
    const previous = report.topProducts[index - 1];
    return (
      validRefunds(
        row.grossSales,
        row.refundedAmount,
        row.refundedAmount === '0.00' ? '0' : '1',
        row.returnedUnits,
        row.netRecordedSales,
      ) &&
      (row.grossSales === '0.00'
        ? row.unitsSold === '0'
        : BigInt(row.unitsSold) > BigInt(0)) &&
      (!previous ||
        moneyCents(report.topProducts[index - 1].grossSales) >
          moneyCents(row.grossSales) ||
        (report.topProducts[index - 1].grossSales === row.grossSales &&
          (BigInt(report.topProducts[index - 1].unitsSold) >
            BigInt(row.unitsSold) ||
            (report.topProducts[index - 1].unitsSold === row.unitsSold &&
              report.topProducts[index - 1].productId < row.productId))))
    );
  });
  if (
    days.length > 367 ||
    report.dailyTrends.length !== days.length ||
    report.dailyTrends.some(
      (row, index) =>
        row.date !== days[index] ||
        !validRefunds(
          row.grossSales,
          row.refundedAmount,
          row.refundCount,
          row.returnedUnits,
          row.netRecordedSales,
        ) ||
        (BigInt(row.transactionCount) === BigInt(0)
          ? row.grossSales !== '0.00' || row.unitsSold !== '0'
          : moneyCents(row.grossSales) <= BigInt(0) ||
            BigInt(row.unitsSold) < BigInt(row.transactionCount)),
    ) ||
    sumMoney('grossSales') !== moneyCents(report.grossSales) ||
    sumMoney('refundedAmount') !== moneyCents(report.refundedAmount) ||
    sumInteger('transactionCount') !== BigInt(report.transactionCount) ||
    sumInteger('unitsSold') !== BigInt(report.unitsSold) ||
    sumInteger('refundCount') !== BigInt(report.refundCount) ||
    sumInteger('returnedUnits') !== BigInt(report.returnedUnits) ||
    report.topProducts.length > 10 ||
    (BigInt(report.totalProducts) <= BigInt(10)
      ? BigInt(report.totalProducts) !== BigInt(report.topProducts.length)
      : report.topProducts.length !== 10) ||
    new Set(productIds).size !== productIds.length ||
    !productsValid ||
    (report.netByPaymentMethod !== undefined &&
      (!netMethodRowsValid ||
        new Set(netMethodIds).size !== 3 ||
        !reportNet.success ||
        netMethodTotal !==
          (reportNet.success
            ? BigInt(reportNet.data.replace('.', ''))
            : BigInt(0)))) ||
    (report.topMerchants !== undefined &&
      (topMerchants.length > 10 ||
        new Set(merchantIds).size !== merchantIds.length ||
        !merchantSalesValid ||
        (moneyCents(report.grossSales) === BigInt(0)
          ? topMerchants.length !== 0
          : topMerchants.length === 0) ||
        topMerchantGross > moneyCents(report.grossSales) ||
        (topMerchants.length < 10 &&
          topMerchantGross !== moneyCents(report.grossSales))))
  )
    context.addIssue({
      code: 'custom',
      message: 'Analytics trends, totals or rankings do not reconcile.',
    });
}

export const staffSalesAnalyticsSchema = z
  .object({
    scope: z.literal('STAFF'),
    branch: reportBranchSchema,
    from: utc,
    until: utc,
    grossSales: amount,
    transactionCount: integer,
    unitsSold: integer,
    payments: paymentSchema.array().length(3),
    refundedAmount: amount,
    refundCount: integer,
    returnedUnits: integer,
    netRecordedSales: signedAmount,
    refundMethods: refundMethodSchema.array().length(3),
    dailyTrends: staffDailyTrend.array().min(1).max(367),
    topProducts: staffTopProduct.array().max(10),
    totalProducts: integer,
    topMerchants: staffTopMerchant.array().max(10),
    netByPaymentMethod: staffNetPaymentMethod.array().length(3),
  })
  .strict()
  .superRefine((report, context) => {
    if (
      !staffSalesReportSchema.safeParse({
        scope: report.scope,
        branch: report.branch,
        from: report.from,
        until: report.until,
        grossSales: report.grossSales,
        transactionCount: report.transactionCount,
        unitsSold: report.unitsSold,
        payments: report.payments,
        refundedAmount: report.refundedAmount,
        refundCount: report.refundCount,
        returnedUnits: report.returnedUnits,
        netRecordedSales: report.netRecordedSales,
        refundMethods: report.refundMethods,
      }).success
    )
      context.addIssue({ code: 'custom', message: 'Invalid staff summary.' });
    analyticsValid(report, context);
  });
export type StaffSalesAnalytics = z.infer<typeof staffSalesAnalyticsSchema>;

const merchantDailyTrend = z
  .object({
    date: z.iso.date(),
    ownGrossSales: amount,
    ownTransactionCount: integer,
    ownUnitsSold: integer,
    ownRefundedAmount: amount,
    ownRefundCount: integer,
    ownReturnedUnits: integer,
    ownNetRecordedSales: signedAmount,
  })
  .strict();
const merchantTopProduct = analyticsIdentity
  .extend({
    ownGrossSales: amount,
    ownUnitsSold: integer,
    ownRefundedAmount: amount,
    ownReturnedUnits: integer,
    ownNetRecordedSales: signedAmount,
  })
  .strict();
export const merchantSalesAnalyticsSchema = z
  .object({
    scope: z.literal('MERCHANT'),
    branch: reportBranchSchema,
    from: utc,
    until: utc,
    ownGrossSales: amount,
    ownTransactionCount: integer,
    ownUnitsSold: integer,
    ownRefundedAmount: amount,
    ownRefundCount: integer,
    ownReturnedUnits: integer,
    ownNetRecordedSales: signedAmount,
    dailyTrends: merchantDailyTrend.array().min(1).max(367),
    topProducts: merchantTopProduct.array().max(10),
    totalProducts: integer,
  })
  .strict()
  .superRefine((report, context) => {
    if (
      !merchantSalesReportSchema.safeParse({
        scope: report.scope,
        branch: report.branch,
        from: report.from,
        until: report.until,
        ownGrossSales: report.ownGrossSales,
        ownTransactionCount: report.ownTransactionCount,
        ownUnitsSold: report.ownUnitsSold,
        ownRefundedAmount: report.ownRefundedAmount,
        ownRefundCount: report.ownRefundCount,
        ownReturnedUnits: report.ownReturnedUnits,
        ownNetRecordedSales: report.ownNetRecordedSales,
      }).success
    )
      context.addIssue({
        code: 'custom',
        message: 'Invalid merchant summary.',
      });
    analyticsValid(
      {
        from: report.from,
        until: report.until,
        grossSales: report.ownGrossSales,
        transactionCount: report.ownTransactionCount,
        unitsSold: report.ownUnitsSold,
        refundedAmount: report.ownRefundedAmount,
        refundCount: report.ownRefundCount,
        returnedUnits: report.ownReturnedUnits,
        dailyTrends: report.dailyTrends.map((row) => ({
          date: row.date,
          grossSales: row.ownGrossSales,
          transactionCount: row.ownTransactionCount,
          unitsSold: row.ownUnitsSold,
          refundedAmount: row.ownRefundedAmount,
          refundCount: row.ownRefundCount,
          returnedUnits: row.ownReturnedUnits,
          netRecordedSales: row.ownNetRecordedSales,
        })),
        topProducts: report.topProducts.map((row) => ({
          productId: row.productId,
          productName: row.productName,
          sku: row.sku,
          barcode: row.barcode,
          merchantName: row.merchantName,
          grossSales: row.ownGrossSales,
          unitsSold: row.ownUnitsSold,
          refundedAmount: row.ownRefundedAmount,
          returnedUnits: row.ownReturnedUnits,
          netRecordedSales: row.ownNetRecordedSales,
        })),
        totalProducts: report.totalProducts,
      },
      context,
    );
  });
export type MerchantSalesAnalytics = z.infer<
  typeof merchantSalesAnalyticsSchema
>;
