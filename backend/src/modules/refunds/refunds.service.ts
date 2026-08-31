import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    branchId: string,
    saleId: string,
    actorId: string,
    dto: CreateRefundDto,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const membership = await tx.organizationMembership.findUnique({
            where: {
              organizationId_userId: { organizationId, userId: actorId },
            },
            select: { role: true },
          });
          if (
            !membership ||
            (membership.role !== OrganizationRole.OWNER &&
              membership.role !== OrganizationRole.MANAGER)
          ) {
            throw new ForbiddenException(
              'Your organization role cannot record refunds',
            );
          }
          const sale = await tx.sale.findFirst({
            where: { id: saleId, organizationId, branchId },
            select: {
              id: true,
              items: {
                select: {
                  id: true,
                  merchantId: true,
                  quantity: true,
                  total: true,
                },
              },
            },
          });
          if (!sale) throw new NotFoundException('Sale not found');
          const requested = new Map<string, number>();
          for (const item of dto.items)
            requested.set(
              item.saleItemId,
              (requested.get(item.saleItemId) ?? 0) + item.quantity,
            );
          const selected = sale.items.filter((item) => requested.has(item.id));
          if (selected.length !== requested.size)
            throw new NotFoundException('Sale item not found');
          const prior = await tx.saleRefundItem.groupBy({
            by: ['saleItemId'],
            where: {
              saleItemId: { in: selected.map(({ id }) => id) },
              refund: { status: 'COMPLETED' },
            },
            _sum: { quantity: true },
          });
          const refunded = new Map(
            prior.map((row) => [row.saleItemId, row._sum.quantity ?? 0]),
          );
          const itemData = selected.map((item) => {
            const quantity = requested.get(item.id)!;
            if ((refunded.get(item.id) ?? 0) + quantity > item.quantity) {
              throw new ConflictException(
                'Refund quantity exceeds the remaining sold quantity',
              );
            }
            const amount = item.total
              .mul(quantity)
              .div(item.quantity)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            return {
              organizationId,
              saleItemId: item.id,
              merchantId: item.merchantId,
              quantity,
              amount,
            };
          });
          return tx.saleRefund.create({
            data: {
              organizationId,
              branchId,
              saleId,
              reason: dto.reason,
              completedById: actorId,
              items: { create: itemData },
            },
            include: { items: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Refund changed concurrently; reload and retry',
        );
      }
      throw error;
    }
  }
}
