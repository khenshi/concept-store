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
import { readAnalytics } from './sales-analytics';
import type { SalesAnalytics } from './sales-analytics.types';
import { netRecordedSales } from './report-money';
export { netRecordedSales } from './report-money';
import type {
  ReportPaymentResponseDto,
  ReportRefundMethodResponseDto,
  SalesReport,
} from './reports.types';

type Aggregate = {
  grossSales: string;
  transactionCount: string;
  unitsSold: string;
};
type RefundAggregate = {
  refundedAmount: string;
  refundCount: string;
  returnedUnits: string;
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
    return this.read(context, branchId, query, false);
  }

  async analytics(
    context: OrganizationContext,
    branchId: string,
    query: SalesReportQueryDto,
  ): Promise<SalesAnalytics> {
    return this.read(context, branchId, query, true) as Promise<SalesAnalytics>;
  }

  private async read(
    context: OrganizationContext,
    branchId: string,
    query: SalesReportQueryDto,
    analytics: boolean,
  ) {
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
            scope: 'MERCHANT' as const,
            ownGrossSales: own.grossSales,
            ownTransactionCount: own.transactionCount,
            ownUnitsSold: own.unitsSold,
            ...(await this.ownRefunds(
              tx,
              current,
              branchId,
              from,
              until,
              own.grossSales,
            )),
            ...(analytics
              ? await readAnalytics(tx, current, branchId, from, until)
              : {}),
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
        const [refunds] = await tx.$queryRaw<RefundAggregate[]>(Prisma.sql`
          WITH matched_refunds AS (
            SELECT "id", "total" FROM "Refund"
            WHERE "organizationId" = ${current.organizationId} AND "branchId" = ${branchId}
              AND "completedAt" >= ${from} AND "completedAt" < ${until}
          )
          SELECT COALESCE(SUM("total")::text, '0.00') AS "refundedAmount", COUNT(*)::text AS "refundCount",
            (SELECT COALESCE(SUM(i."quantity"::numeric)::text, '0') FROM "RefundItem" i JOIN matched_refunds r ON r."id" = i."refundId"
             WHERE i."organizationId" = ${current.organizationId} AND i."branchId" = ${branchId}) AS "returnedUnits"
          FROM matched_refunds
        `);
        const refundRows = await tx.$queryRaw<
          ReportRefundMethodResponseDto[]
        >(Prisma.sql`
          SELECT "paymentMethod", SUM("total")::text AS "refundedAmount", COUNT(*)::text AS "refundCount"
          FROM "Refund" WHERE "organizationId" = ${current.organizationId} AND "branchId" = ${branchId}
            AND "completedAt" >= ${from} AND "completedAt" < ${until}
          GROUP BY "paymentMethod"
        `);
        const refundMethods = (['CASH', 'GCASH', 'CARD'] as const).map(
          (paymentMethod) =>
            refundRows.find((row) => row.paymentMethod === paymentMethod) ?? {
              paymentMethod,
              refundedAmount: '0.00',
              refundCount: '0',
            },
        );
        return {
          ...range,
          scope: 'STAFF' as const,
          ...summary,
          payments,
          ...refunds,
          netRecordedSales: netRecordedSales(
            summary.grossSales,
            refunds.refundedAmount,
          ),
          refundMethods,
          ...(analytics
            ? await readAnalytics(tx, current, branchId, from, until)
            : {}),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async ownRefunds(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    branchId: string,
    from: Date,
    until: Date,
    gross: string,
  ) {
    const own = context.merchantId
      ? (
          await tx.$queryRaw<RefundAggregate[]>(Prisma.sql`
      SELECT COALESCE(SUM(i."lineTotal")::text, '0.00') AS "refundedAmount",
        COUNT(DISTINCT i."refundId")::text AS "refundCount",
        COALESCE(SUM(i."quantity"::numeric)::text, '0') AS "returnedUnits"
      FROM "RefundItem" i JOIN "Refund" r
        ON r."id" = i."refundId" AND r."organizationId" = i."organizationId" AND r."branchId" = i."branchId" AND r."saleId" = i."saleId"
      WHERE i."organizationId" = ${context.organizationId} AND i."branchId" = ${branchId} AND i."merchantId" = ${context.merchantId}
        AND r."organizationId" = ${context.organizationId} AND r."branchId" = ${branchId}
        AND r."completedAt" >= ${from} AND r."completedAt" < ${until}
    `)
        )[0]
      : { refundedAmount: '0.00', refundCount: '0', returnedUnits: '0' };
    return {
      ownRefundedAmount: own.refundedAmount,
      ownRefundCount: own.refundCount,
      ownReturnedUnits: own.returnedUnits,
      ownNetRecordedSales: netRecordedSales(gross, own.refundedAmount),
    };
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
