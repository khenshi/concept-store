import { z } from 'zod';
import { moneyCents } from '@/features/pos/model/checkout';

const amount = z.string().regex(/^(?:0|[1-9]\d*)\.\d{2}$/);
const integer = z.string().regex(/^(?:0|[1-9]\d*)$/);
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
  })
  .strict()
  .superRefine((report, context) => {
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
  })
  .strict()
  .superRefine((report, context) => {
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
