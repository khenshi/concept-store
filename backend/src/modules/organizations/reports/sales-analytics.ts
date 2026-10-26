import { Prisma } from '../../../generated/prisma/client';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { SalesRankingSortBy } from './dto/sales-report-query.dto';
import { netRecordedSales } from './report-money';
import { reportSourceBranchPredicate } from './report-sql-scope';
import {
  calendarDay,
  reportDates,
  reportGranularity,
  type ReportGranularity,
} from './report-period';

type Metrics = {
  grossSales: string;
  unitsSold: string;
  refundedAmount: string;
  returnedUnits: string;
};
type Daily = Metrics & {
  date: string;
  transactionCount: string;
  refundCount: string;
};
type Hourly = Metrics & {
  hour: number;
  transactionCount: string;
  refundCount: string;
};
type Product = Metrics & {
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  merchantName: string;
  totalProducts: string;
};
export const PRODUCT_RANKING_PAGE_SIZE = 15;
type MerchantSales = {
  merchantId: string;
  merchantName: string;
  grossSales: string;
};
const zero = {
  grossSales: '0.00',
  unitsSold: '0',
  refundedAmount: '0.00',
  returnedUnits: '0',
};
export function intersectingManilaDates(from: Date, until: Date): string[] {
  return reportDates(from, until, 'DAY');
}

function metrics(row: Metrics, own: boolean) {
  const net = netRecordedSales(row.grossSales, row.refundedAmount);
  return own
    ? {
        ownGrossSales: row.grossSales,
        ownUnitsSold: row.unitsSold,
        ownRefundedAmount: row.refundedAmount,
        ownReturnedUnits: row.returnedUnits,
        ownNetRecordedSales: net,
      }
    : {
        grossSales: row.grossSales,
        unitsSold: row.unitsSold,
        refundedAmount: row.refundedAmount,
        returnedUnits: row.returnedUnits,
        netRecordedSales: net,
      };
}

export async function readProductRankings(
  tx: Prisma.TransactionClient,
  context: OrganizationContext,
  branchId: string | null,
  from: Date,
  until: Date,
  page: number,
  sortBy: SalesRankingSortBy = SalesRankingSortBy.GROSS_SALES,
  merchantId?: string,
) {
  const own = context.role === 'MERCHANT';
  if (own && !context.merchantId)
    return { rows: [] as Product[], totalProducts: '0' };
  const effectiveMerchantId = own ? context.merchantId! : merchantId;
  const merchantFilter = effectiveMerchantId
    ? Prisma.sql`AND i."merchantId" = ${effectiveMerchantId}`
    : Prisma.empty;
  const offset = (page - 1) * PRODUCT_RANKING_PAGE_SIZE;
  const productCte = Prisma.sql`
    WITH sale_items AS (
      SELECT i."productId", i."id", i."productName", i."sku", i."barcode", i."merchantName", i."lineTotal", i."quantity", s."completedAt" AS original_date
      FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId" AND s."organizationId" = i."organizationId" AND s."branchId" = i."branchId"
      WHERE s."organizationId" = ${context.organizationId} ${reportSourceBranchPredicate(context, 's', branchId)}
        AND s."completedAt" >= ${from} AND s."completedAt" < ${until} ${merchantFilter}
    ), refund_items AS (
      SELECT source."productId", source."id", source."productName", source."sku", source."barcode", source."merchantName",
        s."completedAt" AS original_date, i."lineTotal", i."quantity"
      FROM "RefundItem" i JOIN "Refund" r ON r."id" = i."refundId" AND r."organizationId" = i."organizationId" AND r."branchId" = i."branchId" AND r."saleId" = i."saleId"
      JOIN "SaleItem" source ON source."id" = i."saleItemId" AND source."organizationId" = i."organizationId" AND source."branchId" = i."branchId" AND source."saleId" = i."saleId" AND source."merchantId" = i."merchantId"
      JOIN "Sale" s ON s."id" = source."saleId" AND s."organizationId" = source."organizationId" AND s."branchId" = source."branchId"
      WHERE r."organizationId" = ${context.organizationId} ${reportSourceBranchPredicate(context, 'r', branchId)}
        AND r."completedAt" >= ${from} AND r."completedAt" < ${until} ${merchantFilter}
    ), identities AS (
      SELECT DISTINCT ON ("productId") * FROM (
        SELECT "productId", "id", "productName", "sku", "barcode", "merchantName", original_date FROM sale_items
        UNION ALL
        SELECT "productId", "id", "productName", "sku", "barcode", "merchantName", original_date FROM refund_items
      ) contributing ORDER BY "productId", original_date DESC, "id" DESC
    ), sales AS (
      SELECT "productId", SUM("lineTotal") AS gross, SUM("quantity"::numeric) AS units FROM sale_items GROUP BY "productId"
    ), refunds AS (
      SELECT "productId", SUM("lineTotal") AS refunded, SUM("quantity"::numeric) AS returned FROM refund_items GROUP BY "productId"
    )
  `;
  const orderBy =
    sortBy === SalesRankingSortBy.UNITS_SOLD
      ? Prisma.sql`COALESCE(s.units, 0) DESC, COALESCE(s.gross, 0) DESC, n."productId" ASC`
      : Prisma.sql`COALESCE(s.gross, 0) DESC, COALESCE(s.units, 0) DESC, n."productId" ASC`;
  const rows = await tx.$queryRaw<Product[]>(Prisma.sql`
    ${productCte}
    SELECT n."productId", n."productName", n."sku", n."barcode", n."merchantName",
      COALESCE(s.gross::text, '0.00') AS "grossSales", COALESCE(s.units::text, '0') AS "unitsSold",
      COALESCE(r.refunded::text, '0.00') AS "refundedAmount", COALESCE(r.returned::text, '0') AS "returnedUnits",
      COUNT(*) OVER ()::text AS "totalProducts"
    FROM identities n LEFT JOIN sales s USING ("productId") LEFT JOIN refunds r USING ("productId")
    ORDER BY ${orderBy}
    LIMIT ${PRODUCT_RANKING_PAGE_SIZE} OFFSET ${offset}
  `);
  let totalProducts = rows[0]?.totalProducts ?? '0';
  if (!rows.length && page > 1) {
    const [count] = await tx.$queryRaw<{ totalProducts: string }[]>(Prisma.sql`
      ${productCte}
      SELECT COUNT(*)::text AS "totalProducts" FROM identities
    `);
    totalProducts = count?.totalProducts ?? '0';
  }
  return { rows, totalProducts };
}

// Called only after fresh branch authorization, inside the summary's RepeatableRead transaction.
export async function readTrends(
  tx: Prisma.TransactionClient,
  context: OrganizationContext,
  branchId: string | null,
  from: Date,
  until: Date,
  granularity: ReportGranularity,
) {
  const own = context.role === 'MERCHANT';
  const merchantFilter = own
    ? Prisma.sql`AND i."merchantId" = ${context.merchantId}`
    : Prisma.empty;
  const daily: Daily[] =
    own && !context.merchantId
      ? []
      : await tx.$queryRaw<Daily[]>(Prisma.sql`
    WITH sales AS (
      SELECT date_trunc(${granularity.toLowerCase()}, (s."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'))::date::text AS date,
        SUM(i."lineTotal") AS gross, SUM(i."quantity"::numeric) AS units,
        COUNT(DISTINCT s."id") AS transactions
      FROM "Sale" s JOIN "SaleItem" i ON i."saleId" = s."id" AND i."organizationId" = s."organizationId" AND i."branchId" = s."branchId"
      WHERE s."organizationId" = ${context.organizationId} ${reportSourceBranchPredicate(context, 's', branchId)}
        AND s."completedAt" >= ${from} AND s."completedAt" < ${until} ${merchantFilter}
      GROUP BY 1
    ), refunds AS (
      SELECT date_trunc(${granularity.toLowerCase()}, (r."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'))::date::text AS date,
        SUM(i."lineTotal") AS refunded, SUM(i."quantity"::numeric) AS returned,
        COUNT(DISTINCT r."id") AS refunds
      FROM "Refund" r JOIN "RefundItem" i ON i."refundId" = r."id" AND i."organizationId" = r."organizationId" AND i."branchId" = r."branchId" AND i."saleId" = r."saleId"
      WHERE r."organizationId" = ${context.organizationId} ${reportSourceBranchPredicate(context, 'r', branchId)}
        AND r."completedAt" >= ${from} AND r."completedAt" < ${until} ${merchantFilter}
      GROUP BY 1
    )
    SELECT COALESCE(s.date, r.date) AS date,
      COALESCE(s.gross::text, '0.00') AS "grossSales", COALESCE(s.units::text, '0') AS "unitsSold",
      COALESCE(s.transactions::text, '0') AS "transactionCount",
      COALESCE(r.refunded::text, '0.00') AS "refundedAmount", COALESCE(r.returned::text, '0') AS "returnedUnits",
      COALESCE(r.refunds::text, '0') AS "refundCount"
    FROM sales s FULL OUTER JOIN refunds r ON r.date = s.date
  `);
  const byDate = new Map(daily.map((row) => [row.date, row]));
  return reportDates(from, until, granularity).map((date) => {
    const row = byDate.get(date) ?? {
      ...zero,
      date,
      transactionCount: '0',
      refundCount: '0',
    };
    return {
      date,
      ...metrics(row, own),
      ...(own
        ? {
            ownTransactionCount: row.transactionCount,
            ownRefundCount: row.refundCount,
          }
        : {
            transactionCount: row.transactionCount,
            refundCount: row.refundCount,
          }),
    };
  });
}

export async function readAnalytics(
  tx: Prisma.TransactionClient,
  context: OrganizationContext,
  branchId: string | null,
  from: Date,
  until: Date,
) {
  const own = context.role === 'MERCHANT';
  const granularity = reportGranularity(from, until);
  const dailyTrends = await readTrends(
    tx,
    context,
    branchId,
    from,
    until,
    granularity,
  );
  const includeHourly =
    !own && calendarDay(from) === calendarDay(new Date(until.getTime() - 1));
  const hourly: Hourly[] = includeHourly
    ? await tx.$queryRaw<Hourly[]>(Prisma.sql`
    WITH sales AS (
      SELECT EXTRACT(HOUR FROM (s."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'))::int AS hour,
        SUM(i."lineTotal") AS gross, SUM(i."quantity"::numeric) AS units,
        COUNT(DISTINCT s."id") AS transactions
      FROM "Sale" s JOIN "SaleItem" i ON i."saleId" = s."id" AND i."organizationId" = s."organizationId" AND i."branchId" = s."branchId"
      WHERE s."organizationId" = ${context.organizationId} ${reportSourceBranchPredicate(context, 's', branchId)}
        AND s."completedAt" >= ${from} AND s."completedAt" < ${until}
      GROUP BY 1
    ), refunds AS (
      SELECT EXTRACT(HOUR FROM (r."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'))::int AS hour,
        SUM(i."lineTotal") AS refunded, SUM(i."quantity"::numeric) AS returned,
        COUNT(DISTINCT r."id") AS refunds
      FROM "Refund" r JOIN "RefundItem" i ON i."refundId" = r."id" AND i."organizationId" = r."organizationId" AND i."branchId" = r."branchId" AND i."saleId" = r."saleId"
      WHERE r."organizationId" = ${context.organizationId} ${reportSourceBranchPredicate(context, 'r', branchId)}
        AND r."completedAt" >= ${from} AND r."completedAt" < ${until}
      GROUP BY 1
    )
    SELECT COALESCE(s.hour, r.hour)::int AS hour,
      COALESCE(s.gross::text, '0.00') AS "grossSales", COALESCE(s.units::text, '0') AS "unitsSold",
      COALESCE(s.transactions::text, '0') AS "transactionCount",
      COALESCE(r.refunded::text, '0.00') AS "refundedAmount", COALESCE(r.returned::text, '0') AS "returnedUnits",
      COALESCE(r.refunds::text, '0') AS "refundCount"
    FROM sales s FULL OUTER JOIN refunds r ON r.hour = s.hour
    ORDER BY 1
  `)
    : [];
  const { rows: products, totalProducts } = await readProductRankings(
    tx,
    context,
    branchId,
    from,
    until,
    1,
  );
  const topMerchants: MerchantSales[] = own
    ? []
    : await tx.$queryRaw<MerchantSales[]>(Prisma.sql`
    WITH matched_items AS (
      SELECT i."merchantId", i."merchantName", i."lineTotal", i."id",
        s."completedAt"
      FROM "SaleItem" i
      JOIN "Sale" s ON s."id" = i."saleId"
        AND s."organizationId" = i."organizationId"
        AND s."branchId" = i."branchId"
      WHERE i."organizationId" = ${context.organizationId}
        ${reportSourceBranchPredicate(context, 's', branchId)}
        AND s."completedAt" >= ${from} AND s."completedAt" < ${until}
    ), sales AS (
      SELECT "merchantId", SUM("lineTotal") AS gross
      FROM matched_items GROUP BY "merchantId"
    ), names AS (
      SELECT DISTINCT ON ("merchantId") "merchantId", "merchantName"
      FROM matched_items
      ORDER BY "merchantId", "completedAt" DESC, "id" DESC
    )
    SELECT sales."merchantId", names."merchantName",
      sales.gross::text AS "grossSales"
    FROM sales JOIN names USING ("merchantId")
    ORDER BY sales.gross DESC, sales."merchantId" ASC
    LIMIT 10
  `);
  const byHour = new Map(hourly.map((row) => [row.hour, row]));
  return {
    dailyTrends,
    ...(granularity === 'DAY' ? {} : { granularity }),
    ...(!includeHourly
      ? {}
      : {
          hourlyTrends: Array.from({ length: 24 }, (_, hour) => {
            const row = byHour.get(hour) ?? {
              ...zero,
              hour,
              transactionCount: '0',
              refundCount: '0',
            };
            return {
              hour,
              ...metrics(row, false),
              transactionCount: row.transactionCount,
              refundCount: row.refundCount,
            };
          }),
        }),
    topProducts: products.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      barcode: row.barcode,
      merchantName: row.merchantName,
      ...metrics(row, own),
    })),
    ...(!own ? { topMerchants } : {}),
    totalProducts,
  };
}
