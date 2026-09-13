import type { PosProduct } from './pos.types';
import type { CompletedSale } from './checkout';
export const scope = {
  organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  branchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
};
export const product: PosProduct = {
  branchInventoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  productId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  name: 'Amihan Vase',
  sku: 'AMIHAN-VASE',
  barcode: '001Ab',
  merchantName: 'Amihan Home',
  sellingPrice: '850.00',
  quantity: 10,
  eligible: true,
};
export const secondProduct: PosProduct = {
  ...product,
  branchInventoryId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  productId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  name: 'Luntian Pouch',
  sku: 'LUNTIAN-POUCH',
  barcode: 'AMIHAN-VASE',
  merchantName: 'Luntian Studio',
  sellingPrice: '250.00',
};
export const completedSale: CompletedSale = {
  id: '11111111-1111-4111-8111-111111111111',
  ...scope,
  receiptCode: 'SALE-SAVED-001',
  completedAt: '2026-09-13T05:00:00.000Z',
  organizationName: 'Saved Store',
  branchName: 'Saved Makati',
  branchCode: 'MKT',
  cashierName: 'Saved Cashier',
  paymentMethod: 'CASH',
  cashTender: '1000.00',
  cashChange: '150.00',
  paymentReference: null,
  total: '850.00',
  items: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      branchInventoryId: product.branchInventoryId,
      productId: product.productId,
      merchantId: '33333333-3333-4333-8333-333333333333',
      productName: product.name,
      sku: product.sku,
      barcode: product.barcode,
      merchantName: product.merchantName,
      quantity: 1,
      unitPrice: '850.00',
      lineTotal: '850.00',
    },
  ],
};
