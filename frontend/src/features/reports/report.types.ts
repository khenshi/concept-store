export interface ReportFilters {
  from?: string;
  to?: string;
  branchId?: string;
  merchantId?: string;
  offset?: number;
  limit?: number;
}

export interface ReportsOverview {
  period: { from: string; to: string };
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
    completedAt: string;
    branch: { id: string; name: string; code: string | null };
  }>;
  recentSettlements: Array<{
    id: string;
    merchantId: string;
    merchantName: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    netPayout: string;
  }>;
}

export interface MerchantReport {
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

export interface MerchantDashboardData {
  merchant: { id: string; name: string };
  period: { from: string; to: string };
  sales: ReportsOverview['sales'];
  settlements: ReportsOverview['settlements'];
  inventory: ReportsOverview['inventory'];
  recentSettlements: ReportsOverview['recentSettlements'];
}
