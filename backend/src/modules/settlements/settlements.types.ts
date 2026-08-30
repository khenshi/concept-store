import { Prisma } from '../../generated/prisma/client';

export const settlementRecordInclude = {
  merchant: { select: { id: true, name: true, code: true } },
  terms: { orderBy: [{ segmentStart: 'asc' }, { id: 'asc' }] },
  saleItems: { orderBy: [{ createdAt: 'asc' }, { saleItemId: 'asc' }] },
  adjustments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  payout: true,
} satisfies Prisma.MerchantSettlementInclude;

export type SettlementRecord = Prisma.MerchantSettlementGetPayload<{
  include: typeof settlementRecordInclude;
}>;
