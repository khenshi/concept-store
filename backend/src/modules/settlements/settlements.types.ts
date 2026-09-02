import { Prisma } from '../../generated/prisma/client';

export const settlementRecordInclude = {
  merchant: { select: { id: true, name: true, code: true } },
  terms: { orderBy: [{ segmentStart: 'asc' }, { id: 'asc' }] },
  saleItems: {
    include: {
      saleItem: {
        select: {
          productName: true,
          productSku: true,
          quantity: true,
          total: true,
          sale: { select: { saleNumber: true, completedAt: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { saleItemId: 'asc' }],
  },
  financeEntries: { orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }] },
  payout: true,
  refundItems: {
    include: {
      refundItem: {
        include: {
          refund: {
            select: { completedAt: true, reason: true, branchId: true },
          },
          saleItem: { select: { productName: true, productSku: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { refundItemId: 'asc' }],
  },
  auditEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  receivableAllocations: {
    include: {
      receivable: {
        select: {
          id: true,
          sourcePeriod: true,
          originalAmount: true,
          remainingAmount: true,
          dueDate: true,
          status: true,
        },
      },
    },
    orderBy: [{ receivable: { sourcePeriod: 'asc' } }, { receivableId: 'asc' }],
  },
} satisfies Prisma.MerchantSettlementInclude;

export type SettlementRecord = Prisma.MerchantSettlementGetPayload<{
  include: typeof settlementRecordInclude;
}>;

export const settlementSummaryInclude = {
  merchant: { select: { id: true, name: true, code: true } },
  saleItems: {
    select: {
      saleItem: {
        select: {
          sale: { select: { branch: { select: { id: true, name: true } } } },
        },
      },
    },
  },
  refundItems: {
    select: {
      refundItem: {
        select: {
          refund: { select: { branch: { select: { id: true, name: true } } } },
        },
      },
    },
  },
} satisfies Prisma.MerchantSettlementInclude;

export type SettlementSummaryRow = Prisma.MerchantSettlementGetPayload<{
  include: typeof settlementSummaryInclude;
}>;

export interface SettlementSummaryRecord extends Omit<
  SettlementSummaryRow,
  | 'grossSales'
  | 'refundTotal'
  | 'netSales'
  | 'commissionAmount'
  | 'fixedRentAmount'
  | 'adjustmentTotal'
  | 'netPayout'
  | 'saleItems'
  | 'refundItems'
> {
  grossSales: string;
  refundTotal: string;
  netSales: string;
  commissionAmount: string;
  fixedRentAmount: string;
  adjustmentTotal: string;
  netPayout: string;
  branches: Array<{ id: string; name: string }>;
}

export interface SettlementViewRecord extends Omit<
  SettlementRecord,
  | 'grossSales'
  | 'refundTotal'
  | 'netSales'
  | 'commissionAmount'
  | 'fixedRentAmount'
  | 'adjustmentTotal'
  | 'netPayout'
  | 'terms'
  | 'saleItems'
  | 'financeEntries'
  | 'payout'
  | 'refundItems'
  | 'receivableAllocations'
> {
  grossSales: string;
  refundTotal: string;
  netSales: string;
  commissionAmount: string;
  fixedRentAmount: string;
  adjustmentTotal: string;
  netPayout: string;
  terms: Array<
    Omit<
      SettlementRecord['terms'][number],
      | 'fixedRentRate'
      | 'commissionRate'
      | 'grossSales'
      | 'refundTotal'
      | 'netSales'
      | 'commissionAmount'
    > & {
      fixedRentRate: string | null;
      commissionRate: string | null;
      grossSales: string;
      refundTotal: string;
      netSales: string;
      commissionAmount: string;
    }
  >;
  saleItems: Array<
    Omit<SettlementRecord['saleItems'][number], 'grossAmount' | 'saleItem'> & {
      grossAmount: string;
      saleItem: Omit<
        SettlementRecord['saleItems'][number]['saleItem'],
        'total'
      > & { total: string };
    }
  >;
  financeEntries: Array<
    Omit<SettlementRecord['financeEntries'][number], 'amount'> & {
      amount: string;
    }
  >;
  payout:
    | (Omit<NonNullable<SettlementRecord['payout']>, 'amount'> & {
        amount: string;
      })
    | null;
  refundItems: Array<
    Omit<SettlementRecord['refundItems'][number], 'refundAmount'> & {
      refundAmount: string;
    }
  >;
  receivableAllocations: Array<
    Omit<
      SettlementRecord['receivableAllocations'][number],
      'amount' | 'receivable'
    > & {
      amount: string;
      receivable: Omit<
        SettlementRecord['receivableAllocations'][number]['receivable'],
        'originalAmount' | 'remainingAmount'
      > & { originalAmount: string; remainingAmount: string };
    }
  >;
}

export interface SettlementPageRecord {
  items: SettlementSummaryRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface LiveMerchantPayableRecord {
  merchant: { id: string; name: string; code: string | null };
  financeStatus: 'READY' | 'OVERDUE' | 'NO_ACTIVITY' | 'AGREEMENT_REQUIRED';
  periodStart: string | null;
  asOf: string;
  nextSettlementDeadline: string | null;
  schedule: string | null;
  grossSales: string;
  refundTotal: string;
  netSales: string;
  commissionAmount: string;
  fixedRentAmount: string;
  rentOutstandingAmount: string;
  adjustmentTotal: string;
  amountDue: string;
  overdueAmount: string;
  newActivityAmount: string;
  branches: Array<{ id: string; name: string }>;
  pendingSettlement: { id: string; status: string } | null;
  accountEntries: Array<{
    id: string;
    amount: string;
    reason: string;
    occurredAt: Date;
    createdById: string;
  }>;
}

export interface SettlementPreviewRecord {
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
    sourcePeriod: Date;
    dueDate: Date;
    status: string;
    remainingAmount: string;
    reservedAmount: string;
    availableAmount: string;
  }>;
  receivableDeductionTotal: string;
  finalPayout: string;
}
