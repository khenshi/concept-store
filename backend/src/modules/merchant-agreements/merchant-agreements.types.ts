import type { MerchantAgreement, Prisma } from '../../generated/prisma/client';

export type MerchantAgreementRecord = MerchantAgreement;

export const merchantAgreementViewInclude = {
  merchant: { select: { id: true, name: true, code: true } },
} satisfies Prisma.MerchantAgreementInclude;

export type MerchantAgreementViewRecord = Prisma.MerchantAgreementGetPayload<{
  include: typeof merchantAgreementViewInclude;
}>;
