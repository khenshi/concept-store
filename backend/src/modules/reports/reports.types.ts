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
