export interface PosMerchantSummary {
  id: string;
  name: string;
  code: string | null;
}

export interface PosProduct {
  id: string;
  branchId: string;
  merchantId: string;
  name: string;
  sku: string;
  barcode: string | null;
  sellingPrice: string;
  quantity: number;
  available: boolean;
  merchant: PosMerchantSummary;
}

export interface PosProductPage {
  items: PosProduct[];
  total: number;
  offset: number;
  limit: number;
}

export interface PosProductFilters {
  search?: string;
  merchantId?: string;
  offset?: number;
  limit?: number;
}

export interface PosCartLine {
  product: PosProduct;
  quantity: number;
}
