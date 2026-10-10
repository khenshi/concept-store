import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, SpaceReleaseReason } from '../../../generated/prisma/client';

export async function lockSpaceMerchant(
  tx: Prisma.TransactionClient,
  organizationId: string,
  merchantId: string,
) {
  const rows = await tx.$queryRaw<
    { id: string; status: string }[]
  >`SELECT "id", "status" FROM "Merchant" WHERE "organizationId" = ${organizationId} AND "id" = ${merchantId} FOR UPDATE`;
  if (!rows.length) throw new NotFoundException('Merchant not found');
  return rows[0];
}

export async function releaseMerchantSpaces(
  tx: Prisma.TransactionClient,
  organizationId: string,
  merchantId: string,
  actorId: string,
  reason: SpaceReleaseReason,
  branchId?: string,
) {
  const where = {
    organizationId,
    merchantId,
    endedAt: null,
    ...(branchId ? { branchId } : {}),
  };
  const open = await tx.spaceOccupancy.findMany({
    where,
    select: { spaceId: true },
    orderBy: { spaceId: 'asc' },
  });
  for (const row of open)
    await tx.$queryRaw`SELECT "id" FROM "Space" WHERE "organizationId" = ${organizationId} AND "id" = ${row.spaceId} FOR UPDATE`;
  return tx.spaceOccupancy.updateMany({
    where,
    data: { endedAt: new Date(), releasedById: actorId, releaseReason: reason },
  });
}

export function rethrowSpaceConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const adapter = error.meta?.driverAdapterError as
      { cause?: { originalCode?: string } } | undefined;
    const code =
      typeof error.meta?.code === 'string'
        ? error.meta.code
        : adapter?.cause?.originalCode;
    if (
      ['P2002', 'P2034'].includes(error.code) ||
      (error.code === 'P2010' &&
        ['40001', '40P01', '23505'].includes(code ?? ''))
    )
      throw new ConflictException(
        'Space or occupancy changed; refresh and retry. Names must be unique and occupancy dates cannot overlap.',
      );
  }
  throw error;
}
