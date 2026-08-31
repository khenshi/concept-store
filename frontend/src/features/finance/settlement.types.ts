export type SettlementStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'PAID';
export type SettlementSchedule = 'WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
export type PayoutMethod = 'CASH' | 'GCASH' | 'BANK_TRANSFER' | 'OTHER';

export interface SettlementSummary {
  id: string;
  organizationId: string;
  merchantId: string;
  periodStart: string;
  periodEnd: string;
  schedule: SettlementSchedule;
  status: SettlementStatus;
  grossSales: string;
  commissionAmount: string;
  fixedRentAmount: string;
  adjustmentTotal: string;
  netPayout: string;
  calculatedById: string;
  calculatedAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  merchant: { id: string; name: string; code: string | null };
}

export interface SettlementDetail extends SettlementSummary {
  terms: Array<{
    id: string;
    agreementId: string;
    segmentStart: string;
    segmentEnd: string;
    schedule: SettlementSchedule;
    fixedRentRate: string | null;
    commissionRate: string | null;
    grossSales: string;
    commissionAmount: string;
    fixedRentAmount: string;
  }>;
  saleItems: Array<{
    saleItemId: string;
    grossAmount: string;
    saleItem: {
      productName: string;
      productSku: string;
      quantity: number;
      total: string;
      sale: { saleNumber: string; completedAt: string };
    };
  }>;
  adjustments: Array<{
    id: string;
    amount: string;
    reason: string;
    createdById: string;
    createdAt: string;
    updatedAt: string;
  }>;
  payout: null | {
    id: string;
    amount: string;
    method: PayoutMethod;
    referenceNumber: string | null;
    note: string | null;
    paidAt: string;
    recordedById: string;
  };
}

export interface SettlementPage {
  items: SettlementSummary[];
  total: number;
  offset: number;
  limit: number;
}

export interface SettlementFilters {
  merchantId?: string;
  status?: SettlementStatus;
  periodFrom?: string;
  periodTo?: string;
  offset?: number;
  limit?: number;
}

export interface GenerateSettlementInput {
  merchantId: string;
  periodStart: string;
  periodEnd: string;
}

export interface AdjustmentInput {
  amount: string;
  reason: string;
}

export interface PayoutInput {
  method: PayoutMethod;
  referenceNumber?: string;
  note?: string;
  paidAt: string;
}
