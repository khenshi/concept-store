import { OrganizationRole, Prisma } from '../../../generated/prisma/client';
import type { OrganizationContext } from './organization-authorization.types';

export function branchScope(
  context: OrganizationContext,
): Prisma.BranchWhereInput {
  const { organizationId, userId, role, merchantId } = context;
  if (role === OrganizationRole.OWNER) return { organizationId };
  const assigned = { memberships: { some: { organizationId, userId } } };
  if (role !== OrganizationRole.MERCHANT)
    return { organizationId, ...assigned };
  if (!merchantId) return { organizationId, id: { in: [] } };
  return {
    organizationId,
    OR: [
      assigned,
      {
        inventory: {
          some: { organizationId, product: { organizationId, merchantId } },
        },
      },
    ],
  };
}

export function productScope(
  context: OrganizationContext,
): Prisma.ProductWhereInput {
  const { organizationId, role, merchantId, userId } = context;
  if (role === OrganizationRole.OWNER) return { organizationId };
  if (role === OrganizationRole.MANAGER)
    return {
      organizationId,
      inventory: {
        some: {
          organizationId,
          branch: { memberships: { some: { organizationId, userId } } },
        },
      },
    };
  return {
    organizationId,
    ...(role === OrganizationRole.MERCHANT && merchantId
      ? { merchantId }
      : { id: { in: [] } }),
  };
}

export function merchantScope(
  context: OrganizationContext,
): Prisma.MerchantWhereInput {
  const { organizationId, role, merchantId } = context;
  if (role === OrganizationRole.OWNER) return { organizationId };
  if (role === OrganizationRole.MANAGER)
    return { organizationId, products: { some: productScope(context) } };
  return {
    organizationId,
    id:
      role === OrganizationRole.MERCHANT && merchantId
        ? merchantId
        : { in: [] },
  };
}

export function inventoryScope(
  context: OrganizationContext,
): Prisma.BranchInventoryWhereInput {
  return {
    organizationId: context.organizationId,
    branch: branchScope(context),
    product: productScope(context),
  };
}
