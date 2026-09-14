import type {
  AuthenticatedRequest,
  OrganizationRole,
} from '@/features/organizations/model/organization.types';
import type { PosScope } from '@/features/pos/model/pos.types';
import type { CompletedSale } from '@/features/pos/model/checkout';
import type { MerchantSale } from '@/features/sales/model/sales.schemas';
import {
  refundCommandSchema,
  refundQuerySchema,
  staffRefundSchema,
  merchantRefundSchema,
  staffRefundPageSchema,
  merchantRefundPageSchema,
  type RefundCommand,
  type StaffRefund,
  type MerchantRefund,
} from '../model/refund.schemas';
export type RefundScope = PosScope & { saleId: string };
const path = (scope: RefundScope) =>
  `/organizations/${encodeURIComponent(scope.organizationId)}/branches/${encodeURIComponent(scope.branchId)}/sales/${encodeURIComponent(scope.saleId)}/refunds`;
function checkScope(refund: StaffRefund | MerchantRefund, scope: RefundScope) {
  if (
    refund.branchId !== scope.branchId ||
    refund.saleId !== scope.saleId ||
    ('organizationId' in refund &&
      refund.organizationId !== scope.organizationId)
  )
    throw new Error('Refund response scope is inconsistent.');
}
export function checkOriginal(
  refund: StaffRefund | MerchantRefund,
  sale: CompletedSale | MerchantSale,
) {
  if (refund.receiptCode !== sale.receiptCode)
    throw new Error('Refund receipt does not match the original sale.');
  for (const item of refund.items) {
    const original = sale.items.find((line) => line.id === item.saleItemId);
    if (
      !original ||
      item.quantity > original.quantity ||
      item.productId !== original.productId ||
      item.productName !== original.productName ||
      item.sku !== original.sku ||
      item.barcode !== original.barcode ||
      item.merchantName !== original.merchantName ||
      item.unitPrice !== original.unitPrice ||
      ('branchInventoryId' in item &&
        'branchInventoryId' in original &&
        'merchantId' in original &&
        (item.branchInventoryId !== original.branchInventoryId ||
          item.merchantId !== original.merchantId))
    )
      throw new Error('Refund items do not match the original saved sale.');
  }
}
export async function listRefunds(
  request: AuthenticatedRequest,
  scope: RefundScope,
  role: OrganizationRole,
  sale: CompletedSale | MerchantSale,
  input = { page: 1, limit: 10 },
) {
  if (role === 'CASHIER') throw new Error('Cashiers cannot access refunds.');
  const query = refundQuerySchema.parse(input);
  const raw = await request<unknown>(
    `${path(scope)}?${new URLSearchParams({ page: String(query.page), limit: String(query.limit) })}`,
  );
  const result =
    role === 'MERCHANT'
      ? merchantRefundPageSchema.parse(raw)
      : staffRefundPageSchema.parse(raw);
  if (
    result.page !== query.page ||
    result.limit !== query.limit ||
    new Set(result.items.map((row) => row.id)).size !== result.items.length ||
    result.remainingItems.length !== sale.items.length ||
    result.remainingItems.some(
      (line) =>
        sale.items.find((original) => original.id === line.saleItemId)
          ?.quantity !== line.soldQuantity,
    )
  )
    throw new Error('Refund history scope or quantities are inconsistent.');
  for (const row of result.items) {
    checkScope(row, scope);
    checkOriginal(row, sale);
  }
  return result;
}
export async function getRefund(
  request: AuthenticatedRequest,
  scope: RefundScope,
  role: OrganizationRole,
  sale: CompletedSale | MerchantSale,
  refundId: string,
) {
  if (role === 'CASHIER') throw new Error('Cashiers cannot access refunds.');
  const raw = await request<unknown>(
    `${path(scope)}/${encodeURIComponent(refundId)}`,
  );
  const result =
    role === 'MERCHANT'
      ? merchantRefundSchema.parse(raw)
      : staffRefundSchema.parse(raw);
  checkScope(result, scope);
  checkOriginal(result, sale);
  if (result.id !== refundId)
    throw new Error('Refund identity does not match.');
  return result;
}
export async function completeRefund(
  request: AuthenticatedRequest,
  scope: RefundScope,
  sale: CompletedSale,
  input: RefundCommand,
) {
  const command = refundCommandSchema.parse(input);
  const raw = await request<unknown>(path(scope), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const result = staffRefundSchema.parse(raw);
  checkScope(result, scope);
  checkOriginal(result, sale);
  if (
    result.reason !== command.reason ||
    result.paymentMethod !== command.paymentMethod ||
    result.paymentReference !== (command.paymentReference ?? null) ||
    result.items.length !== command.items.length ||
    result.items.some((line) => {
      const submitted = command.items.find(
        (item) => item.saleItemId === line.saleItemId,
      );
      return (
        !submitted ||
        submitted.quantity !== line.quantity ||
        submitted.restockQuantity !== line.restockQuantity
      );
    })
  )
    throw new Error('Refund completion does not match the submitted command.');
  return result;
}
