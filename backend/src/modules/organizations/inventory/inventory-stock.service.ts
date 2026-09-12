import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  MerchantStatus,
  Prisma,
  ProductStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  AdjustInventoryDto,
  ReceiveInventoryDto,
} from './dto/stock-command.dto';
import type { InventoryMovementRecord } from './inventory.types';

interface StockCommand {
  organizationId: string;
  branchId: string;
  inventoryId: string;
  userId: string;
  type: InventoryMovementType;
  delta: number;
  reason: string;
  requestId: string;
}

@Injectable()
export class InventoryStockService {
  constructor(private readonly prisma: PrismaService) {}

  receive(
    organizationId: string,
    branchId: string,
    inventoryId: string,
    userId: string,
    dto: ReceiveInventoryDto,
  ): Promise<InventoryMovementRecord> {
    return this.execute({
      organizationId,
      branchId,
      inventoryId,
      userId,
      type: InventoryMovementType.RECEIPT,
      delta: dto.quantity,
      reason: dto.reason,
      requestId: dto.requestId,
    });
  }

  adjust(
    organizationId: string,
    branchId: string,
    inventoryId: string,
    userId: string,
    dto: AdjustInventoryDto,
  ): Promise<InventoryMovementRecord> {
    return this.execute({
      organizationId,
      branchId,
      inventoryId,
      userId,
      type: InventoryMovementType.ADJUSTMENT,
      delta: dto.quantityChange,
      reason: dto.reason,
      requestId: dto.requestId,
    });
  }

  private async execute(
    command: StockCommand,
  ): Promise<InventoryMovementRecord> {
    const { organizationId, branchId, inventoryId, delta } = command;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const inventory = await tx.branchInventory.findUnique({
            where: { id: inventoryId, organizationId, branchId },
            select: {
              id: true,
              product: {
                select: {
                  status: true,
                  merchant: { select: { status: true } },
                },
              },
            },
          });
          if (!inventory)
            throw new NotFoundException('Branch inventory not found');

          const original = await tx.inventoryMovement.findUnique({
            where: {
              organizationId_requestId: {
                organizationId,
                requestId: command.requestId,
              },
            },
          });
          if (original) return this.resolveReplay(original, command);

          if (
            command.type === InventoryMovementType.RECEIPT &&
            (inventory.product.status !== ProductStatus.ACTIVE ||
              inventory.product.merchant.status !== MerchantStatus.ACTIVE)
          ) {
            throw new ConflictException(
              'Stock receiving requires an active product and merchant',
            );
          }

          // PostgreSQL holds the updated row lock until commit. The bounded atomic
          // increment prevents stale-read replacements and integer under/overflow.
          const lower = Math.max(0, -delta);
          const upper = Math.min(2147483647, 2147483647 - delta);
          if (lower > upper)
            throw new ConflictException(
              'Stock change exceeds the allowed quantity range',
            );
          const updated = await tx.branchInventory.updateMany({
            where: {
              id: inventoryId,
              organizationId,
              branchId,
              quantity: { gte: lower, lte: upper },
            },
            data: { quantity: { increment: delta } },
          });
          if (updated.count !== 1)
            throw new ConflictException(
              'Stock change exceeds the allowed quantity range',
            );
          const balance = await tx.branchInventory.findUniqueOrThrow({
            where: { id: inventoryId, organizationId, branchId },
            select: { quantity: true },
          });
          return tx.inventoryMovement.create({
            data: {
              organizationId,
              branchId,
              branchInventoryId: inventoryId,
              type: command.type,
              quantityChange: delta,
              quantityAfter: balance.quantity,
              reason: command.reason,
              createdById: command.userId,
              requestId: command.requestId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error: unknown) {
      // A simultaneous retry may have incremented the row before discovering
      // the unique command conflict. Its whole transaction has now rolled back.
      if (
        error instanceof ConflictException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      ) {
        const original = await this.prisma.inventoryMovement.findUnique({
          where: {
            organizationId_requestId: {
              organizationId,
              requestId: command.requestId,
            },
          },
        });
        if (original) return this.resolveReplay(original, command);
      }
      throw error;
    }
  }

  private resolveReplay(
    original: InventoryMovementRecord,
    command: StockCommand,
  ): InventoryMovementRecord {
    if (
      original.branchInventoryId !== command.inventoryId ||
      original.branchId !== command.branchId ||
      original.type !== command.type ||
      original.quantityChange !== command.delta ||
      original.reason !== command.reason
    ) {
      throw new ConflictException(
        'Request ID was already used for a different stock command',
      );
    }
    return original;
  }
}
