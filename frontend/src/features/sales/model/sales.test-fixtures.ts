import { completedSale } from '@/features/pos/model/pos.test-fixtures';
import type { MerchantSale } from './sales.schemas';
const { id, receiptCode, completedAt, branchId, branchName, branchCode } =
  completedSale;
export const ownSale: MerchantSale = {
  id,
  receiptCode,
  completedAt,
  branchId,
  branchName,
  branchCode,
  items: completedSale.items.map(
    ({
      id,
      productId,
      productName,
      sku,
      barcode,
      merchantName,
      quantity,
      unitPrice,
      lineTotal,
    }) => ({
      id,
      productId,
      productName,
      sku,
      barcode,
      merchantName,
      quantity,
      unitPrice,
      lineTotal,
    }),
  ),
  ownItemsSubtotal: '850.00',
};
export const ownPage = {
  items: [ownSale],
  page: 1,
  limit: 50,
  total: 1,
  totalPages: 1,
};
export const staffPage = { ...ownPage, items: [completedSale] };
export const sellingBranches = [
  { id: branchId, name: 'Current Makati', code: 'MKT' },
];
