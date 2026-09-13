import { z } from 'zod';
import { posCartTotal, quantityError } from './pos-cart';
import type { PosCartLine } from './pos.types';

export const money = z.string().regex(/^\d{1,22}\.\d{2}$/);
export const paymentMethod = z.enum(['CASH', 'GCASH', 'CARD']);
export type PaymentMethod = z.infer<typeof paymentMethod>;
export type PaymentDraft = {
  method: PaymentMethod;
  tender: string;
  reference: string;
  received: boolean;
};
export function moneyCents(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
}
export function formatCents(value: bigint) {
  return `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, '0')}`;
}
export function paymentError(
  draft: PaymentDraft,
  total: string,
): string | undefined {
  if (draft.method !== 'CASH') {
    const reference = draft.reference.trim();
    return reference.length < 2 || reference.length > 100
      ? 'Enter a reference containing 2–100 characters.'
      : undefined;
  }
  if (!/^\d{1,22}(?:\.\d{1,2})?$/.test(draft.tender.trim()))
    return 'Enter a PHP amount with at most 22 whole digits and two decimal places.';
  return moneyCents(draft.tender.trim()) < moneyCents(total)
    ? 'Cash tender must cover the total.'
    : undefined;
}
export function changeEstimate(draft: PaymentDraft, total: string) {
  return draft.method === 'CASH' && !paymentError(draft, total)
    ? formatCents(moneyCents(draft.tender.trim()) - moneyCents(total))
    : null;
}
export function checkoutContent(lines: PosCartLine[], draft: PaymentDraft) {
  if (
    !lines.length ||
    lines.length > 100 ||
    lines.some((line) =>
      quantityError(line.quantityInput, line.product.quantity),
    )
  )
    throw new Error('Fix cart quantities before checkout.');
  const error = paymentError(draft, posCartTotal(lines));
  if (error) throw new Error(error);
  if (!draft.received) throw new Error('Confirm that payment was received.');
  return {
    items: lines
      .map((line) => ({
        branchInventoryId: line.product.branchInventoryId,
        quantity: line.quantity,
        expectedUnitPrice: line.product.sellingPrice,
      }))
      .sort((a, b) => a.branchInventoryId.localeCompare(b.branchInventoryId)),
    paymentMethod: draft.method,
    ...(draft.method === 'CASH'
      ? { cashTender: formatCents(moneyCents(draft.tender.trim())) }
      : { paymentReference: draft.reference.trim() }),
  };
}
export type CheckoutCommand = ReturnType<typeof checkoutContent> & {
  requestId: string;
};
const receiptItem = z.object({
  id: z.string().uuid(),
  branchInventoryId: z.string().uuid(),
  productId: z.string().uuid(),
  merchantId: z.string().uuid(),
  productName: z.string().min(1),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  merchantName: z.string().min(1),
  quantity: z.number().int().min(1).max(2147483647),
  unitPrice: money,
  lineTotal: money,
});
export const completedSaleSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    branchId: z.string().uuid(),
    receiptCode: z.string().min(1),
    completedAt: z.string().datetime(),
    organizationName: z.string().min(1),
    branchName: z.string().min(1),
    branchCode: z.string().nullable(),
    cashierName: z.string().min(1),
    paymentMethod,
    paymentReference: z.string().nullable(),
    total: money,
    cashTender: money.nullable(),
    cashChange: money.nullable(),
    items: z.array(receiptItem).min(1).max(100),
  })
  .superRefine((sale, ctx) => {
    // Regex failures are non-aborting Zod issues: do not parse invalid strings.
    if (
      [
        sale.total,
        sale.cashTender,
        sale.cashChange,
        ...sale.items.flatMap((item) => [item.unitPrice, item.lineTotal]),
      ].some((value) => value !== null && !money.safeParse(value).success)
    )
      return;
    const fail = () =>
      ctx.addIssue({
        code: 'custom',
        message: 'Receipt amounts are inconsistent.',
      });
    if (
      moneyCents(sale.total) <= BigInt(0) ||
      new Set(sale.items.map((item) => item.branchInventoryId)).size !==
        sale.items.length
    )
      fail();
    if (
      sale.items.some(
        (item) =>
          moneyCents(item.unitPrice) <= BigInt(0) ||
          moneyCents(item.lineTotal) !==
            moneyCents(item.unitPrice) * BigInt(item.quantity),
      )
    )
      fail();
    if (
      sale.items.reduce(
        (sum, item) => sum + moneyCents(item.lineTotal),
        BigInt(0),
      ) !== moneyCents(sale.total)
    )
      fail();
    if (sale.paymentMethod === 'CASH') {
      if (
        sale.cashTender === null ||
        sale.cashChange === null ||
        sale.paymentReference !== null ||
        moneyCents(sale.cashTender) < moneyCents(sale.total) ||
        moneyCents(sale.cashTender) - moneyCents(sale.total) !==
          moneyCents(sale.cashChange)
      )
        fail();
    } else if (
      sale.cashTender !== null ||
      sale.cashChange !== null ||
      !sale.paymentReference ||
      sale.paymentReference.trim().length < 2 ||
      sale.paymentReference.length > 100
    )
      fail();
  });
export type CompletedSale = z.infer<typeof completedSaleSchema>;
