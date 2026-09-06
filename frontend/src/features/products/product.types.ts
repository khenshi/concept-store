export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductMerchantSummary {
  id: string;
  name: string;
  code: string | null;
}

export interface Product {
  id: string;
  organizationId: string;
  merchantId: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  merchant: ProductMerchantSummary;
}

export interface ProductFilters {
  search?: string;
  merchantId?: string;
  status?: ProductStatus;
}

export interface ProductInput {
  merchantId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  sellingPrice: string;
  initialStock?: {
    branchId: string;
    quantity: number;
    referenceId?: string;
    note?: string;
  };
}

export type ProductUpdateInput = Omit<ProductInput, 'merchantId'>;
