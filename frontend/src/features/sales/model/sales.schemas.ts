import { z } from 'zod';
import {
  completedSaleSchema,
  money,
  moneyCents,
} from '@/features/pos/model/checkout';

const uuid = z.string().uuid();
const ownItem = z
  .object({
    id: uuid,
    productId: uuid,
    productName: z.string().min(1),
    sku: z.string().nullable(),
    barcode: z.string().nullable(),
    merchantName: z.string().min(1),
    quantity: z.number().int().min(1).max(2147483647),
    unitPrice: money,
    lineTotal: money,
  })
  .strict();
export const merchantSaleSchema = z
  .object({
    id: uuid,
    receiptCode: z.string().min(1),
    completedAt: z.string().datetime(),
    branchId: uuid,
    branchName: z.string().min(1),
    branchCode: z.string().nullable(),
    items: z.array(ownItem).min(1).max(100),
    ownItemsSubtotal: money,
  })
  .strict()
  .superRefine((sale, ctx) => {
    const amounts = [
      sale.ownItemsSubtotal,
      ...sale.items.flatMap((item) => [item.unitPrice, item.lineTotal]),
    ];
    if (amounts.some((value) => !money.safeParse(value).success)) return;
    if (
      new Set(sale.items.map((item) => item.id)).size !== sale.items.length ||
      sale.items.some(
        (item) =>
          moneyCents(item.unitPrice) <= BigInt(0) ||
          moneyCents(item.lineTotal) !==
            moneyCents(item.unitPrice) * BigInt(item.quantity),
      ) ||
      sale.items.reduce(
        (sum, item) => sum + moneyCents(item.lineTotal),
        BigInt(0),
      ) !== moneyCents(sale.ownItemsSubtotal)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Own-items amounts are inconsistent.',
      });
  });
function pageSchema<T extends z.ZodType>(item: T) {
  return z
    .object({
      items: z.array(item).max(100),
      page: z.number().int().min(1).max(21474836),
      limit: z.number().int().min(1).max(100),
      total: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      totalPages: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    })
    .superRefine((page, ctx) => {
      if (
        page.items.length > page.limit ||
        page.totalPages !== Math.ceil(page.total / page.limit) ||
        page.items.length !==
          Math.max(
            0,
            Math.min(page.limit, page.total - (page.page - 1) * page.limit),
          )
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Sales pagination is inconsistent.',
        });
    });
}
export const staffSalesPageSchema = pageSchema(completedSaleSchema);
export const merchantSalesPageSchema = pageSchema(merchantSaleSchema);
export const sellingBranchesSchema = z
  .array(
    z
      .object({
        id: uuid,
        name: z.string().min(1),
        code: z.string().nullable(),
      })
      .strict(),
  )
  .refine(
    (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
    'Selling branches must be distinct.',
  );
const utc = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
    'Use a UTC timestamp ending in Z.',
  )
  .datetime({ precision: null });
export const salesQuerySchema = z
  .object({
    from: utc.optional(),
    until: utc.optional(),
    page: z.number().int().min(1).max(21474836),
    limit: z.number().int().min(1).max(100),
  })
  .strict()
  .refine(
    (query) =>
      !query.from ||
      !query.until ||
      new Date(query.from) < new Date(query.until),
    { message: 'From must precede until.', path: ['until'] },
  );
export type SalesQuery = z.infer<typeof salesQuerySchema>;
export type MerchantSale = z.infer<typeof merchantSaleSchema>;
