import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  InventoryMovementType,
  OrganizationRole,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MerchantFinanceAccrualService } from '../merchant-finance-accrual/merchant-finance-accrual.service';
import type { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAccrual: MerchantFinanceAccrualService,
  ) {}

  async create(
    organizationId: string,
    branchId: string,
    saleId: string,
    actorId: string,
    dto: CreateRefundDto,
  ) {
    try {
      return await this.runSerializable(async (tx) => {
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
          where: {
            id: saleId,
            organizationId,
            branchId,
            status: 'COMPLETED',
          },
          select: {
            id: true,
            completedAt: true,
            items: {
              select: {
                id: true,
                productId: true,
                merchantId: true,
                quantity: true,
                total: true,
                settlementLinks: {
                  where: { releasedAt: null },
                  select: { settlementId: true },
                  take: 1,
                },
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
            id: randomUUID(),
            organizationId,
            saleItemId: item.id,
            merchantId: item.merchantId,
            quantity,
            amount,
          };
        });
        const completedAt = new Date();
        const refundId = randomUUID();
        await tx.saleRefund.create({
          data: {
            id: refundId,
            organizationId,
            branchId,
            saleId,
            reason: dto.reason,
            completedById: actorId,
            completedAt,
            items: { create: itemData },
          },
        });
        for (const item of itemData) {
          const restored = await tx.inventory.updateMany({
            where: {
              organizationId,
              branchId,
              productId: sale.items.find(({ id }) => id === item.saleItemId)!
                .productId,
            },
            data: { quantity: { increment: item.quantity } },
          });
          if (restored.count !== 1) {
            throw new ConflictException(
              'Inventory could not be restored for the refunded item',
            );
          }
        }
        await tx.inventoryMovement.createMany({
          data: itemData.map((item) => ({
            organizationId,
            branchId,
            productId: sale.items.find(({ id }) => id === item.saleItemId)!
              .productId,
            quantityChange: item.quantity,
            type: InventoryMovementType.RETURN,
            referenceId: refundId,
            note: dto.reason,
            createdById: actorId,
            saleId,
          })),
        });
        await this.financeAccrual.addCompletedRefund(
          tx,
          organizationId,
          completedAt,
          itemData.map((item) => {
            const saleItem = sale.items.find(
              ({ id }) => id === item.saleItemId,
            )!;
            return {
              merchantId: item.merchantId,
              amount: item.amount,
              originalSaleCompletedAt: sale.completedAt,
              originalSaleCaptured: saleItem.settlementLinks.length > 0,
            };
          }),
        );
        return tx.saleRefund.findUniqueOrThrow({
          where: { id_organizationId: { id: refundId, organizationId } },
          include: { items: true },
        });
      }, 3);
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

  private async runSerializable<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    maxAttempts: number,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!retryable || attempt === maxAttempts) throw error;
      }
    }
    throw new ConflictException('Refund could not be completed');
  }
}
