import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { branchScope } from '../authorization/resource-access';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import type { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { completedSaleResponse, completedSaleSelect } from './sales.types';

const ExactDecimal = Prisma.Decimal.clone({ precision: 40 });
export const merchantSaleItemSelect = {
  id: true,
  productId: true,
  productName: true,
  sku: true,
  barcode: true,
  merchantName: true,
  quantity: true,
  unitPrice: true,
  lineTotal: true,
} satisfies Prisma.SaleItemSelect;
export function merchantSaleSelect(
  organizationId: string,
  merchantId: string | null,
) {
  return {
    id: true,
    receiptCode: true,
    completedAt: true,
    branchId: true,
    branchName: true,
    branchCode: true,
    items: {
      where: {
        organizationId,
        ...(merchantId ? { merchantId } : { id: { in: [] } }),
      },
      orderBy: { id: 'asc' },
      select: merchantSaleItemSelect,
    },
  } satisfies Prisma.SaleSelect;
}
type MerchantSale = Prisma.SaleGetPayload<{
  select: ReturnType<typeof merchantSaleSelect>;
}>;
function merchantResponse(sale: MerchantSale) {
  return {
    id: sale.id,
    receiptCode: sale.receiptCode,
    completedAt: sale.completedAt,
    branchId: sale.branchId,
    branchName: sale.branchName,
    branchCode: sale.branchCode,
    items: sale.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
    ownItemsSubtotal: sale.items
      .reduce(
        (sum, item) => sum.plus(item.lineTotal.toString()),
        new ExactDecimal(0),
      )
      .toFixed(2),
  };
}

@Injectable()
export class SalesReadService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    context: OrganizationContext,
    branchId: string,
    query: ListSalesQueryDto,
  ) {
    if (
      query.from &&
      query.until &&
      new Date(query.from) >= new Date(query.until)
    )
      throw new BadRequestException('from must precede until');
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        await this.authorizeBranch(tx, current, branchId);
        const where: Prisma.SaleWhereInput = {
          ...this.saleScope(current, branchId),
          ...(query.from || query.until
            ? {
                completedAt: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.until ? { lt: new Date(query.until) } : {}),
                },
              }
            : {}),
        };
        const total = await tx.sale.count({ where });
        const options = {
          where,
          orderBy: [{ completedAt: 'desc' as const }, { id: 'desc' as const }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        };
        const items =
          current.role === 'MERCHANT'
            ? (
                await tx.sale.findMany({
                  ...options,
                  select: merchantSaleSelect(
                    current.organizationId,
                    current.merchantId ?? null,
                  ),
                })
              ).map(merchantResponse)
            : (
                await tx.sale.findMany({
                  ...options,
                  select: completedSaleSelect,
                })
              ).map(completedSaleResponse);
        return {
          items,
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async findOne(
    context: OrganizationContext,
    branchId: string,
    saleId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        await this.authorizeBranch(tx, current, branchId);
        const where = {
          AND: [this.saleScope(current, branchId), { id: saleId }],
        };
        if (current.role === 'MERCHANT') {
          const sale = await tx.sale.findFirst({
            where,
            select: merchantSaleSelect(
              current.organizationId,
              current.merchantId ?? null,
            ),
          });
          if (!sale) throw new NotFoundException('Sale not found');
          return merchantResponse(sale);
        }
        const sale = await tx.sale.findFirst({
          where,
          select: completedSaleSelect,
        });
        if (!sale) throw new NotFoundException('Sale not found');
        return completedSaleResponse(sale);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async sellingBranches(context: OrganizationContext) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.currentContext(tx, context);
        if (current.role !== 'MERCHANT')
          throw new ForbiddenException(
            'Only merchants use own-sale branch lookup',
          );
        if (!current.merchantId) return [];
        return tx.branch.findMany({
          where: {
            organizationId: current.organizationId,
            sales: {
              some: {
                organizationId: current.organizationId,
                items: {
                  some: {
                    organizationId: current.organizationId,
                    merchantId: current.merchantId,
                  },
                },
              },
            },
          },
          select: { id: true, name: true, code: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
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
    return {
      organizationId: context.organizationId,
      userId: context.userId,
      ...member,
    };
  }
  private async authorizeBranch(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    branchId: string,
  ) {
    // Assigned branches may have an empty own-sales directory. Historical own
    // sales also grant access without assignments or current product placements.
    // Neither path grants another merchant's sale/detail or branch addresses.
    const assigned = {
      memberships: {
        some: {
          organizationId: context.organizationId,
          userId: context.userId,
        },
      },
    };
    const scope =
      context.role === 'MERCHANT'
        ? {
            organizationId: context.organizationId,
            OR: [
              assigned,
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
          }
        : branchScope(context);
    if (
      !(await tx.branch.findFirst({
        where: { AND: [scope, { id: branchId }] },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Branch not found');
  }
  private saleScope(
    context: OrganizationContext,
    branchId: string,
  ): Prisma.SaleWhereInput {
    return {
      organizationId: context.organizationId,
      branchId,
      ...(context.role === 'CASHIER' ? { createdById: context.userId } : {}),
      ...(context.role === 'MERCHANT'
        ? context.merchantId
          ? {
              items: {
                some: {
                  organizationId: context.organizationId,
                  merchantId: context.merchantId,
                },
              },
            }
          : { id: { in: [] } }
        : {}),
    };
  }
}
