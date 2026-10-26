import { Prisma } from '../../../generated/prisma/client';
import type { OrganizationContext } from '../authorization/organization-authorization.types';

type BranchAlias = 'available_branch' | 'authorized_branch';
type SourceAlias = 's' | 'r' | 'sale' | 'refund';

export function reportBranchAccessPredicate(
  context: OrganizationContext,
  alias: BranchAlias,
) {
  const branch = Prisma.raw(alias);
  if (context.role === 'OWNER')
    return Prisma.sql`AND ${branch}."organizationId" = ${context.organizationId}`;
  if (context.role === 'MANAGER')
    return Prisma.sql`
      AND ${branch}."organizationId" = ${context.organizationId}
      AND EXISTS (
        SELECT 1 FROM "BranchMembership" membership
        WHERE membership."organizationId" = ${context.organizationId}
          AND membership."branchId" = ${branch}."id"
          AND membership."userId" = ${context.userId}
      )
    `;
  if (!context.merchantId) return Prisma.sql`AND FALSE`;
  return Prisma.sql`
    AND ${branch}."organizationId" = ${context.organizationId}
    AND (
      EXISTS (
        SELECT 1 FROM "MerchantBranch" affiliation
        WHERE affiliation."organizationId" = ${context.organizationId}
          AND affiliation."branchId" = ${branch}."id"
          AND affiliation."merchantId" = ${context.merchantId}
      )
      OR EXISTS (
        SELECT 1 FROM "Sale" historical_sale
        JOIN "SaleItem" historical_item
          ON historical_item."organizationId" = historical_sale."organizationId"
         AND historical_item."branchId" = historical_sale."branchId"
         AND historical_item."saleId" = historical_sale."id"
        WHERE historical_sale."organizationId" = ${context.organizationId}
          AND historical_sale."branchId" = ${branch}."id"
          AND historical_item."merchantId" = ${context.merchantId}
      )
    )
  `;
}

export function reportSourceBranchPredicate(
  context: OrganizationContext,
  alias: SourceAlias,
  branchId: string | null,
) {
  const source = Prisma.raw(alias);
  if (branchId !== null)
    return Prisma.sql`
      AND ${source}."organizationId" = ${context.organizationId}
      AND ${source}."branchId" = ${branchId}
    `;
  return Prisma.sql`
    AND EXISTS (
      SELECT 1 FROM "Branch" authorized_branch
      WHERE authorized_branch."id" = ${source}."branchId"
        AND authorized_branch."organizationId" = ${context.organizationId}
        ${reportBranchAccessPredicate(context, 'authorized_branch')}
    )
  `;
}
