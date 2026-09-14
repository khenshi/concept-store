import { completedSale } from '@/features/pos/model/pos.test-fixtures';
import type {
  RefundCommand,
  MerchantRefund,
  StaffRefund,
} from './refund.schemas';
export const refundScope = {
  organizationId: completedSale.organizationId,
  branchId: completedSale.branchId,
  saleId: completedSale.id,
};
export const command: RefundCommand = {
  requestId: '44444444-4444-4444-8444-444444444444',
  reason: 'Damaged item',
  paymentMethod: 'CASH',
  refundConfirmed: true,
  items: [
    { saleItemId: completedSale.items[0].id, quantity: 1, restockQuantity: 0 },
  ],
};
const { id: saleItemId, ...original } = completedSale.items[0];
export const staffRefund: StaffRefund = {
  scope: 'STAFF',
  id: '55555555-5555-4555-8555-555555555555',
  ...refundScope,
  receiptCode: completedSale.receiptCode,
  refundCode: 'REFUND-SAVED-001',
  completedAt: '2026-09-14T05:00:00.000Z',
  reason: command.reason,
  paymentMethod: 'CASH',
  paymentReference: null,
  total: '850.00',
  items: [
    {
      ...original,
      id: '66666666-6666-4666-8666-666666666666',
      saleItemId,
      restockQuantity: 0,
    },
  ],
};
const ownItem = {
  id: staffRefund.items[0].id,
  saleItemId,
  productId: original.productId,
  productName: original.productName,
  sku: original.sku,
  barcode: original.barcode,
  merchantName: original.merchantName,
  quantity: original.quantity,
  restockQuantity: 0,
  unitPrice: original.unitPrice,
  lineTotal: original.lineTotal,
};
export const merchantRefund: MerchantRefund = {
  scope: 'MERCHANT',
  id: staffRefund.id,
  saleId: staffRefund.saleId,
  branchId: staffRefund.branchId,
  branchName: completedSale.branchName,
  branchCode: completedSale.branchCode,
  receiptCode: staffRefund.receiptCode,
  refundCode: staffRefund.refundCode,
  completedAt: staffRefund.completedAt,
  ownItemsSubtotal: staffRefund.total,
  items: [ownItem],
};
export const remaining = [
  {
    saleItemId,
    soldQuantity: 1,
    returnedQuantity: 0,
    restockedQuantity: 0,
    remainingQuantity: 1,
  },
];
export const emptyPage = {
  scope: 'STAFF',
  page: 1,
  limit: 10,
  items: [],
  total: 0,
  totalPages: 0,
  remainingItems: remaining,
};
export const returnedRemaining = [
  { ...remaining[0], returnedQuantity: 1, remainingQuantity: 0 },
];
export const refundPage = {
  ...emptyPage,
  items: [staffRefund],
  total: 1,
  totalPages: 1,
  remainingItems: returnedRemaining,
};
export const ownRefundPage = {
  ...refundPage,
  scope: 'MERCHANT',
  items: [merchantRefund],
};
