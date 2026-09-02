export type SettlementStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'PAID';
export type SettlementSchedule = 'WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
export type PayoutMethod = 'CASH' | 'GCASH' | 'BANK_TRANSFER' | 'OTHER';

export interface SettlementSummary {
  id: string;
  organizationId: string;
  merchantId: string;
  periodStart: string;
  periodEnd: string;
  scheduledDeadline: string | null;
  schedule: SettlementSchedule;
  status: SettlementStatus;
  grossSales: string;
  refundTotal: string;
  netSales: string;
  commissionAmount: string;
  fixedRentAmount: string;
  adjustmentTotal: string;
  netPayout: string;
  calculatedById: string;
  calculatedAt: string;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  merchant: { id: string; name: string; code: string | null };
  branches: Array<{ id: string; name: string }>;
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
    rentCollectionMethod: 'DEDUCT_FROM_PAYOUT' | 'PAID_SEPARATELY';
    rentDeductionTiming:
      | 'FIRST_SETTLEMENT_OF_MONTH'
      | 'LAST_SETTLEMENT_OF_MONTH'
      | 'PRORATED_PER_SETTLEMENT';
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
  financeEntries: Array<{
    id: string;
    type: 'ADJUSTMENT' | 'MERCHANT_PAYMENT';
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
  refundItems: Array<{
    refundItemId: string;
    refundAmount: string;
    refundItem: {
      saleItem: { productName: string; productSku: string };
      refund: { completedAt: string; reason: string; branchId: string };
    };
  }>;
  auditEvents: Array<{
    id: string;
    type: string;
    reason: string | null;
    actorId: string | null;
    createdAt: string;
  }>;
  receivableAllocations: Array<{
    settlementId: string;
    receivableId: string;
    amount: string;
    appliedAt: string | null;
    receivable: {
      id: string;
      type: 'RENT';
      sourcePeriod: string;
      originalAmount: string;
      remainingAmount: string;
      dueDate: string;
      status: MerchantReceivableStatus;
    };
  }>;
}

export interface SettlementPage {
  items: SettlementSummary[];
  total: number;
  offset: number;
  limit: number;
}

export interface SettlementFilters {
  branchId?: string;
  merchantId?: string;
  status?: SettlementStatus;
  periodFrom?: string;
  periodTo?: string;
  offset?: number;
  limit?: number;
}

export interface SettlementMetrics {
  grossSales: string;
  refunds: string;
  netSales: string;
  deductions: string;
  amountDue: string;
  count: number;
}

export interface LiveMerchantPayable {
  merchant: { id: string; name: string; code: string | null };
  financeStatus: 'READY' | 'NO_ACTIVITY' | 'AGREEMENT_REQUIRED';
  periodStart: string | null;
  asOf: string;
  nextSettlementDeadline: string | null;
  schedule: SettlementSchedule | null;
  grossSales: string;
  refundTotal: string;
  netSales: string;
  commissionAmount: string;
  fixedRentAmount: string;
  rentOutstandingAmount: string;
  adjustmentTotal: string;
  merchantPaymentTotal: string;
  amountDue: string;
  branches: Array<{ id: string; name: string }>;
  pendingSettlement: { id: string; status: SettlementStatus } | null;
  accountEntries: Array<{
    id: string;
    type: 'ADJUSTMENT' | 'MERCHANT_PAYMENT';
    amount: string;
    reason: string;
    occurredAt: string;
    createdById: string;
  }>;
}

export interface AdjustmentInput {
  amount: string;
  reason: string;
}

export interface FinanceEntryInput extends AdjustmentInput {
  type: 'ADJUSTMENT' | 'MERCHANT_PAYMENT';
  occurredAt?: string;
}

export interface PayoutInput {
  method: PayoutMethod;
  referenceNumber?: string;
  note?: string;
  paidAt: string;
}

export type MerchantReceivableStatus =
  'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface MerchantReceivable {
  id: string;
  merchantId: string;
  agreementId: string;
  type: 'RENT';
  sourcePeriod: string;
  originalAmount: string;
  remainingAmount: string;
  dueDate: string;
  status: MerchantReceivableStatus;
  merchant: { id: string; name: string; code: string | null };
  agreement: {
    id: string;
    startDate: string;
    endDate: string | null;
    fixedRentAmount: string | null;
  };
  transactions: Array<{
    id: string;
    type: 'PAYMENT' | 'SETTLEMENT_DEDUCTION' | 'ADJUSTMENT';
    amount: string;
    paymentMethod: PayoutMethod | null;
    referenceNumber: string | null;
    note: string | null;
    occurredAt: string;
    recordedById: string;
  }>;
}

export interface MerchantReceivablePage {
  items: MerchantReceivable[];
  total: number;
  offset: number;
  limit: number;
}

export interface ReceivableDeductionInput {
  receivableId: string;
  amount: string;
}

export interface SettlementPreview {
  merchant: { id: string; name: string; code: string | null };
  periodStart: string;
  cutoff: string;
  scheduledDeadline: string;
  grossSales: string;
  refundTotal: string;
  netSales: string;
  commissionAmount: string;
  adjustmentTotal: string;
  merchantPayable: string;
  receivables: Array<{
    id: string;
    sourcePeriod: string;
    dueDate: string;
    status: MerchantReceivableStatus;
    remainingAmount: string;
    reservedAmount: string;
    availableAmount: string;
  }>;
  receivableDeductionTotal: string;
  finalPayout: string;
}
