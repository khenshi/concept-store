import { Prisma } from '../../../generated/prisma/client';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { ApiProperty } from '@nestjs/swagger';

export class ReportPaymentAccountDto {
  @ApiProperty({ format: 'uuid' }) accountId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() available!: boolean;
  @ApiProperty() isCash!: boolean;
  @ApiProperty({ example: '1000.00' }) received!: string;
  @ApiProperty({ example: '200.00' }) refunded!: string;
  @ApiProperty({ example: '-200.00' }) netReceived!: string;
  @ApiProperty({ example: '1' }) transactionCount!: string;
  @ApiProperty({ example: '1' }) refundCount!: string;
}

export function readPaymentAccounts(
  tx: Prisma.TransactionClient,
  context: OrganizationContext,
  branchId: string,
  from: Date,
  until: Date,
) {
  return tx.$queryRaw<ReportPaymentAccountDto[]>(Prisma.sql`
    WITH sales AS (
      SELECT "paymentAccountId", SUM("total") AS received, COUNT(*) AS transactions
      FROM "Sale"
      WHERE "organizationId" = ${context.organizationId} AND "branchId" = ${branchId}
        AND "completedAt" >= ${from} AND "completedAt" < ${until}
      GROUP BY "paymentAccountId"
    ), refunds AS (
      SELECT "paymentAccountId", SUM("total") AS refunded, COUNT(*) AS refunds
      FROM "Refund"
      WHERE "organizationId" = ${context.organizationId} AND "branchId" = ${branchId}
        AND "completedAt" >= ${from} AND "completedAt" < ${until}
      GROUP BY "paymentAccountId"
    ), accounts AS (
      SELECT a.*, (a."enabled" AND (a."assignmentMode" = 'ALL' OR EXISTS (
        SELECT 1 FROM "PaymentAccountBranch" b WHERE b."organizationId" = ${context.organizationId}
          AND b."paymentAccountId" = a."id" AND b."branchId" = ${branchId}
      ))) AS available
      FROM "PaymentAccount" a WHERE a."organizationId" = ${context.organizationId}
    )
    SELECT a."id" AS "accountId", a."name" AS "displayName", a."enabled", a.available,
      (a."systemKey" = 'CASH') IS TRUE AS "isCash",
      COALESCE(s.received, 0)::numeric(65,2)::text AS received,
      COALESCE(r.refunded, 0)::numeric(65,2)::text AS refunded,
      (COALESCE(s.received, 0) - COALESCE(r.refunded, 0))::numeric(65,2)::text AS "netReceived",
      COALESCE(s.transactions, 0)::text AS "transactionCount", COALESCE(r.refunds, 0)::text AS "refundCount"
    FROM accounts a LEFT JOIN sales s ON s."paymentAccountId" = a."id"
    LEFT JOIN refunds r ON r."paymentAccountId" = a."id"
    WHERE a.available OR s."paymentAccountId" IS NOT NULL OR r."paymentAccountId" IS NOT NULL
    ORDER BY a."name", a."id"
  `);
}
