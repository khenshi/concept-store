import { Prisma } from '../../../generated/prisma/client';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { ApiProperty } from '@nestjs/swagger';
import {
  reportBranchAccessPredicate,
  reportSourceBranchPredicate,
} from './report-sql-scope';

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
  branchId: string | null,
  from: Date,
  until: Date,
) {
  const availableBranchPredicate =
    branchId === null
      ? reportBranchAccessPredicate(context, 'available_branch')
      : Prisma.sql`AND available_branch."id" = ${branchId}`;
  return tx.$queryRaw<ReportPaymentAccountDto[]>(Prisma.sql`
    WITH sales AS (
      SELECT sale."paymentAccountId", SUM(sale."total") AS received, COUNT(*) AS transactions
      FROM "Sale" sale
      WHERE sale."organizationId" = ${context.organizationId} ${reportSourceBranchPredicate(context, 'sale', branchId)}
        AND sale."completedAt" >= ${from} AND sale."completedAt" < ${until}
      GROUP BY sale."paymentAccountId"
    ), refunds AS (
      SELECT refund."paymentAccountId", SUM(refund."total") AS refunded, COUNT(*) AS refunds
      FROM "Refund" refund
      WHERE refund."organizationId" = ${context.organizationId} ${reportSourceBranchPredicate(context, 'refund', branchId)}
        AND refund."completedAt" >= ${from} AND refund."completedAt" < ${until}
      GROUP BY refund."paymentAccountId"
    ), accounts AS (
      SELECT a.*, (a."enabled" AND (
        (a."assignmentMode" = 'ALL' AND EXISTS (
          SELECT 1 FROM "Branch" available_branch
          WHERE available_branch."organizationId" = ${context.organizationId}
            ${availableBranchPredicate}
        )) OR EXISTS (
          SELECT 1 FROM "PaymentAccountBranch" assignment
          JOIN "Branch" available_branch
            ON available_branch."id" = assignment."branchId"
           AND available_branch."organizationId" = assignment."organizationId"
          WHERE assignment."organizationId" = ${context.organizationId}
            AND assignment."paymentAccountId" = a."id"
            ${availableBranchPredicate}
        )
      )) AS available
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
