import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { branchScope } from '../authorization/resource-access';
import type { SalesReportQueryDto } from './dto/sales-report-query.dto';
import type { ReportPaymentResponseDto, SalesReport } from './reports.types';

type Aggregate = {
  grossSales: string;
  transactionCount: string;
  unitsSold: string;
};
const identitySelect = { id: true, name: true, code: true } as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async branches(context: OrganizationContext) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        return tx.branch.findMany({
          where: this.reportBranchScope(current),
          select: identitySelect,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async sales(
    context: OrganizationContext,
    branchId: string,
    query: SalesReportQueryDto,
  ): Promise<SalesReport> {
    const from = new Date(query.from);
    const until = new Date(query.until);
    const duration = until.getTime() - from.getTime();
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 366 * 86400000
    )
      throw new BadRequestException(
        'from must precede until by no more than 366 days',
      );
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        const branch = await tx.branch.findFirst({
          where: { AND: [this.reportBranchScope(current), { id: branchId }] },
          select: identitySelect,
        });
        if (!branch) throw new NotFoundException('Branch not found');
        const range = {
          branch,
          from: from.toISOString(),
          until: until.toISOString(),
        };
        if (current.role === 'MERCHANT') {
          const own = current.merchantId
            ? (
                await tx.$queryRaw<Aggregate[]>(Prisma.sql`
          SELECT COALESCE(SUM(i."lineTotal")::text, '0.00') AS "grossSales",
                 COUNT(DISTINCT i."saleId")::text AS "transactionCount",
                 COALESCE(SUM(i."quantity"::numeric)::text, '0') AS "unitsSold"
          FROM "SaleItem" i JOIN "Sale" s
            ON s."id" = i."saleId" AND s."organizationId" = i."organizationId" AND s."branchId" = i."branchId"
          WHERE i."organizationId" = ${current.organizationId} AND i."branchId" = ${branchId}
            AND i."merchantId" = ${current.merchantId}
            AND s."organizationId" = ${current.organizationId} AND s."branchId" = ${branchId}
            AND s."completedAt" >= ${from} AND s."completedAt" < ${until}
        `)
              )[0]
            : { grossSales: '0.00', transactionCount: '0', unitsSold: '0' };
          return {
            ...range,
            scope: 'MERCHANT',
            ownGrossSales: own.grossSales,
            ownTransactionCount: own.transactionCount,
            ownUnitsSold: own.unitsSold,
          };
        }
        const [summary] = await tx.$queryRaw<Aggregate[]>(Prisma.sql`
        WITH matched AS (
          SELECT "id", "total" FROM "Sale"
          WHERE "organizationId" = ${current.organizationId} AND "branchId" = ${branchId}
            AND "completedAt" >= ${from} AND "completedAt" < ${until}
        )
        SELECT COALESCE(SUM("total")::text, '0.00') AS "grossSales", COUNT(*)::text AS "transactionCount",
          (SELECT COALESCE(SUM(i."quantity"::numeric)::text, '0') FROM "SaleItem" i JOIN matched s ON s."id" = i."saleId"
           WHERE i."organizationId" = ${current.organizationId} AND i."branchId" = ${branchId}) AS "unitsSold"
        FROM matched
      `);
        const paymentRows = await tx.$queryRaw<
          ReportPaymentResponseDto[]
        >(Prisma.sql`
        SELECT "paymentMethod", SUM("total")::text AS "grossSales", COUNT(*)::text AS "transactionCount"
        FROM "Sale" WHERE "organizationId" = ${current.organizationId} AND "branchId" = ${branchId}
          AND "completedAt" >= ${from} AND "completedAt" < ${until}
        GROUP BY "paymentMethod"
      `);
        const payments = (['CASH', 'GCASH', 'CARD'] as const).map(
          (paymentMethod) =>
            paymentRows.find((row) => row.paymentMethod === paymentMethod) ?? {
              paymentMethod,
              grossSales: '0.00',
              transactionCount: '0',
            },
        );
        return { ...range, scope: 'STAFF', ...summary, payments };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async currentContext(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
  ): Promise<OrganizationContext> {
    const member = await tx.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        user: { deletedAt: null },
      },
      select: { role: true, merchantId: true },
    });
    if (!member) throw new NotFoundException('Organization not found');
    if (!['OWNER', 'MANAGER', 'MERCHANT'].includes(member.role))
      throw new ForbiddenException(
        'Your organization role cannot view reports',
      );
    return {
      organizationId: context.organizationId,
      userId: context.userId,
      ...member,
    };
  }

  private reportBranchScope(
    context: OrganizationContext,
  ): Prisma.BranchWhereInput {
    if (context.role !== 'MERCHANT') return branchScope(context);
    return {
      organizationId: context.organizationId,
      OR: [
        {
          memberships: {
            some: {
              organizationId: context.organizationId,
              userId: context.userId,
            },
          },
        },
        ...(context.merchantId
          ? [
              {
                sales: {
                  some: {
                    organizationId: context.organizationId,
                    items: {
                      some: {
                        organizationId: context.organizationId,
                        merchantId: context.merchantId,
                      },
                    },
                  },
                },
              },
            ]
          : []),
      ],
    };
  }
}
