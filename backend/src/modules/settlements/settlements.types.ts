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
  adjustments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  payout: true,
} satisfies Prisma.MerchantSettlementInclude;

export type SettlementRecord = Prisma.MerchantSettlementGetPayload<{
  include: typeof settlementRecordInclude;
}>;

export const settlementSummaryInclude = {
  merchant: { select: { id: true, name: true, code: true } },
} satisfies Prisma.MerchantSettlementInclude;

export type SettlementSummaryRow = Prisma.MerchantSettlementGetPayload<{
  include: typeof settlementSummaryInclude;
}>;

export interface SettlementSummaryRecord extends Omit<
  SettlementSummaryRow,
  | 'grossSales'
  | 'commissionAmount'
  | 'fixedRentAmount'
  | 'adjustmentTotal'
  | 'netPayout'
> {
  grossSales: string;
  commissionAmount: string;
  fixedRentAmount: string;
  adjustmentTotal: string;
  netPayout: string;
}

export interface SettlementViewRecord extends Omit<
  SettlementRecord,
  | 'grossSales'
  | 'commissionAmount'
  | 'fixedRentAmount'
  | 'adjustmentTotal'
  | 'netPayout'
  | 'terms'
  | 'saleItems'
  | 'adjustments'
  | 'payout'
> {
  grossSales: string;
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
      | 'commissionAmount'
      | 'fixedRentAmount'
    > & {
      fixedRentRate: string | null;
      commissionRate: string | null;
      grossSales: string;
      commissionAmount: string;
      fixedRentAmount: string;
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
  adjustments: Array<
    Omit<SettlementRecord['adjustments'][number], 'amount'> & { amount: string }
  >;
  payout:
    | (Omit<NonNullable<SettlementRecord['payout']>, 'amount'> & {
        amount: string;
      })
    | null;
}

export interface SettlementPageRecord {
  items: SettlementSummaryRecord[];
  total: number;
  offset: number;
  limit: number;
}
