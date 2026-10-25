import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

export async function assertActiveOrganization(
  transaction: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<
    { id: string; status: 'ACTIVE' | 'INACTIVE' }[]
  >`SELECT "id", "status"::text AS "status" FROM "Organization" WHERE "id" = ${organizationId} FOR UPDATE`;

  if (!rows.length) throw new NotFoundException('Organization not found');
  if (rows[0].status !== 'ACTIVE') {
    throw new ForbiddenException(
      'This organization is inactive and currently read-only',
    );
  }
}
