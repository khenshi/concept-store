import type { ProductStatus } from '../../generated/prisma/client';

export interface ProductRecord {
  id: string;
  organizationId: string;
  merchantId: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  merchant: ProductMerchantSummary;
}

export interface ProductMerchantSummary {
  id: string;
  name: string;
  code: string | null;
}
