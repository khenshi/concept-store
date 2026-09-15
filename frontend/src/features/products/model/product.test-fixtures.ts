import type { Merchant } from '@/features/merchants/model/merchant.types';
import type { Product, ProductPlacement } from './product.types';

export const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const merchant: Merchant = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  organizationId,
  name: 'Amihan Studio',
  code: 'AMIHAN',
  contactName: 'Test Contact',
  email: null,
  phone: '09171234567',
  status: 'ACTIVE',
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};
export const product: Product = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  organizationId,
  merchantId: merchant.id,
  name: 'Ceramic Vase',
  sku: 'VASE-01',
  barcode: '001Ab',
  status: 'ACTIVE',
  createdAt: merchant.createdAt,
  updatedAt: merchant.updatedAt,
};
export const placement: ProductPlacement = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  organizationId,
  branchId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  productId: product.id,
  sellingPrice: '850.00',
  quantity: 10,
  lowStockThreshold: 5,
  stockStatus: 'IN_STOCK',
  createdAt: merchant.createdAt,
  updatedAt: merchant.updatedAt,
  branch: {
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    name: 'Makati',
    code: 'MKT',
  },
};
