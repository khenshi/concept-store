import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

/** Lock before inventory rows. All lifecycle and operational writes use this order. */
export async function requireActiveParticipation(
  tx: Prisma.TransactionClient,
  organizationId: string,
  branchId: string,
  merchantIds: string[],
) {
  const ids = [...new Set(merchantIds)].sort();
  if (!ids.length) return;
  const rows = await tx.$queryRaw<
    { merchantId: string; status: string }[]
  >(Prisma.sql`
    SELECT "merchantId", "status" FROM "MerchantBranch"
    WHERE "organizationId" = ${organizationId} AND "branchId" = ${branchId}
      AND "merchantId" IN (${Prisma.join(ids)})
    ORDER BY "merchantId" FOR SHARE
  `);
  if (rows.length !== ids.length || rows.some((row) => row.status !== 'ACTIVE'))
    throw new ConflictException({
      code: 'MERCHANT_BRANCH_INACTIVE',
      message:
        'An active merchant–branch association is required for placement, receiving and selling.',
    });
}
