import { Prisma } from '../../../generated/prisma/client';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { netRecordedSales } from './report-money';

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
type Product = Metrics & {
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  merchantName: string;
  totalProducts: string;
};
const zero = {
  grossSales: '0.00',
  unitsSold: '0',
  refundedAmount: '0.00',
  returnedUnits: '0',
};
const dayMs = 86400000;
const manilaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function calendarDay(date: Date) {
  const parts = manilaDate.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)!.value;
  return (
    Date.parse(
      `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}T00:00:00Z`,
    ) / dayMs
  );
}

export function intersectingManilaDates(from: Date, until: Date): string[] {
  const first = calendarDay(from);
  const last = calendarDay(new Date(until.getTime() - 1));
  return Array.from({ length: last - first + 1 }, (_, index) =>
    new Date((first + index) * dayMs).toISOString().slice(0, 10),
  );
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

// Called only after fresh branch authorization, inside the summary's RepeatableRead transaction.
export async function readAnalytics(
  tx: Prisma.TransactionClient,
  context: OrganizationContext,
  branchId: string,
  from: Date,
  until: Date,
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
      SELECT (s."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date::text AS date,
        SUM(i."lineTotal") AS gross, SUM(i."quantity"::numeric) AS units,
        COUNT(DISTINCT s."id") AS transactions
      FROM "Sale" s JOIN "SaleItem" i ON i."saleId" = s."id" AND i."organizationId" = s."organizationId" AND i."branchId" = s."branchId"
      WHERE s."organizationId" = ${context.organizationId} AND s."branchId" = ${branchId}
        AND s."completedAt" >= ${from} AND s."completedAt" < ${until} ${merchantFilter}
      GROUP BY 1
    ), refunds AS (
      SELECT (r."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date::text AS date,
        SUM(i."lineTotal") AS refunded, SUM(i."quantity"::numeric) AS returned,
        COUNT(DISTINCT r."id") AS refunds
      FROM "Refund" r JOIN "RefundItem" i ON i."refundId" = r."id" AND i."organizationId" = r."organizationId" AND i."branchId" = r."branchId" AND i."saleId" = r."saleId"
      WHERE r."organizationId" = ${context.organizationId} AND r."branchId" = ${branchId}
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
  const products: Product[] =
    own && !context.merchantId
      ? []
      : await tx.$queryRaw<Product[]>(Prisma.sql`
    WITH sale_items AS (
      SELECT i."productId", i."id", i."productName", i."sku", i."barcode", i."merchantName", i."lineTotal", i."quantity", s."completedAt" AS original_date
      FROM "SaleItem" i JOIN "Sale" s ON s."id" = i."saleId" AND s."organizationId" = i."organizationId" AND s."branchId" = i."branchId"
      WHERE s."organizationId" = ${context.organizationId} AND s."branchId" = ${branchId}
        AND s."completedAt" >= ${from} AND s."completedAt" < ${until} ${merchantFilter}
    ), refund_items AS (
      SELECT source."productId", source."id", source."productName", source."sku", source."barcode", source."merchantName",
        s."completedAt" AS original_date, i."lineTotal", i."quantity"
      FROM "RefundItem" i JOIN "Refund" r ON r."id" = i."refundId" AND r."organizationId" = i."organizationId" AND r."branchId" = i."branchId" AND r."saleId" = i."saleId"
      JOIN "SaleItem" source ON source."id" = i."saleItemId" AND source."organizationId" = i."organizationId" AND source."branchId" = i."branchId" AND source."saleId" = i."saleId" AND source."merchantId" = i."merchantId"
      JOIN "Sale" s ON s."id" = source."saleId" AND s."organizationId" = source."organizationId" AND s."branchId" = source."branchId"
      WHERE r."organizationId" = ${context.organizationId} AND r."branchId" = ${branchId}
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
    SELECT n."productId", n."productName", n."sku", n."barcode", n."merchantName",
      COALESCE(s.gross::text, '0.00') AS "grossSales", COALESCE(s.units::text, '0') AS "unitsSold",
      COALESCE(r.refunded::text, '0.00') AS "refundedAmount", COALESCE(r.returned::text, '0') AS "returnedUnits",
      COUNT(*) OVER ()::text AS "totalProducts"
    FROM identities n LEFT JOIN sales s USING ("productId") LEFT JOIN refunds r USING ("productId")
    ORDER BY COALESCE(s.gross, 0) DESC, COALESCE(s.units, 0) DESC, n."productId" ASC LIMIT 10
  `);
  const byDate = new Map(daily.map((row) => [row.date, row]));
  return {
    dailyTrends: intersectingManilaDates(from, until).map((date) => {
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
    }),
    topProducts: products.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      barcode: row.barcode,
      merchantName: row.merchantName,
      ...metrics(row, own),
    })),
    totalProducts: products[0]?.totalProducts ?? '0',
  };
}
