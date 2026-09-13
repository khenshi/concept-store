import type { PosProduct } from './pos.types';
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
