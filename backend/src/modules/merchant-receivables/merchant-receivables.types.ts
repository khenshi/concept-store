import { Prisma } from '../../generated/prisma/client';

export const merchantReceivableInclude = {
  merchant: { select: { id: true, name: true, code: true } },
  agreement: {
    select: {
      id: true,
      startDate: true,
      endDate: true,
      fixedRentAmount: true,
    },
  },
  transactions: {
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.MerchantReceivableInclude;

type MerchantReceivableRow = Prisma.MerchantReceivableGetPayload<{
  include: typeof merchantReceivableInclude;
}>;

export interface MerchantReceivableRecord extends Omit<
  MerchantReceivableRow,
  'originalAmount' | 'remainingAmount' | 'agreement' | 'transactions'
> {
  originalAmount: string;
  remainingAmount: string;
  agreement: Omit<MerchantReceivableRow['agreement'], 'fixedRentAmount'> & {
    fixedRentAmount: string | null;
  };
  transactions: Array<
    Omit<MerchantReceivableRow['transactions'][number], 'amount'> & {
      amount: string;
    }
  >;
}

export interface MerchantReceivablePageRecord {
  items: MerchantReceivableRecord[];
  total: number;
  offset: number;
  limit: number;
}
