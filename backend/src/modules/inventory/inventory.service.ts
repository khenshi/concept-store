import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  Prisma,
  ProductStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import type { StockInDto } from './dto/stock-in.dto';
import type { InventoryOperationRecord } from './inventory.types';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  stockIn(
    organizationId: string,
    createdById: string,
    dto: StockInDto,
  ): Promise<InventoryOperationRecord> {
    return this.changeQuantity(
      organizationId,
      createdById,
      dto.productId,
      dto.branchId,
      dto.quantity,
      InventoryMovementType.STOCK_IN,
      dto.note,
      dto.referenceId,
      true,
    );
  }

  adjust(
    organizationId: string,
    createdById: string,
    dto: AdjustInventoryDto,
  ): Promise<InventoryOperationRecord> {
    return this.changeQuantity(
      organizationId,
      createdById,
      dto.productId,
      dto.branchId,
      dto.quantityChange,
      InventoryMovementType.ADJUSTMENT,
      dto.note,
      dto.referenceId,
      false,
    );
  }

  private async changeQuantity(
    organizationId: string,
    createdById: string,
    productId: string,
    branchId: string,
    quantityChange: number,
    type: InventoryMovementType,
    note: string | undefined,
    referenceId: string | undefined,
    allowCreate: boolean,
  ): Promise<InventoryOperationRecord> {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await this.assertStockRelationship(
            transaction,
            organizationId,
            productId,
            branchId,
            allowCreate,
          );

          const key = {
            productId_branchId_organizationId: {
              productId,
              branchId,
              organizationId,
            },
          };
          const existingInventory = await transaction.inventory.findUnique({
            where: key,
            select: { productId: true },
          });
          if (!allowCreate && !existingInventory) {
            throw new NotFoundException('Inventory record not found');
          }

          const inventory = existingInventory
            ? await transaction.inventory.update({
                where: key,
                data: { quantity: { increment: quantityChange } },
              })
            : await transaction.inventory.create({
                data: {
                  organizationId,
                  branchId,
                  productId,
                  quantity: quantityChange,
                },
              });
          const movement = await transaction.inventoryMovement.create({
            data: {
              organizationId,
              branchId,
              productId,
              quantityChange,
              type,
              note,
              referenceId,
              createdById,
            },
          });
          return { inventory, movement };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Inventory changed concurrently; retry the request',
        );
      }
      throw error;
    }
  }

  private async assertStockRelationship(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
    branchId: string,
    requireActiveProduct: boolean,
  ): Promise<void> {
    const product = await transaction.product.findFirst({
      where: { id: productId, organizationId },
      select: { merchantId: true, status: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (requireActiveProduct && product.status !== ProductStatus.ACTIVE) {
      throw new ConflictException('Inactive products cannot receive inventory');
    }

    const branch = await transaction.branch.findFirst({
      where: { id: branchId, organizationId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const participation = await transaction.merchantBranch.findFirst({
      where: { organizationId, branchId, merchantId: product.merchantId },
      select: { merchantId: true },
    });
    if (!participation) {
      throw new ConflictException(
        'Product merchant does not operate in this branch',
      );
    }
  }
}
