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
import type { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';
import type { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import type { StockInDto } from './dto/stock-in.dto';
import {
  inventoryViewInclude,
  movementViewInclude,
  type InventoryMovementPageRecord,
  type InventoryOperationRecord,
  type InventoryPageRecord,
  type InventoryViewRecord,
  type InventoryViewRow,
} from './inventory.types';

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

  async findAll(
    organizationId: string,
    query: ListInventoryQueryDto,
  ): Promise<InventoryPageRecord> {
    const where: Prisma.InventoryWhereInput = {
      organizationId,
      branchId: query.branchId,
      productId: query.productId,
      product: {
        merchantId: query.merchantId,
        status: query.status,
        OR: query.search
          ? [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { barcode: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({
        where,
        include: inventoryViewInclude,
        orderBy: [
          { product: { name: 'asc' } },
          { branch: { name: 'asc' } },
          { productId: 'asc' },
        ],
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.inventory.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.toInventoryView(row)),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  async findMovements(
    organizationId: string,
    query: ListInventoryMovementsQueryDto,
  ): Promise<InventoryMovementPageRecord> {
    const where: Prisma.InventoryMovementWhereInput = {
      organizationId,
      branchId: query.branchId,
      productId: query.productId,
      type: query.type,
    };
    if (query.cursor) {
      const cursorExists = await this.prisma.inventoryMovement.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      if (!cursorExists) {
        throw new NotFoundException('Movement cursor not found');
      }
    }

    const rows = await this.prisma.inventoryMovement.findMany({
      where,
      include: movementViewInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : undefined,
      take: query.limit + 1,
    });
    const hasNextPage = rows.length > query.limit;
    const items = hasNextPage ? rows.slice(0, query.limit) : rows;
    return {
      items,
      nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
    };
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

  private toInventoryView(inventory: InventoryViewRow): InventoryViewRecord {
    return {
      ...inventory,
      product: {
        ...inventory.product,
        sellingPrice: inventory.product.sellingPrice.toFixed(2),
      },
    };
  }
}
