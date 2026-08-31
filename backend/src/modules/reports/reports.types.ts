export interface ReportPeriodRecord {
  from: string;
  to: string;
}

export interface ReportsOverviewRecord {
  period: ReportPeriodRecord;
  filters: { branchId: string | null; merchantId: string | null };
  sales: {
    grossSales: string;
    refunds: string;
    netSales: string;
    saleCount: number;
  };
  revenue: {
    commission: string;
    fixedRent: string;
    adjustments: string;
    total: string;
  };
  settlements: {
    outstandingAmount: string;
    outstandingCount: number;
    paidAmount: string;
    paidCount: number;
  };
  inventory: {
    quantityOnHand: number;
    stockRecordCount: number;
    lowStockCount: number;
  };
  recentSales: Array<{
    id: string;
    saleNumber: string;
    total: string;
    completedAt: Date;
    branch: { id: string; name: string; code: string | null };
  }>;
  recentSettlements: Array<{
    id: string;
    merchantId: string;
    merchantName: string;
    periodStart: Date;
    periodEnd: Date;
    status: string;
    netPayout: string;
  }>;
}

export interface SalesReportRecord {
  items: Array<{
    id: string;
    saleId: string;
    saleNumber: string;
    completedAt: Date;
    branch: { id: string; name: string; code: string | null };
    merchant: { id: string; name: string };
    productName: string;
    productSku: string;
    quantity: number;
    grossSales: string;
    refunds: string;
    netSales: string;
  }>;
  total: number;
  offset: number;
  limit: number;
}

export interface InventoryReportRecord {
  items: Array<{
    organizationId: string;
    branchId: string;
    productId: string;
    quantity: number;
    branch: { id: string; name: string; code: string | null };
    product: {
      id: string;
      name: string;
      sku: string;
      status: string;
      sellingPrice: string;
      merchant: { id: string; name: string };
    };
  }>;
  total: number;
  offset: number;
  limit: number;
}

export interface MerchantReportRecord {
  items: Array<{
    id: string;
    name: string;
    status: string;
    grossSales: string;
    refunds: string;
    netSales: string;
    finalizedCommission: string;
    finalizedRent: string;
    amountPaid: string;
  }>;
  total: number;
  offset: number;
  limit: number;
}

export interface MerchantDashboardRecord {
  merchant: { id: string; name: string };
  period: ReportPeriodRecord;
  sales: ReportsOverviewRecord['sales'];
  settlements: ReportsOverviewRecord['settlements'];
  inventory: ReportsOverviewRecord['inventory'];
  recentSettlements: ReportsOverviewRecord['recentSettlements'];
}
