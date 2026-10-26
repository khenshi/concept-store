import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { branchScope, merchantScope } from '../authorization/resource-access';
import type {
  DailyReportQueryDto,
  ReportPeriodQueryDto,
  SalesRankingQueryDto,
  SalesReportQueryDto,
  TransactionsQueryDto,
} from './dto/sales-report-query.dto';
import {
  ReportTransactionType,
  ReportPeriodMode,
  SalesRankingSortBy,
} from './dto/sales-report-query.dto';
import {
  PRODUCT_RANKING_PAGE_SIZE,
  readAnalytics,
  readProductRankings,
  readTrends,
} from './sales-analytics';
import type {
  SalesAnalytics,
  SalesRankingPage,
  DailyReportPage,
} from './sales-analytics.types';
import type { ReportPeriodResponseDto } from '../../../openapi/response.dto';
import {
  calendarDay,
  DAY_MS,
  manilaMidnight,
  reportDates,
  reportRange,
  validateReportUntil,
} from './report-period';
import { netRecordedSales } from './report-money';
export { netRecordedSales } from './report-money';
import { readPaymentAccounts } from './payment-account-aggregates';
import { reportSourceBranchPredicate } from './report-sql-scope';
import type { SalesReport, TransactionsPage } from './reports.types';

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
type TransactionRow = {
  type: 'SALE' | 'REFUND';
  id: string;
  saleId: string;
  refundId: string | null;
  completedAt: Date;
  reference: string;
  amount: string;
  paymentAccountId: string | null;
  paymentAccountName: string | null;
  paymentAccountIsCash: boolean | null;
  paymentAccountRequiresReference: boolean | null;
  actorName: string | null;
  merchantNames: string[];
  branchId: string;
  branchName: string;
  branchCode: string | null;
  totalCount: number;
};
type ResolvedBranches = {
  branch?: { id: string; name: string; code: string | null };
  reportScope?: 'ALL';
  branchCount?: number;
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

  async allSales(context: OrganizationContext, query: SalesReportQueryDto) {
    return this.read(context, null, query, false);
  }

  async period(
    context: OrganizationContext,
    branchId: string | null,
    query: ReportPeriodQueryDto,
  ): Promise<ReportPeriodResponseDto> {
    if (query.mode !== ReportPeriodMode.ALL_TIME)
      throw new BadRequestException('Explicit ALL_TIME mode is required');
    const until = validateReportUntil(query.until);
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        const resolved = await this.resolveBranches(tx, current, branchId);
        const own = current.role === 'MERCHANT';
        const saleBranchFilter = reportSourceBranchPredicate(
          current,
          's',
          branchId,
        );
        const refundBranchFilter = reportSourceBranchPredicate(
          current,
          'r',
          branchId,
        );
        const saleMerchantFilter = own
          ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "SaleItem" i WHERE i."organizationId" = ${current.organizationId}
          AND i."branchId" = s."branchId"
          AND i."saleId" = s."id" AND i."merchantId" = ${current.merchantId}
      )`
          : Prisma.empty;
        const refundMerchantFilter = own
          ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "RefundItem" i WHERE i."organizationId" = ${current.organizationId}
          AND i."branchId" = r."branchId"
          AND i."refundId" = r."id" AND i."saleId" = r."saleId" AND i."merchantId" = ${current.merchantId}
      )`
          : Prisma.empty;
        const earliest =
          own && !current.merchantId
            ? null
            : ((
                await tx.$queryRaw<{ earliest: Date | null }[]>(Prisma.sql`
        SELECT MIN(activity."completedAt") AS earliest FROM (
          (SELECT s."completedAt" FROM "Sale" s
            WHERE s."organizationId" = ${current.organizationId} ${saleBranchFilter}
              AND s."completedAt" < ${until} ${saleMerchantFilter}
            ORDER BY s."completedAt" ASC LIMIT 1)
          UNION ALL
          (SELECT r."completedAt" FROM "Refund" r
            WHERE r."organizationId" = ${current.organizationId} ${refundBranchFilter}
              AND r."completedAt" < ${until} ${refundMerchantFilter}
            ORDER BY r."completedAt" ASC LIMIT 1)
        ) activity
      `)
              )[0]?.earliest ?? null);
        const from = earliest
          ? manilaMidnight(
              new Date(calendarDay(earliest) * DAY_MS)
                .toISOString()
                .slice(0, 10),
            ).toISOString()
          : null;
        if (from) reportRange({ from, until: until.toISOString() });
        return {
          scope: own ? 'MERCHANT' : 'STAFF',
          ...this.reportScopeMetadata(resolved),
          from,
          until: until.toISOString(),
          hasActivity: earliest !== null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async daily(
    context: OrganizationContext,
    branchId: string | null,
    query: DailyReportQueryDto,
  ): Promise<DailyReportPage> {
    const { from, until } = reportRange(query);
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        const resolved = await this.resolveBranches(tx, current, branchId);
        const total =
          calendarDay(new Date(until.getTime() - 1)) - calendarDay(from) + 1;
        const dates = reportDates(
          from,
          until,
          'DAY',
          (query.page - 1) * query.limit,
          query.limit,
        );
        const pageFrom = dates.length
          ? new Date(
              Math.max(from.getTime(), manilaMidnight(dates[0]).getTime()),
            )
          : from;
        const pageUntil = dates.length
          ? new Date(
              Math.min(
                until.getTime(),
                manilaMidnight(
                  new Date(Date.parse(`${dates.at(-1)!}T00:00:00Z`) + DAY_MS)
                    .toISOString()
                    .slice(0, 10),
                ).getTime(),
              ),
            )
          : until;
        const items = dates.length
          ? await readTrends(tx, current, branchId, pageFrom, pageUntil, 'DAY')
          : [];
        return {
          scope: current.role === 'MERCHANT' ? 'MERCHANT' : 'STAFF',
          ...this.reportScopeMetadata(resolved),
          from: from.toISOString(),
          until: until.toISOString(),
          items,
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        } as DailyReportPage;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async transactions(
    context: OrganizationContext,
    branchId: string | null,
    query: TransactionsQueryDto,
  ): Promise<TransactionsPage> {
    const { from, until } = reportRange(query);
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        const resolved = await this.resolveBranches(tx, current, branchId);
        const saleBranchFilter = reportSourceBranchPredicate(
          current,
          's',
          branchId,
        );
        const refundBranchFilter = reportSourceBranchPredicate(
          current,
          'r',
          branchId,
        );

        const offset = (query.page - 1) * query.limit;
        const includeSale =
          !query.type || query.type === ReportTransactionType.SALE;
        const includeRefund =
          !query.type || query.type === ReportTransactionType.REFUND;
        const saleTypeFilter = includeSale
          ? Prisma.empty
          : Prisma.sql`AND FALSE`;
        const refundTypeFilter = includeRefund
          ? Prisma.empty
          : Prisma.sql`AND FALSE`;
        const saleSearch = query.q
          ? Prisma.sql`AND s."receiptCode" ILIKE ${`%${query.q}%`}`
          : Prisma.empty;
        const refundSearch = query.q
          ? Prisma.sql`AND r."refundCode" ILIKE ${`%${query.q}%`}`
          : Prisma.empty;
        const saleMerchantFilter =
          current.role === 'MERCHANT'
            ? current.merchantId
              ? Prisma.sql`AND EXISTS (
                  SELECT 1 FROM "SaleItem" own_sale_item
                  WHERE own_sale_item."organizationId" = ${current.organizationId}
                    AND own_sale_item."branchId" = s."branchId"
                    AND own_sale_item."saleId" = s."id"
                    AND own_sale_item."merchantId" = ${current.merchantId}
                )`
              : Prisma.sql`AND FALSE`
            : Prisma.empty;
        const refundMerchantFilter =
          current.role === 'MERCHANT'
            ? current.merchantId
              ? Prisma.sql`AND EXISTS (
                  SELECT 1 FROM "RefundItem" own_refund_item
                  WHERE own_refund_item."organizationId" = ${current.organizationId}
                    AND own_refund_item."branchId" = r."branchId"
                    AND own_refund_item."refundId" = r."id"
                    AND own_refund_item."saleId" = r."saleId"
                    AND own_refund_item."merchantId" = ${current.merchantId}
                )`
              : Prisma.sql`AND FALSE`
            : Prisma.empty;
        const saleAmount =
          current.role === 'MERCHANT'
            ? Prisma.sql`(
                SELECT COALESCE(SUM(own_sale_amount."lineTotal"), 0)::text
                FROM "SaleItem" own_sale_amount
                WHERE own_sale_amount."organizationId" = ${current.organizationId}
                  AND own_sale_amount."branchId" = s."branchId"
                  AND own_sale_amount."saleId" = s."id"
                  AND own_sale_amount."merchantId" = ${current.merchantId}
              )`
            : Prisma.sql`s."total"::text`;
        const refundAmount =
          current.role === 'MERCHANT'
            ? Prisma.sql`(
                SELECT COALESCE(SUM(own_refund_amount."lineTotal"), 0)::text
                FROM "RefundItem" own_refund_amount
                WHERE own_refund_amount."organizationId" = ${current.organizationId}
                  AND own_refund_amount."branchId" = r."branchId"
                  AND own_refund_amount."refundId" = r."id"
                  AND own_refund_amount."saleId" = r."saleId"
                  AND own_refund_amount."merchantId" = ${current.merchantId}
              )`
            : Prisma.sql`r."total"::text`;
        const saleMerchantNames =
          current.role === 'MERCHANT'
            ? Prisma.sql`ARRAY[]::text[]`
            : Prisma.sql`COALESCE((
                SELECT ARRAY_AGG(DISTINCT sale_merchant."merchantName")
                FROM "SaleItem" sale_merchant
                WHERE sale_merchant."organizationId" = ${current.organizationId}
                  AND sale_merchant."branchId" = s."branchId"
                  AND sale_merchant."saleId" = s."id"
              ), ARRAY[]::text[])`;
        const refundMerchantNames =
          current.role === 'MERCHANT'
            ? Prisma.sql`ARRAY[]::text[]`
            : Prisma.sql`COALESCE((
                SELECT ARRAY_AGG(DISTINCT refund_merchant."merchantName")
                FROM "RefundItem" refund_item
                JOIN "SaleItem" refund_merchant
                  ON refund_merchant."id" = refund_item."saleItemId"
                 AND refund_merchant."organizationId" = refund_item."organizationId"
                 AND refund_merchant."branchId" = refund_item."branchId"
                 AND refund_merchant."saleId" = refund_item."saleId"
                WHERE refund_item."organizationId" = ${current.organizationId}
                  AND refund_item."branchId" = r."branchId"
                  AND refund_item."refundId" = r."id"
                  AND refund_item."saleId" = r."saleId"
              ), ARRAY[]::text[])`;
        const actorName =
          current.role === 'MERCHANT'
            ? Prisma.sql`NULL::text`
            : Prisma.sql`CONCAT(actor."firstName", ' ', actor."lastName")`;
        const salePaymentAccountId =
          current.role === 'MERCHANT'
            ? Prisma.sql`NULL::text`
            : Prisma.sql`s."paymentAccountId"::text`;
        const refundPaymentAccountId =
          current.role === 'MERCHANT'
            ? Prisma.sql`NULL::text`
            : Prisma.sql`r."paymentAccountId"::text`;
        const actorJoin =
          current.role === 'MERCHANT'
            ? Prisma.empty
            : Prisma.sql`JOIN "User" actor ON actor."id" = r."createdById"`;
        const transactionCte = Prisma.sql`
          WITH transaction_rows AS (
            SELECT
              'SALE'::text AS "type",
              s."id" AS "id",
              s."id" AS "saleId",
              NULL::text AS "refundId",
              s."completedAt" AS "completedAt",
              s."receiptCode" AS "reference",
              ${saleAmount} AS "amount",
              ${salePaymentAccountId} AS "paymentAccountId",
              ${current.role === 'MERCHANT' ? Prisma.sql`NULL::text` : Prisma.sql`s."paymentAccountName"`} AS "paymentAccountName",
              ${current.role === 'MERCHANT' ? Prisma.sql`NULL::boolean` : Prisma.sql`s."paymentAccountIsCash"`} AS "paymentAccountIsCash",
              ${current.role === 'MERCHANT' ? Prisma.sql`NULL::boolean` : Prisma.sql`s."paymentAccountRequiresReference"`} AS "paymentAccountRequiresReference",
              ${current.role === 'MERCHANT' ? Prisma.sql`NULL::text` : Prisma.sql`s."cashierName"`} AS "actorName",
              ${saleMerchantNames} AS "merchantNames",
              sale_branch."id" AS "branchId",
              sale_branch."name" AS "branchName",
              sale_branch."code" AS "branchCode"
            FROM "Sale" s
            JOIN "Branch" sale_branch
              ON sale_branch."id" = s."branchId"
             AND sale_branch."organizationId" = s."organizationId"
            WHERE s."organizationId" = ${current.organizationId}
              ${saleBranchFilter}
              AND s."completedAt" >= ${from}
              AND s."completedAt" < ${until}
              ${saleTypeFilter}
              ${saleSearch}
              ${saleMerchantFilter}
            UNION ALL
            SELECT
              'REFUND'::text AS "type",
              r."id" AS "id",
              r."saleId" AS "saleId",
              r."id" AS "refundId",
              r."completedAt" AS "completedAt",
              r."refundCode" AS "reference",
              ${refundAmount} AS "amount",
              ${refundPaymentAccountId} AS "paymentAccountId",
              ${current.role === 'MERCHANT' ? Prisma.sql`NULL::text` : Prisma.sql`r."paymentAccountName"`} AS "paymentAccountName",
              ${current.role === 'MERCHANT' ? Prisma.sql`NULL::boolean` : Prisma.sql`r."paymentAccountIsCash"`} AS "paymentAccountIsCash",
              ${current.role === 'MERCHANT' ? Prisma.sql`NULL::boolean` : Prisma.sql`r."paymentAccountRequiresReference"`} AS "paymentAccountRequiresReference",
              ${actorName} AS "actorName",
              ${refundMerchantNames} AS "merchantNames",
              refund_branch."id" AS "branchId",
              refund_branch."name" AS "branchName",
              refund_branch."code" AS "branchCode"
            FROM "Refund" r
            JOIN "Branch" refund_branch
              ON refund_branch."id" = r."branchId"
             AND refund_branch."organizationId" = r."organizationId"
            ${actorJoin}
            WHERE r."organizationId" = ${current.organizationId}
              ${refundBranchFilter}
              AND r."completedAt" >= ${from}
              AND r."completedAt" < ${until}
              ${refundTypeFilter}
              ${refundSearch}
              ${refundMerchantFilter}
          )
        `;
        const rows = await tx.$queryRaw<TransactionRow[]>(Prisma.sql`
          ${transactionCte}
          SELECT *, COUNT(*) OVER()::int AS "totalCount"
          FROM transaction_rows
          ORDER BY "completedAt" DESC, "type" ASC, "id" DESC
          LIMIT ${query.limit} OFFSET ${offset}
        `);
        let total = rows[0]?.totalCount ?? 0;
        if (!rows.length && query.page > 1) {
          const [count] = await tx.$queryRaw<
            { totalCount: number }[]
          >(Prisma.sql`
            ${transactionCte}
            SELECT COUNT(*)::int AS "totalCount" FROM transaction_rows
          `);
          total = count?.totalCount ?? 0;
        }
        const base = {
          ...this.reportScopeMetadata(resolved),
          from: from.toISOString(),
          until: until.toISOString(),
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        };
        if (current.role === 'MERCHANT')
          return {
            ...base,
            scope: 'MERCHANT' as const,
            items: rows.map(
              ({
                type,
                id,
                saleId,
                refundId,
                completedAt,
                reference,
                amount,
                branchId: sourceBranchId,
                branchName,
                branchCode,
              }) => ({
                type,
                id,
                saleId,
                refundId,
                completedAt,
                reference,
                amount,
                ...(branchId === null
                  ? {
                      branch: {
                        id: sourceBranchId,
                        name: branchName,
                        code: branchCode,
                      },
                    }
                  : {}),
              }),
            ),
          };
        return {
          ...base,
          scope: 'STAFF' as const,
          items: rows.map(
            ({
              type,
              id,
              saleId,
              refundId,
              completedAt,
              reference,
              amount,
              paymentAccountId,
              paymentAccountName,
              paymentAccountIsCash,
              paymentAccountRequiresReference,
              actorName,
              merchantNames,
              branchId: sourceBranchId,
              branchName,
              branchCode,
            }) => ({
              type,
              id,
              saleId,
              refundId,
              completedAt,
              reference,
              amount,
              paymentAccountId: paymentAccountId!,
              paymentAccountName: paymentAccountName!,
              paymentAccountIsCash: paymentAccountIsCash!,
              paymentAccountRequiresReference: paymentAccountRequiresReference!,
              actorName: actorName!,
              merchantNames,
              ...(branchId === null
                ? {
                    branch: {
                      id: sourceBranchId,
                      name: branchName,
                      code: branchCode,
                    },
                  }
                : {}),
            }),
          ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async analytics(
    context: OrganizationContext,
    branchId: string | null,
    query: SalesReportQueryDto,
  ): Promise<SalesAnalytics> {
    return this.read(context, branchId, query, true) as Promise<SalesAnalytics>;
  }

  async rankings(
    context: OrganizationContext,
    branchId: string | null,
    query: SalesRankingQueryDto,
  ): Promise<SalesRankingPage> {
    const { from, until } = reportRange(query);
    const page = query.page ?? 1;
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        const resolved = await this.resolveBranches(tx, current, branchId);
        const sortBy = query.sortBy ?? SalesRankingSortBy.GROSS_SALES;
        const merchantId = query.merchantId;
        if (current.role === 'MERCHANT' && merchantId) {
          throw new BadRequestException(
            'Merchant accounts cannot select a merchant ranking filter',
          );
        }
        if (current.role !== 'MERCHANT' && merchantId) {
          const merchant = await tx.merchant.findFirst({
            where: {
              AND: [merchantScope(current), { id: merchantId }],
            },
            select: { id: true },
          });
          if (!merchant) throw new NotFoundException('Merchant not found');
        }
        const ranking = await readProductRankings(
          tx,
          current,
          branchId,
          from,
          until,
          page,
          sortBy,
          merchantId,
        );
        const own = current.role === 'MERCHANT';
        const items = ranking.rows.map((row) => {
          const identity = {
            productId: row.productId,
            productName: row.productName,
            sku: row.sku,
            barcode: row.barcode,
            merchantName: row.merchantName,
          };
          const net = netRecordedSales(row.grossSales, row.refundedAmount);
          return own
            ? {
                ...identity,
                ownGrossSales: row.grossSales,
                ownUnitsSold: row.unitsSold,
                ownRefundedAmount: row.refundedAmount,
                ownReturnedUnits: row.returnedUnits,
                ownNetRecordedSales: net,
              }
            : {
                ...identity,
                grossSales: row.grossSales,
                unitsSold: row.unitsSold,
                refundedAmount: row.refundedAmount,
                returnedUnits: row.returnedUnits,
                netRecordedSales: net,
              };
        });
        return {
          ...this.reportScopeMetadata(resolved),
          from: from.toISOString(),
          until: until.toISOString(),
          sortBy,
          merchantId: merchantId ?? null,
          page,
          limit: PRODUCT_RANKING_PAGE_SIZE,
          totalProducts: ranking.totalProducts,
          totalPages: Number(
            (BigInt(ranking.totalProducts) +
              BigInt(PRODUCT_RANKING_PAGE_SIZE) -
              1n) /
              BigInt(PRODUCT_RANKING_PAGE_SIZE),
          ),
          hasNext:
            BigInt(page * PRODUCT_RANKING_PAGE_SIZE) <
            BigInt(ranking.totalProducts),
          scope: own ? ('MERCHANT' as const) : ('STAFF' as const),
          items,
        } as SalesRankingPage;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async read(
    context: OrganizationContext,
    branchId: string | null,
    query: SalesReportQueryDto,
    analytics: boolean,
  ) {
    const { from, until } = reportRange(query);
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        const resolved = await this.resolveBranches(tx, current, branchId);
        const range = {
          ...this.reportScopeMetadata(resolved),
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
          WHERE i."organizationId" = ${current.organizationId}
            AND i."merchantId" = ${current.merchantId}
            AND s."organizationId" = ${current.organizationId} ${reportSourceBranchPredicate(current, 's', branchId)}
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
          SELECT sale."id", sale."organizationId", sale."branchId", sale."total" FROM "Sale" sale
          WHERE sale."organizationId" = ${current.organizationId} ${reportSourceBranchPredicate(current, 'sale', branchId)}
            AND sale."completedAt" >= ${from} AND sale."completedAt" < ${until}
        )
        SELECT COALESCE(SUM(matched."total")::text, '0.00') AS "grossSales", COUNT(*)::text AS "transactionCount",
          (SELECT COALESCE(SUM(i."quantity"::numeric)::text, '0') FROM "SaleItem" i JOIN matched s
            ON s."id" = i."saleId" AND s."organizationId" = i."organizationId" AND s."branchId" = i."branchId"
           WHERE i."organizationId" = ${current.organizationId}) AS "unitsSold"
        FROM matched
      `);
        const [refunds] = await tx.$queryRaw<RefundAggregate[]>(Prisma.sql`
          WITH matched_refunds AS (
            SELECT refund."id", refund."organizationId", refund."branchId", refund."total" FROM "Refund" refund
            WHERE refund."organizationId" = ${current.organizationId} ${reportSourceBranchPredicate(current, 'refund', branchId)}
              AND refund."completedAt" >= ${from} AND refund."completedAt" < ${until}
          )
          SELECT COALESCE(SUM(matched_refunds."total")::text, '0.00') AS "refundedAmount", COUNT(*)::text AS "refundCount",
            (SELECT COALESCE(SUM(i."quantity"::numeric)::text, '0') FROM "RefundItem" i JOIN matched_refunds r
              ON r."id" = i."refundId" AND r."organizationId" = i."organizationId" AND r."branchId" = i."branchId"
             WHERE i."organizationId" = ${current.organizationId}) AS "returnedUnits"
          FROM matched_refunds
        `);
        const paymentAccounts = await readPaymentAccounts(
          tx,
          current,
          branchId,
          from,
          until,
        );
        return {
          ...range,
          scope: 'STAFF' as const,
          ...summary,
          paymentAccounts,
          ...refunds,
          netRecordedSales: netRecordedSales(
            summary.grossSales,
            refunds.refundedAmount,
          ),
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
    branchId: string | null,
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
      WHERE i."organizationId" = ${context.organizationId} AND i."merchantId" = ${context.merchantId}
        AND r."organizationId" = ${context.organizationId} ${reportSourceBranchPredicate(context, 'r', branchId)}
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

  private async resolveBranches(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    branchId: string | null,
  ): Promise<ResolvedBranches> {
    const where = this.reportBranchScope(context);
    if (branchId !== null) {
      const branch = await tx.branch.findFirst({
        where: { AND: [where, { id: branchId }] },
        select: identitySelect,
      });
      if (!branch) throw new NotFoundException('Branch not found');
      return { branch };
    }
    const branchCount = await tx.branch.count({ where });
    return {
      reportScope: 'ALL',
      branchCount,
    };
  }

  private reportScopeMetadata(resolved: ResolvedBranches) {
    return resolved.reportScope === 'ALL'
      ? { reportScope: resolved.reportScope, branchCount: resolved.branchCount }
      : { branch: resolved.branch };
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
        user: { deletedAt: null, emailVerifiedAt: { not: null } },
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
        branchScope(context),
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
