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
  | 'rentAccruedAmount'
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
  rentAccruedAmount: string;
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
  | 'rentAccruedAmount'
  | 'adjustmentTotal'
  | 'netPayout'
  | 'terms'
  | 'saleItems'
  | 'financeEntries'
  | 'payout'
  | 'refundItems'
> {
  grossSales: string;
  refundTotal: string;
  netSales: string;
  commissionAmount: string;
  fixedRentAmount: string;
  rentAccruedAmount: string;
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
      | 'fixedRentAmount'
      | 'rentAccruedAmount'
    > & {
      fixedRentRate: string | null;
      commissionRate: string | null;
      grossSales: string;
      refundTotal: string;
      netSales: string;
      commissionAmount: string;
      fixedRentAmount: string;
      rentAccruedAmount: string;
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
}

export interface SettlementPageRecord {
  items: SettlementSummaryRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface LiveMerchantPayableRecord {
  merchant: { id: string; name: string; code: string | null };
  financeStatus: 'READY' | 'NO_ACTIVITY' | 'AGREEMENT_REQUIRED';
  periodStart: string | null;
  asOf: string;
  nextSettlementDeadline: string | null;
  schedule: string | null;
  grossSales: string;
  refundTotal: string;
  netSales: string;
  commissionAmount: string;
  fixedRentAmount: string;
  rentAccruedAmount: string;
  rentOutstandingAmount: string;
  adjustmentTotal: string;
  merchantPaymentTotal: string;
  amountDue: string;
  branches: Array<{ id: string; name: string }>;
  pendingSettlement: { id: string; status: string } | null;
  accountEntries: Array<{
    id: string;
    type: string;
    amount: string;
    reason: string;
    occurredAt: Date;
    createdById: string;
  }>;
}
