import {
  formatCents,
  moneyCents,
  type CompletedSale,
  type PaymentMethod,
} from '@/features/pos/model/checkout';
import type { RemainingItem } from './refund.schemas';
export type RefundDraft = {
  lines: Record<string, { quantity: string; restock: string }>;
  reason: string;
  method: PaymentMethod;
  reference: string;
};
export function refundErrors(draft: RefundDraft, remaining: RemainingItem[]) {
  const errors: Record<string, string> = {};
  let selected = false;
  for (const item of remaining) {
    const line = draft.lines[item.saleItemId] ?? {
      quantity: '0',
      restock: '0',
    };
    const valid =
      /^\d+$/.test(line.quantity) &&
      Number(line.quantity) <= item.remainingQuantity;
    const restock = line.restock === '' ? '0' : line.restock;
    if (!valid)
      errors[`${item.saleItemId}:quantity`] =
        `Enter whole units from 0 to ${item.remainingQuantity}.`;
    if (valid && Number(line.quantity) > 0) selected = true;
    if (
      !/^\d+$/.test(restock) ||
      Number(restock) > Number(line.quantity) ||
      Number(restock) > 2147483647
    )
      errors[`${item.saleItemId}:restock`] =
        'Restock whole units from zero through the returned quantity.';
  }
  if (!selected) errors.items = 'Choose at least one whole item to return.';
  if (draft.reason.trim().length < 2 || draft.reason.trim().length > 500)
    errors.reason = '2–500 characters';
  if (
    draft.method !== 'CASH' &&
    (draft.reference.trim().length < 2 || draft.reference.trim().length > 100)
  )
    errors.reference = '2–100 characters';
  return errors;
}
export function refundEstimate(sale: CompletedSale, draft: RefundDraft) {
  return formatCents(
    sale.items.reduce((sum, item) => {
      const value = draft.lines[item.id]?.quantity ?? '0';
      return /^\d+$/.test(value) && Number(value) <= 2147483647
        ? sum + moneyCents(item.unitPrice) * BigInt(value)
        : sum;
    }, BigInt(0)),
  );
}
