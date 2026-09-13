import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { branchScope } from '../authorization/resource-access';
import type { OrganizationContext } from '../authorization/organization-authorization.types';

export const posCatalogSelect = {
  id: true,
  sellingPrice: true,
  quantity: true,
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      merchant: { select: { name: true } },
    },
  },
} satisfies Prisma.BranchInventorySelect;

@Injectable()
export class PosCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(context: OrganizationContext, branchId: string, q?: string) {
    return this.read(
      context,
      branchId,
      q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
              { barcode: { contains: q } },
            ],
          }
        : {},
      100,
    );
  }

  async findByCode(
    context: OrganizationContext,
    branchId: string,
    code: string,
  ) {
    return this.read(context, branchId, {
      OR: [{ sku: code.toUpperCase() }, { barcode: code }],
    });
  }

  private async read(
    context: OrganizationContext,
    branchId: string,
    filter: Prisma.ProductWhereInput,
    take?: number,
  ) {
    if (!['OWNER', 'MANAGER', 'CASHIER'].includes(context.role))
      throw new ForbiddenException('Your organization role cannot access POS');
    const scope = branchScope(context);
    if (
      !(await this.prisma.branch.findFirst({
        where: { AND: [scope, { id: branchId }] },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Branch not found');
    const rows = await this.prisma.branchInventory.findMany({
      where: {
        organizationId: context.organizationId,
        branchId,
        branch: scope,
        product: {
          AND: [
            {
              organizationId: context.organizationId,
              status: 'ACTIVE',
              merchant: {
                organizationId: context.organizationId,
                status: 'ACTIVE',
              },
            },
            filter,
          ],
        },
      },
      select: posCatalogSelect,
      orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      ...(take ? { take } : {}),
    });
    return rows.map((row) => ({
      branchInventoryId: row.id,
      productId: row.product.id,
      name: row.product.name,
      sku: row.product.sku,
      barcode: row.product.barcode,
      merchantName: row.product.merchant.name,
      sellingPrice: row.sellingPrice.toFixed(2),
      quantity: row.quantity,
      eligible: row.quantity > 0,
    }));
  }
}
