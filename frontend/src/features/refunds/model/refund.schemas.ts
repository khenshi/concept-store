import { z } from 'zod';
import { moneyCents, paymentMethod } from '@/features/pos/model/checkout';
const uuid = z.uuidv4();
const money = z.string().regex(/^(?:0|[1-9]\d{0,21})\.\d{2}$/);
const unitPrice = z.string().regex(/^(?:0|[1-9]\d{0,9})\.\d{2}$/);
const lineAmount = z.string().regex(/^(?:0|[1-9]\d{0,19})\.\d{2}$/);
const quantity = z.number().int().min(1).max(2147483647);
const zeroQuantity = z.number().int().min(0).max(2147483647);
const identity = {
  id: uuid,
  saleItemId: uuid,
  productId: uuid,
  productName: z.string().min(1),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  merchantName: z.string().min(1),
  quantity,
  restockQuantity: zeroQuantity,
  unitPrice,
  lineTotal: lineAmount,
};
const ownItem = z.object(identity).strict();
const staffItem = z
  .object({ ...identity, branchInventoryId: uuid, merchantId: uuid })
  .strict();
const common = {
  id: uuid,
  saleId: uuid,
  branchId: uuid,
  receiptCode: z.string().min(1),
  refundCode: z.string().min(1),
  completedAt: z.string().datetime(),
};
function reconcile(
  items: z.infer<typeof ownItem>[],
  total: string,
  context: z.RefinementCtx,
) {
  if (
    !money.safeParse(total).success ||
    items.some(
      (item) =>
        !money.safeParse(item.unitPrice).success ||
        !money.safeParse(item.lineTotal).success ||
        !quantity.safeParse(item.quantity).success,
    )
  )
    return;
  if (
    new Set(items.map((item) => item.saleItemId)).size !== items.length ||
    new Set(items.map((item) => item.id)).size !== items.length ||
    moneyCents(total) <= BigInt(0) ||
    items.some(
      (item) =>
        item.restockQuantity > item.quantity ||
        moneyCents(item.unitPrice) <= BigInt(0) ||
        moneyCents(item.lineTotal) !==
          moneyCents(item.unitPrice) * BigInt(item.quantity),
    ) ||
    items.reduce((sum, item) => sum + moneyCents(item.lineTotal), BigInt(0)) !==
      moneyCents(total)
  )
    context.addIssue({
      code: 'custom',
      message: 'Refund quantities and amounts do not reconcile.',
    });
}
export const staffRefundSchema = z
  .object({
    ...common,
    scope: z.literal('STAFF'),
    organizationId: uuid,
    reason: z.string().trim().min(2).max(500),
    paymentMethod,
    paymentReference: z.string().nullable(),
    total: money,
    items: staffItem.array().min(1).max(100),
  })
  .strict()
  .superRefine((refund, context) => {
    reconcile(refund.items, refund.total, context);
    if (
      refund.paymentMethod === 'CASH'
        ? refund.paymentReference !== null
        : !refund.paymentReference ||
          refund.paymentReference !== refund.paymentReference.trim() ||
          refund.paymentReference.length < 2 ||
          refund.paymentReference.length > 100
    )
      context.addIssue({
        code: 'custom',
        message: 'Refund payment fields are inconsistent.',
      });
  });
export const merchantRefundSchema = z
  .object({
    ...common,
    scope: z.literal('MERCHANT'),
    branchName: z.string().min(1),
    branchCode: z.string().nullable(),
    ownItemsSubtotal: money,
    items: ownItem.array().min(1).max(100),
  })
  .strict()
  .superRefine((refund, context) =>
    reconcile(refund.items, refund.ownItemsSubtotal, context),
  );
export const remainingItemSchema = z
  .object({
    saleItemId: uuid,
    soldQuantity: quantity,
    returnedQuantity: zeroQuantity,
    restockedQuantity: zeroQuantity,
    remainingQuantity: zeroQuantity,
  })
  .strict()
  .refine(
    (item) =>
      item.returnedQuantity <= item.soldQuantity &&
      item.restockedQuantity <= item.returnedQuantity &&
      item.remainingQuantity === item.soldQuantity - item.returnedQuantity,
    'Remaining quantities do not reconcile.',
  );
export const refundQuerySchema = z
  .object({
    page: z.number().int().min(1).max(21474836),
    limit: z.number().int().min(1).max(100),
  })
  .strict();
function page<S extends 'STAFF' | 'MERCHANT', T extends z.ZodType>(
  scope: S,
  item: T,
) {
  return z
    .object({
      scope: z.literal(scope),
      ...refundQuerySchema.shape,
      total: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      totalPages: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      items: item.array().max(100),
      remainingItems: remainingItemSchema.array().min(1).max(100),
    })
    .strict()
    .superRefine((result, context) => {
      if (
        result.totalPages !== Math.ceil(result.total / result.limit) ||
        result.items.length !==
          Math.max(
            0,
            Math.min(
              result.limit,
              result.total - (result.page - 1) * result.limit,
            ),
          ) ||
        new Set(result.remainingItems.map((item) => item.saleItemId)).size !==
          result.remainingItems.length
      )
        context.addIssue({
          code: 'custom',
          message: 'Refund pagination is inconsistent.',
        });
    });
}
export const staffRefundPageSchema = page('STAFF', staffRefundSchema);
export const merchantRefundPageSchema = page('MERCHANT', merchantRefundSchema);
export const refundCommandSchema = z
  .object({
    requestId: uuid,
    reason: z.string().trim().min(2).max(500),
    paymentMethod,
    paymentReference: z.string().trim().min(2).max(100).optional(),
    refundConfirmed: z.literal(true),
    items: z
      .object({ saleItemId: uuid, quantity, restockQuantity: zeroQuantity })
      .strict()
      .array()
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (command) =>
      new Set(command.items.map((item) => item.saleItemId)).size ===
        command.items.length &&
      command.items.every((item) => item.restockQuantity <= item.quantity) &&
      (command.paymentMethod === 'CASH'
        ? command.paymentReference === undefined
        : command.paymentReference !== undefined),
    'Review refund lines and payment fields.',
  );
export type RefundCommand = z.infer<typeof refundCommandSchema>;
export type StaffRefund = z.infer<typeof staffRefundSchema>;
export type MerchantRefund = z.infer<typeof merchantRefundSchema>;
export type RemainingItem = z.infer<typeof remainingItemSchema>;
