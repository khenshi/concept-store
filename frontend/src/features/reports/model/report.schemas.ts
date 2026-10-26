import { z } from 'zod';
import {
  moneyCents,
  paymentAccountSnapshot,
} from '@/features/pos/model/checkout';

const amount = z.string().regex(/^(?:0|[1-9]\d*)\.\d{2}$/);
const integer = z.string().regex(/^(?:0|[1-9]\d*)$/);
const signedAmount = z.string().regex(/^(?!-0\.00$)-?(?:0|[1-9]\d*)\.\d{2}$/);
export const reportPaymentAccountSchema = z
  .object({
    accountId: z.uuidv4(),
    displayName: z.string().trim().min(1).max(100),
    enabled: z.boolean(),
    available: z.boolean(),
    isCash: z.boolean(),
    received: amount,
    refunded: amount,
    netReceived: signedAmount,
    transactionCount: integer,
    refundCount: integer,
  })
  .strict()
  .superRefine((row, context) => {
    if (
      ![row.received, row.refunded].every(
        (value) => amount.safeParse(value).success,
      ) ||
      !signedAmount.safeParse(row.netReceived).success ||
      ![row.transactionCount, row.refundCount].every(
        (value) => integer.safeParse(value).success,
      )
    )
      return;
    if (
      BigInt(row.netReceived.replace('.', '')) !==
        moneyCents(row.received) - moneyCents(row.refunded) ||
      (BigInt(row.transactionCount) === BigInt(0)) !==
        (moneyCents(row.received) === BigInt(0)) ||
      (BigInt(row.refundCount) === BigInt(0)) !==
        (moneyCents(row.refunded) === BigInt(0)) ||
      (row.available && !row.enabled) ||
      (row.isCash && (!row.available || !row.enabled))
    )
      context.addIssue({
        code: 'custom',
        message: 'Payment account flows do not reconcile.',
      });
  });
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
    return (
      length > 0 &&
      Date.parse(range.from) >= Date.parse('1899-12-31T16:00:00.000Z') &&
      Date.parse(range.until) <= Date.parse('9999-12-30T16:00:00.000Z')
    );
  }, 'Choose a valid UTC report period within the supported historical range.');
export const reportRankingSortSchema = z.enum(['GROSS_SALES', 'UNITS_SOLD']);
export const reportRankingQuerySchema = reportQuerySchema.extend({
  page: z.number().int().min(1).max(21474836),
  sortBy: reportRankingSortSchema.default('GROSS_SALES'),
  merchantId: z.uuidv4().optional(),
});
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
export const staffSalesReportSchema = z
  .object({
    scope: z.literal('STAFF'),
    branch: reportBranchSchema,
    from: utc,
    until: utc,
    grossSales: amount,
    transactionCount: integer,
    unitsSold: integer,
    paymentAccounts: reportPaymentAccountSchema.array(),
    refundedAmount: amount,
    refundCount: integer,
    returnedUnits: integer,
    netRecordedSales: signedAmount,
  })
  .strict()
  .superRefine((report, context) => {
    if (
      !reportQuerySchema.safeParse({ from: report.from, until: report.until })
        .success
    )
      context.addIssue({ code: 'custom', message: 'Invalid report range.' });
    if (
      ![report.grossSales, report.refundedAmount].every(
        (value) => amount.safeParse(value).success,
      ) ||
      !signedAmount.safeParse(report.netRecordedSales).success ||
      ![
        report.transactionCount,
        report.unitsSold,
        report.refundCount,
        report.returnedUnits,
      ].every((value) => integer.safeParse(value).success) ||
      report.paymentAccounts.some(
        (row) => !reportPaymentAccountSchema.safeParse(row).success,
      )
    )
      return;
    const sum = (field: 'received' | 'refunded' | 'netReceived') =>
      report.paymentAccounts.reduce(
        (total, row) => total + BigInt(row[field].replace('.', '')),
        BigInt(0),
      );
    const count = (field: 'transactionCount' | 'refundCount') =>
      report.paymentAccounts.reduce(
        (total, row) => total + BigInt(row[field]),
        BigInt(0),
      );
    if (
      !validRefunds(
        report.grossSales,
        report.refundedAmount,
        report.refundCount,
        report.returnedUnits,
        report.netRecordedSales,
      ) ||
      new Set(report.paymentAccounts.map((row) => row.accountId)).size !==
        report.paymentAccounts.length ||
      sum('received') !== moneyCents(report.grossSales) ||
      sum('refunded') !== moneyCents(report.refundedAmount) ||
      sum('netReceived') !== BigInt(report.netRecordedSales.replace('.', '')) ||
      count('transactionCount') !== BigInt(report.transactionCount) ||
      count('refundCount') !== BigInt(report.refundCount) ||
      (BigInt(report.transactionCount) === BigInt(0)
        ? report.grossSales !== '0.00' || report.unitsSold !== '0'
        : moneyCents(report.grossSales) <= BigInt(0) ||
          BigInt(report.unitsSold) < BigInt(report.transactionCount))
    )
      context.addIssue({
        code: 'custom',
        message: 'Sales report totals and account flows do not reconcile.',
      });
  });
export type ReportBranch = z.infer<typeof reportBranchSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ReportRankingSort = z.infer<typeof reportRankingSortSchema>;
export type ReportRankingQuery = z.input<typeof reportRankingQuerySchema>;
export type ReportMerchantOption = { id: string; name: string };
export type ReportRankingControls = {
  sortBy: ReportRankingSort;
  merchantId: string | null;
};
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

export const reportTransactionTypeSchema = z.enum(['SALE', 'REFUND']);
export const reportTransactionQuerySchema = reportQuerySchema
  .extend({
    page: z.number().int().min(1).max(21474836),
    limit: z.number().int().min(1).max(100),
    type: reportTransactionTypeSchema.optional(),
    q: z.string().max(254).optional(),
  })
  .strict();
const transactionBase = z
  .object({
    id: z.uuidv4(),
    saleId: z.uuidv4(),
    refundId: z.uuidv4().nullable(),
    completedAt: utc,
    reference: z.string().min(1),
    amount,
  })
  .strict();
const staffSaleTransaction = transactionBase
  .extend({
    type: z.literal('SALE'),
    refundId: z.null(),
    ...paymentAccountSnapshot,
    actorName: z.string().min(1),
    merchantNames: z.string().min(1).array(),
  })
  .strict();
const staffRefundTransaction = transactionBase
  .extend({
    type: z.literal('REFUND'),
    refundId: z.uuidv4(),
    ...paymentAccountSnapshot,
    actorName: z.string().min(1),
    merchantNames: z.string().min(1).array(),
  })
  .strict();
const merchantSaleTransaction = transactionBase
  .extend({ type: z.literal('SALE'), refundId: z.null() })
  .strict();
const merchantRefundTransaction = transactionBase
  .extend({ type: z.literal('REFUND'), refundId: z.uuidv4() })
  .strict();
const transactionPageBase = z
  .object({
    branch: reportBranchSchema,
    from: utc,
    until: utc,
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .strict();
export const staffTransactionsPageSchema = transactionPageBase
  .extend({
    scope: z.literal('STAFF'),
    items: z
      .discriminatedUnion('type', [
        staffSaleTransaction,
        staffRefundTransaction,
      ])
      .array(),
  })
  .strict();
export const merchantTransactionsPageSchema = transactionPageBase
  .extend({
    scope: z.literal('MERCHANT'),
    items: z
      .discriminatedUnion('type', [
        merchantSaleTransaction,
        merchantRefundTransaction,
      ])
      .array(),
  })
  .strict();
export type ReportTransactionType = z.infer<typeof reportTransactionTypeSchema>;
export type ReportTransactionQuery = z.input<
  typeof reportTransactionQuerySchema
>;
export type StaffTransactionsPage = z.infer<typeof staffTransactionsPageSchema>;
export type MerchantTransactionsPage = z.infer<
  typeof merchantTransactionsPageSchema
>;
export type ReportTransaction =
  | StaffTransactionsPage['items'][number]
  | MerchantTransactionsPage['items'][number];

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
const staffHourlyTrend = z
  .object({
    hour: z.number().int().min(0).max(23),
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
const reportGranularitySchema = z.enum(['DAY', 'MONTH', 'YEAR']);
type ReportGranularity = z.infer<typeof reportGranularitySchema>;

function expectedGranularity(from: string, until: string): ReportGranularity {
  if (Date.parse(until) - Date.parse(from) <= 366 * 86400000) return 'DAY';
  const start = new Date(from);
  const anniversary = new Date(from);
  anniversary.setUTCFullYear(start.getUTCFullYear() + 5);
  if (anniversary.getUTCMonth() !== start.getUTCMonth())
    anniversary.setUTCDate(0);
  return Date.parse(until) > anniversary.getTime() ? 'YEAR' : 'MONTH';
}

function expectedTrendDays(
  from: string,
  until: string,
  granularity: ReportGranularity = 'DAY',
  offset = 0,
  limit = 367,
) {
  const first = Date.parse(`${manilaDay(new Date(from))}T00:00:00Z`);
  const last = Date.parse(
    `${manilaDay(new Date(Date.parse(until) - 1))}T00:00:00Z`,
  );
  if (granularity === 'DAY')
    return Array.from(
      {
        length: Math.max(
          0,
          Math.min((last - first) / 86400000 + 1 - offset, limit),
        ),
      },
      (_, index) =>
        new Date(first + (offset + index) * 86400000)
          .toISOString()
          .slice(0, 10),
    );
  const start = new Date(first);
  const end = new Date(last);
  const firstYear = start.getUTCFullYear();
  const lastYear = end.getUTCFullYear();
  if (granularity === 'YEAR')
    return Array.from(
      { length: lastYear - firstYear + 1 },
      (_, index) => `${String(firstYear + index).padStart(4, '0')}-01-01`,
    );
  const firstMonth = firstYear * 12 + start.getUTCMonth();
  const lastMonth = lastYear * 12 + end.getUTCMonth();
  return Array.from(
    { length: lastMonth - firstMonth + 1 },
    (_, index) =>
      `${String(Math.floor((firstMonth + index) / 12)).padStart(4, '0')}-${String(((firstMonth + index) % 12) + 1).padStart(2, '0')}-01`,
  );
}
function analyticsValid(
  report: {
    from: string;
    until: string;
    granularity?: ReportGranularity;
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
    hourlyTrends?: z.infer<typeof staffHourlyTrend>[];
    totalProducts: string;
  },
  context: z.RefinementCtx,
) {
  if (
    !reportQuerySchema.safeParse({ from: report.from, until: report.until })
      .success
  ) {
    context.addIssue({ code: 'custom', message: 'Invalid analytics range.' });
    return;
  }
  const granularity = expectedGranularity(report.from, report.until);
  const days = expectedTrendDays(report.from, report.until, granularity);
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
  const reportNet = signedAmount.safeParse(report.netRecordedSales);
  const reportNetCents = reportNet.success
    ? BigInt(reportNet.data.replace('.', ''))
    : null;
  const hourlyTrends = report.hourlyTrends;
  const hourlyData = hourlyTrends?.every(
    (row) => staffHourlyTrend.safeParse(row).success,
  )
    ? hourlyTrends
    : [];
  const hourlyGross = hourlyData.reduce(
    (sum, row) => sum + moneyCents(row.grossSales),
    BigInt(0),
  );
  const hourlyRefunded = hourlyData.reduce(
    (sum, row) => sum + moneyCents(row.refundedAmount),
    BigInt(0),
  );
  const hourlyTransactions = hourlyData.reduce(
    (sum, row) => sum + BigInt(row.transactionCount),
    BigInt(0),
  );
  const hourlyUnits = hourlyData.reduce(
    (sum, row) => sum + BigInt(row.unitsSold),
    BigInt(0),
  );
  const hourlyRefunds = hourlyData.reduce(
    (sum, row) => sum + BigInt(row.refundCount),
    BigInt(0),
  );
  const hourlyReturned = hourlyData.reduce(
    (sum, row) => sum + BigInt(row.returnedUnits),
    BigInt(0),
  );
  const hourlyNet = hourlyData.reduce(
    (sum, row) => sum + BigInt(row.netRecordedSales.replace('.', '')),
    BigInt(0),
  );
  const hourlyRowsValid =
    hourlyTrends === undefined ||
    (hourlyData.length === 24 &&
      hourlyTrends.every(
        (row, index) =>
          row.hour === index &&
          validRefunds(
            row.grossSales,
            row.refundedAmount,
            row.refundCount,
            row.returnedUnits,
            row.netRecordedSales,
          ) &&
          (BigInt(row.transactionCount) === BigInt(0)
            ? row.grossSales === '0.00' && row.unitsSold === '0'
            : moneyCents(row.grossSales) > BigInt(0) &&
              BigInt(row.unitsSold) >= BigInt(row.transactionCount)),
      ) &&
      hourlyGross === moneyCents(report.grossSales) &&
      hourlyRefunded === moneyCents(report.refundedAmount) &&
      hourlyTransactions === BigInt(report.transactionCount) &&
      hourlyUnits === BigInt(report.unitsSold) &&
      hourlyRefunds === BigInt(report.refundCount) &&
      hourlyReturned === BigInt(report.returnedUnits) &&
      reportNetCents !== null &&
      hourlyNet === reportNetCents);
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
    (report.granularity ?? 'DAY') !== granularity ||
    (granularity !== 'DAY' && report.hourlyTrends !== undefined) ||
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
    !hourlyRowsValid ||
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
    paymentAccounts: reportPaymentAccountSchema.array(),
    refundedAmount: amount,
    refundCount: integer,
    returnedUnits: integer,
    netRecordedSales: signedAmount,
    granularity: reportGranularitySchema.optional(),
    dailyTrends: staffDailyTrend.array().min(1).max(8100),
    topProducts: staffTopProduct.array().max(15),
    totalProducts: integer,
    topMerchants: staffTopMerchant.array().max(10),
    hourlyTrends: staffHourlyTrend.array().length(24).optional(),
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
        paymentAccounts: report.paymentAccounts,
        refundedAmount: report.refundedAmount,
        refundCount: report.refundCount,
        returnedUnits: report.returnedUnits,
        netRecordedSales: report.netRecordedSales,
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
const rankingPageBase = z
  .object({
    branch: reportBranchSchema,
    from: utc,
    until: utc,
    sortBy: reportRankingSortSchema,
    merchantId: z.uuidv4().nullable(),
    page: z.number().int().min(1),
    limit: z.literal(15),
    totalProducts: integer,
    totalPages: z.number().int().nonnegative().optional(),
    hasNext: z.boolean(),
  })
  .strict();
export const staffSalesRankingPageSchema = rankingPageBase
  .extend({
    scope: z.literal('STAFF'),
    items: staffTopProduct.array().max(15),
  })
  .strict();
export const merchantSalesRankingPageSchema = rankingPageBase
  .extend({
    scope: z.literal('MERCHANT'),
    items: merchantTopProduct.array().max(15),
  })
  .strict();
export type StaffSalesRankingPage = z.infer<typeof staffSalesRankingPageSchema>;
export type MerchantSalesRankingPage = z.infer<
  typeof merchantSalesRankingPageSchema
>;
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
    granularity: reportGranularitySchema.optional(),
    dailyTrends: merchantDailyTrend.array().min(1).max(8100),
    topProducts: merchantTopProduct.array().max(15),
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
        granularity: report.granularity,
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

export const reportDailyQuerySchema = reportQuerySchema.extend({
  page: z.number().int().min(1).max(21474836).default(1),
  limit: z.number().int().min(1).max(100).default(15),
});
export type ReportDailyQuery = z.input<typeof reportDailyQuerySchema>;

function dailyPageValid(
  page: z.infer<typeof transactionPageBase> & {
    items: z.infer<typeof staffDailyTrend>[];
  },
  context: z.RefinementCtx,
) {
  if (
    !reportQuerySchema.safeParse({ from: page.from, until: page.until }).success
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Invalid daily report range.',
    });
    return;
  }
  const first = Date.parse(`${manilaDay(new Date(page.from))}T00:00:00Z`);
  const last = Date.parse(
    `${manilaDay(new Date(Date.parse(page.until) - 1))}T00:00:00Z`,
  );
  const total = (last - first) / 86400000 + 1;
  const dates = expectedTrendDays(
    page.from,
    page.until,
    'DAY',
    (page.page - 1) * page.limit,
    page.limit,
  );
  if (
    page.total !== total ||
    page.totalPages !== Math.ceil(total / page.limit) ||
    page.items.length !== dates.length ||
    page.items.some(
      (row, index) =>
        row.date !== dates[index] ||
        !staffDailyTrend.safeParse(row).success ||
        !validRefunds(
          row.grossSales,
          row.refundedAmount,
          row.refundCount,
          row.returnedUnits,
          row.netRecordedSales,
        ) ||
        (row.transactionCount === '0'
          ? row.grossSales !== '0.00' || row.unitsSold !== '0'
          : moneyCents(row.grossSales) <= BigInt(0) ||
            BigInt(row.unitsSold) < BigInt(row.transactionCount)),
    )
  )
    context.addIssue({
      code: 'custom',
      message: 'Daily report rows and pagination do not reconcile.',
    });
}

export const staffDailyReportPageSchema = transactionPageBase
  .extend({
    scope: z.literal('STAFF'),
    items: staffDailyTrend.array().max(100),
  })
  .strict()
  .superRefine(dailyPageValid);

export const merchantDailyReportPageSchema = transactionPageBase
  .extend({
    scope: z.literal('MERCHANT'),
    items: merchantDailyTrend.array().max(100),
  })
  .strict()
  .superRefine((page, context) =>
    dailyPageValid(
      {
        ...page,
        items: page.items.map((row) => ({
          date: row.date,
          grossSales: row.ownGrossSales,
          transactionCount: row.ownTransactionCount,
          unitsSold: row.ownUnitsSold,
          refundedAmount: row.ownRefundedAmount,
          refundCount: row.ownRefundCount,
          returnedUnits: row.ownReturnedUnits,
          netRecordedSales: row.ownNetRecordedSales,
        })),
      },
      context,
    ),
  );

export type StaffDailyReportPage = z.infer<typeof staffDailyReportPageSchema>;
export type MerchantDailyReportPage = z.infer<
  typeof merchantDailyReportPageSchema
>;
