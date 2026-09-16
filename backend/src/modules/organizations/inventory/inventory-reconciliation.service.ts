import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { branchScope } from '../authorization/resource-access';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import type { InventoryReconciliationQueryDto } from './dto/inventory-reconciliation-query.dto';
import type {
  InventoryReconciliationMismatch,
  InventoryReconciliationPage,
} from './inventory-reconciliation.types';

type MismatchRow = Omit<
  InventoryReconciliationMismatch,
  'ledgerQuantity' | 'difference'
> & {
  ledgerQuantity: bigint;
  difference: bigint;
};

@Injectable()
export class InventoryReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  reconcile(
    context: OrganizationContext,
    branchId: string,
    query: InventoryReconciliationQueryDto,
  ): Promise<InventoryReconciliationPage> {
    return this.prisma.$transaction(
      async (tx) => {
        const membership = await tx.organizationMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: context.organizationId,
              userId: context.userId,
            },
          },
          select: { role: true, user: { select: { deletedAt: true } } },
        });
        if (!membership || membership.user.deletedAt !== null)
          throw new NotFoundException('Organization not found');
        if (
          membership.role !== OrganizationRole.OWNER &&
          membership.role !== OrganizationRole.MANAGER
        )
          throw new ForbiddenException(
            'Inventory diagnostics require staff access',
          );
        const current: OrganizationContext = {
          organizationId: context.organizationId,
          userId: context.userId,
          role: membership.role,
        };
        const branch = await tx.branch.findFirst({
          where: { AND: [branchScope(current), { id: branchId }] },
          select: { id: true },
        });
        if (!branch) throw new NotFoundException('Branch not found');

        const cursor = query.cursor
          ? Prisma.sql`AND bi."id" > ${query.cursor}`
          : Prisma.empty;
        const rows = await tx.$queryRaw<MismatchRow[]>(Prisma.sql`
          SELECT
            bi."id" AS "inventoryId",
            p."id" AS "productId",
            p."name" AS "productName",
            p."sku" AS "sku",
            bi."quantity" AS "recordedQuantity",
            COALESCE(SUM(im."quantityChange"), 0)::bigint AS "ledgerQuantity",
            (bi."quantity"::bigint - COALESCE(SUM(im."quantityChange"), 0))::bigint AS "difference"
          FROM "BranchInventory" bi
          JOIN "Product" p
            ON p."id" = bi."productId"
           AND p."organizationId" = bi."organizationId"
          LEFT JOIN "InventoryMovement" im
            ON im."branchInventoryId" = bi."id"
           AND im."organizationId" = bi."organizationId"
           AND im."branchId" = bi."branchId"
          WHERE bi."organizationId" = ${context.organizationId}
            AND bi."branchId" = ${branchId}
            ${cursor}
          GROUP BY bi."id", p."id"
          HAVING bi."quantity"::bigint <> COALESCE(SUM(im."quantityChange"), 0)
          ORDER BY bi."id" ASC
          LIMIT ${query.limit + 1}
        `);
        const items = rows.slice(0, query.limit).map((row) => ({
          ...row,
          ledgerQuantity: row.ledgerQuantity.toString(),
          difference: row.difference.toString(),
        }));
        return {
          items,
          nextCursor:
            rows.length > query.limit ? items.at(-1)!.inventoryId : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
