import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { branchScope } from '../authorization/resource-access';
import type { ListRefundsQueryDto } from './dto/list-refunds-query.dto';
import {
  completedRefundResponse,
  completedRefundSelect,
} from './refunds.types';
import {
  merchantRefundResponse,
  merchantRefundSelect,
  type RefundRemainingItemResponseDto,
} from './refund-read.types';
@Injectable()
export class RefundReadService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(
    context: OrganizationContext,
    branchId: string,
    saleId: string,
    query: ListRefundsQueryDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.authorize(tx, context, branchId, saleId);
        const where = this.scope(current, branchId, saleId);
        const total = await tx.refund.count({ where });
        const options = {
          where,
          orderBy: [{ completedAt: 'desc' as const }, { id: 'desc' as const }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        };
        const remainingItems = await this.remaining(
          tx,
          current,
          branchId,
          saleId,
        );
        const page = {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          remainingItems,
        };
        if (current.role === 'MERCHANT') {
          const rows = await tx.refund.findMany({
            ...options,
            select: merchantRefundSelect(
              current.organizationId,
              branchId,
              saleId,
              current.merchantId!,
            ),
          });
          return {
            ...page,
            scope: 'MERCHANT' as const,
            items: rows.map(merchantRefundResponse),
          };
        }
        const rows = await tx.refund.findMany({
          ...options,
          select: completedRefundSelect,
        });
        return {
          ...page,
          scope: 'STAFF' as const,
          items: rows.map(completedRefundResponse),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async findOne(
    context: OrganizationContext,
    branchId: string,
    saleId: string,
    refundId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.authorize(tx, context, branchId, saleId);
        const where = {
          ...this.scope(current, branchId, saleId),
          id: refundId,
        };
        if (current.role === 'MERCHANT') {
          const row = await tx.refund.findFirst({
            where,
            select: merchantRefundSelect(
              current.organizationId,
              branchId,
              saleId,
              current.merchantId!,
            ),
          });
          if (!row) throw new NotFoundException('Refund not found');
          return merchantRefundResponse(row);
        }
        const row = await tx.refund.findFirst({
          where,
          select: completedRefundSelect,
        });
        if (!row) throw new NotFoundException('Refund not found');
        return completedRefundResponse(row);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private async authorize(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    branchId: string,
    saleId: string,
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
        'Your organization role cannot read refunds',
      );
    const current = {
      organizationId: context.organizationId,
      userId: context.userId,
      ...member,
    };
    if (current.role !== 'MERCHANT') {
      const branch = await tx.branch.findFirst({
        where: { AND: [branchScope(current), { id: branchId }] },
        select: { id: true },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    }
    // A historical own sale grants reduced reads even without assignments or active placements.
    // An assignment alone never grants another merchant's sale or refund.
    const sale = await tx.sale.findFirst({
      where: {
        organizationId: current.organizationId,
        branchId,
        id: saleId,
        ...(current.role === 'MERCHANT'
          ? current.merchantId
            ? {
                items: {
                  some: {
                    organizationId: current.organizationId,
                    branchId,
                    saleId,
                    merchantId: current.merchantId,
                  },
                },
              }
            : { id: { in: [] } }
          : {}),
      },
      select: { id: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return current;
  }
  private scope(
    context: OrganizationContext,
    branchId: string,
    saleId: string,
  ): Prisma.RefundWhereInput {
    return {
      organizationId: context.organizationId,
      branchId,
      saleId,
      ...(context.role === 'MERCHANT'
        ? {
            items: {
              some: {
                organizationId: context.organizationId,
                branchId,
                saleId,
                merchantId: context.merchantId!,
              },
            },
          }
        : {}),
    };
  }
  private async remaining(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    branchId: string,
    saleId: string,
  ): Promise<RefundRemainingItemResponseDto[]> {
    const where = {
      organizationId: context.organizationId,
      branchId,
      saleId,
      ...(context.role === 'MERCHANT'
        ? { merchantId: context.merchantId! }
        : {}),
    };
    const items = await tx.saleItem.findMany({
      where,
      select: { id: true, quantity: true },
      orderBy: { id: 'asc' },
    });
    const sums = await tx.refundItem.groupBy({
      by: ['saleItemId'],
      where,
      _sum: { quantity: true, restockQuantity: true },
    });
    const byId = new Map(sums.map((sum) => [sum.saleItemId, sum._sum]));
    return items.map((item) => {
      const sum = byId.get(item.id);
      const returnedQuantity = sum?.quantity ?? 0;
      return {
        saleItemId: item.id,
        soldQuantity: item.quantity,
        returnedQuantity,
        restockedQuantity: sum?.restockQuantity ?? 0,
        remainingQuantity: item.quantity - returnedQuantity,
      };
    });
  }
}
