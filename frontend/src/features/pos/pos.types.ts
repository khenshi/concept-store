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

export type PaymentMethod = 'CASH' | 'GCASH' | 'BANK_TRANSFER' | 'OTHER';

export interface CreateSaleInput {
  clientTransactionId: string;
  items: { productId: string; quantity: number }[];
  payments: {
    method: PaymentMethod;
    amount: string;
    referenceNumber?: string;
  }[];
}

export interface SaleItem {
  id: string;
  productId: string;
  merchantId: string;
  productName: string;
  productSku: string;
  productBarcode: string | null;
  merchantName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  discountAmount: string;
  total: string;
}

export interface SalePayment {
  id: string;
  method: PaymentMethod;
  amount: string;
  referenceNumber: string | null;
  confirmedById: string;
  paidAt: string;
}

export interface Sale {
  id: string;
  organizationId: string;
  branchId: string;
  cashierId: string;
  saleNumber: string;
  clientTransactionId: string;
  subtotal: string;
  discountTotal: string;
  total: string;
  completedAt: string;
  branch: { id: string; name: string; code: string | null };
  cashier: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  items: SaleItem[];
  payments: SalePayment[];
}
