import { z } from 'zod';
import { paymentAccountSnapshot } from '@/features/pos/model/checkout';
import { salesQuerySchema } from '@/features/sales/model/sales.schemas';
import {
  salesDateRangeSchema,
  salesUtcRange,
} from '@/features/sales/model/sales-date-range';

const {
  q,
  paymentAccountId: accountQuery,
  from,
  until,
  page: pageQuery,
  limit,
} = salesQuerySchema.shape;
export const branchRefundQuerySchema = z
  .object({
    q,
    paymentAccountId: accountQuery,
    from,
    until,
    page: pageQuery,
    limit,
  })
  .strict()
  .refine(
    (value) =>
      !value.from ||
      !value.until ||
      new Date(value.from) < new Date(value.until),
    'From must precede until.',
  )
  .refine(
    (value) => Boolean(value.from) === Boolean(value.until),
    'Choose both date bounds.',
  )
  .refine(
    (value) =>
      !value.from?.startsWith('0000') && !value.until?.startsWith('0000'),
    'Use dates within supported years 0001 through 9999.',
  );

export const refundDateRangeSchema = salesDateRangeSchema.refine((dates) => {
  if (!salesDateRangeSchema.safeParse(dates).success) return false;
  const complete = {
    fromDay: dates.fromDay,
    throughDay: dates.throughDay || dates.fromDay,
  };
  return branchRefundQuerySchema.safeParse({
    page: 1,
    limit: 15,
    ...salesUtcRange(complete),
  }).success;
}, 'Choose a date range within supported years 0001 through 9999.');
export const branchRefundPageSchema = z
  .object({
    scope: z.literal('STAFF'),
    organizationId: z.uuidv4(),
    branchId: z.uuidv4(),
    page: z.number().int().min(1).max(21474836),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    totalPages: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    items: z
      .array(
        z
          .object({
            id: z.uuidv4(),
            saleId: z.uuidv4(),
            receiptCode: z.string().min(1),
            refundCode: z.string().min(1),
            completedAt: z.string().datetime(),
            ...paymentAccountSnapshot,
            total: z
              .string()
              .regex(/^(?:0|[1-9]\d{0,21})\.\d{2}$/)
              .refine(
                (value) =>
                  /^(?:0|[1-9]\d{0,21})\.\d{2}$/.test(value) &&
                  BigInt(value.replace('.', '')) > BigInt(0),
              ),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((page, context) => {
    if (
      page.totalPages !== Math.ceil(page.total / page.limit) ||
      page.items.length !==
        Math.max(
          0,
          Math.min(page.limit, page.total - (page.page - 1) * page.limit),
        ) ||
      new Set(page.items.map((row) => row.id)).size !== page.items.length
    )
      context.addIssue({
        code: 'custom',
        message: 'Refund pagination is inconsistent.',
      });
  });
export type BranchRefundPage = z.infer<typeof branchRefundPageSchema>;

export function refundLocation(params: URLSearchParams) {
  const page = Number(params.get('page') ?? 1);
  const salePage = Number(params.get('salePage') ?? 1);
  const range = refundDateRangeSchema.safeParse({
    fromDay: params.get('fromDay') ?? '',
    throughDay: params.get('throughDay') ?? '',
  });
  const dates =
    range.success && range.data.fromDay
      ? {
          fromDay: range.data.fromDay,
          throughDay: range.data.throughDay || range.data.fromDay,
        }
      : { fromDay: '', throughDay: '' };
  const account = z.uuidv4().safeParse(params.get('paymentAccountId'));
  const sale = z.uuidv4().safeParse(params.get('sale'));
  const refund = z.uuidv4().safeParse(params.get('refund'));
  return {
    query: branchRefundQuerySchema.parse({
      page: Number.isInteger(page) && page >= 1 && page <= 21474836 ? page : 1,
      limit: 15,
      q: (params.get('q') ?? '').trim().slice(0, 254) || undefined,
      paymentAccountId: account.success ? account.data : undefined,
      ...salesUtcRange(dates),
    }),
    dates,
    selecting: params.get('select') === '1',
    saleId: sale.success ? sale.data : undefined,
    refundId: sale.success && refund.success ? refund.data : undefined,
    saleQuery: {
      page:
        Number.isInteger(salePage) && salePage >= 1 && salePage <= 21474836
          ? salePage
          : 1,
      limit: 15,
      q: (params.get('saleQ') ?? '').trim().slice(0, 254) || undefined,
    },
  };
}
