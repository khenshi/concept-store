import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MerchantStatus,
  Prisma,
  ProductStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateBranchInventoryDto } from './dto/create-branch-inventory.dto';
import type { InventoryPriceDto } from './dto/inventory-price.dto';
import type { InventoryThresholdDto } from './dto/inventory-threshold.dto';
import type { ListBranchInventoryQueryDto } from './dto/list-branch-inventory-query.dto';
import type { MovementHistoryQueryDto } from './dto/movement-history-query.dto';
import type { EligibleProductsQueryDto } from './dto/eligible-products-query.dto';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { inventoryScope, productScope } from '../authorization/resource-access';
import { productSelect, type ProductRecord } from '../products/products.types';
import {
  decodeInventoryCursor,
  encodeInventoryCursor,
  type InventoryCursorScope,
} from './inventory-page-cursor';
import {
  inventoryProductSelect,
  inventoryMovementSelect,
  deriveInventoryStockStatus,
  InventoryStockStatus,
  type BranchInventoryRecord,
  type InventoryHealthSummary,
  type InventoryMovementRecord,
  type InventoryMovementPage,
} from './inventory.types';

@Injectable()
export class BranchInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    branchId: string,
    dto: CreateBranchInventoryDto,
    actorId: string,
  ): Promise<BranchInventoryRecord> {
    await this.resolveBranch(organizationId, branchId);
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId, organizationId },
      select: { status: true, merchant: { select: { status: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (
      product.status !== ProductStatus.ACTIVE ||
      product.merchant.status !== MerchantStatus.ACTIVE
    ) {
      throw new ConflictException(
        'New placements require an active product and merchant',
      );
    }
    try {
      const inventory = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.branchInventory.create({
            data: {
              organizationId,
              branchId,
              productId: dto.productId,
              sellingPrice: new Prisma.Decimal(dto.sellingPrice),
              quantity: dto.initialQuantity,
              lowStockThreshold: dto.lowStockThreshold ?? 5,
            },
            include: { product: { select: inventoryProductSelect } },
          });
          if (dto.initialQuantity > 0)
            await tx.inventoryMovement.create({
              data: {
                organizationId,
                branchId,
                branchInventoryId: created.id,
                type: 'RECEIPT',
                quantityChange: dto.initialQuantity,
                quantityAfter: dto.initialQuantity,
                reason: 'Initial stock on branch placement',
                createdById: actorId,
                requestId: randomUUID(),
              },
            });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.toRecord(inventory);
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async findAll(
    organizationId: string,
    branchId: string,
    query: ListBranchInventoryQueryDto,
    context?: OrganizationContext,
  ): Promise<{ items: BranchInventoryRecord[]; nextCursor: string | null }> {
    await this.resolveBranch(organizationId, branchId);
    const limit = query.limit ?? 50;
    if (query.merchantId) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: query.merchantId, organizationId },
        select: { id: true },
      });
      if (!merchant) throw new NotFoundException('Merchant not found');
    }
    const where: Prisma.BranchInventoryWhereInput = {
      organizationId,
      branchId,
      ...(context ? { AND: [inventoryScope(context)] } : {}),
      ...(query.stockStatus ? this.stockStatusWhere(query.stockStatus) : {}),
      product: {
        organizationId,
        ...(query.merchantId ? { merchantId: query.merchantId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { sku: { contains: query.q, mode: 'insensitive' } },
                { barcode: { contains: query.q } },
              ],
            }
          : {}),
      },
    };
    const scope: InventoryCursorScope = {
      kind: 'inventory',
      organizationId,
      branchId,
      context,
      filters: {
        q: query.q,
        merchantId: query.merchantId,
        status: query.status,
        stockStatus: query.stockStatus,
      },
    };
    const cursorId = query.cursor
      ? decodeInventoryCursor(query.cursor, scope)
      : undefined;
    if (cursorId) {
      const existing = await this.prisma.branchInventory.findFirst({
        where: { ...where, id: cursorId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Page cursor not found');
    }
    const inventory = await this.prisma.branchInventory.findMany({
      where,
      include: { product: { select: inventoryProductSelect } },
      orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    const page = inventory.slice(0, limit);
    return {
      items: page.map((item) => this.toRecord(item)),
      nextCursor:
        inventory.length > limit
          ? encodeInventoryCursor(page[page.length - 1].id, scope)
          : null,
    };
  }

  async eligibleProducts(
    organizationId: string,
    branchId: string,
    query: EligibleProductsQueryDto,
    context: OrganizationContext,
  ): Promise<{ items: ProductRecord[]; nextCursor: string | null }> {
    await this.resolveBranch(organizationId, branchId);
    const limit = query.limit ?? 50;
    const where: Prisma.ProductWhereInput = {
      organizationId,
      status: ProductStatus.ACTIVE,
      merchant: { organizationId, status: MerchantStatus.ACTIVE },
      AND: [
        productScope(context),
        { inventory: { none: { organizationId, branchId } } },
      ],
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
              { barcode: { contains: query.q } },
            ],
          }
        : {}),
    };
    const scope: InventoryCursorScope = {
      kind: 'eligible-products',
      organizationId,
      branchId,
      context,
      filters: { q: query.q },
    };
    const cursorId = query.cursor
      ? decodeInventoryCursor(query.cursor, scope)
      : undefined;
    if (cursorId) {
      const existing = await this.prisma.product.findFirst({
        where: { ...where, id: cursorId },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Page cursor not found');
    }
    const products = await this.prisma.product.findMany({
      where,
      select: productSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    const page = products.slice(0, limit);
    return {
      items: page,
      nextCursor:
        products.length > limit
          ? encodeInventoryCursor(page[page.length - 1].id, scope)
          : null,
    };
  }

  async findOne(
    organizationId: string,
    branchId: string,
    inventoryId: string,
    context?: OrganizationContext,
  ): Promise<BranchInventoryRecord> {
    const inventory = await this.prisma.branchInventory.findUnique({
      where: {
        id: inventoryId,
        organizationId,
        branchId,
        ...(context ? { AND: [inventoryScope(context)] } : {}),
      },
      include: { product: { select: inventoryProductSelect } },
    });
    if (!inventory) throw new NotFoundException('Branch inventory not found');
    return this.toRecord(inventory);
  }

  async summarize(
    organizationId: string,
    branchId: string,
    context?: OrganizationContext,
  ): Promise<InventoryHealthSummary> {
    await this.resolveBranch(organizationId, branchId);
    return this.prisma.$transaction(
      async (tx) => {
        const base = {
          organizationId,
          branchId,
          ...(context ? { AND: [inventoryScope(context)] } : {}),
        };
        const outOfStock = await tx.branchInventory.count({
          where: {
            ...base,
            ...this.stockStatusWhere(InventoryStockStatus.OUT_OF_STOCK),
          },
        });
        const lowStock = await tx.branchInventory.count({
          where: {
            ...base,
            ...this.stockStatusWhere(InventoryStockStatus.LOW_STOCK),
          },
        });
        const inStock = await tx.branchInventory.count({
          where: {
            ...base,
            ...this.stockStatusWhere(InventoryStockStatus.IN_STOCK),
          },
        });
        return { inStock, lowStock, outOfStock };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private stockStatusWhere(
    status: InventoryStockStatus,
  ): Prisma.BranchInventoryWhereInput {
    const threshold = this.prisma.branchInventory.fields.lowStockThreshold;
    if (status === InventoryStockStatus.OUT_OF_STOCK) return { quantity: 0 };
    if (status === InventoryStockStatus.LOW_STOCK)
      return {
        quantity: { gt: 0, lte: threshold },
        lowStockThreshold: { gt: 0 },
      };
    return {
      quantity: { gt: 0 },
      OR: [{ lowStockThreshold: 0 }, { quantity: { gt: threshold } }],
    };
  }

  async updatePrice(
    organizationId: string,
    branchId: string,
    inventoryId: string,
    dto: InventoryPriceDto,
  ): Promise<BranchInventoryRecord> {
    await this.findOne(organizationId, branchId, inventoryId);
    try {
      const inventory = await this.prisma.branchInventory.update({
        where: { id: inventoryId, organizationId, branchId },
        data: { sellingPrice: new Prisma.Decimal(dto.sellingPrice) },
        include: { product: { select: inventoryProductSelect } },
      });
      return this.toRecord(inventory);
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async updateThreshold(
    organizationId: string,
    branchId: string,
    inventoryId: string,
    dto: InventoryThresholdDto,
  ): Promise<BranchInventoryRecord> {
    await this.findOne(organizationId, branchId, inventoryId);
    try {
      const inventory = await this.prisma.branchInventory.update({
        where: { id: inventoryId, organizationId, branchId },
        data: { lowStockThreshold: dto.lowStockThreshold },
        include: { product: { select: inventoryProductSelect } },
      });
      return this.toRecord(inventory);
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async findMovements(
    organizationId: string,
    branchId: string,
    inventoryId: string,
    context?: OrganizationContext,
    query: MovementHistoryQueryDto = { limit: 50 },
  ): Promise<
    InventoryMovementPage<
      Omit<InventoryMovementRecord, 'createdById'> | InventoryMovementRecord
    >
  > {
    await this.findOne(organizationId, branchId, inventoryId, context);
    if (query.cursor) {
      const cursor = await this.prisma.inventoryMovement.findFirst({
        where: {
          id: query.cursor,
          organizationId,
          branchId,
          branchInventoryId: inventoryId,
        },
        select: { id: true },
      });
      if (!cursor) throw new NotFoundException('Movement cursor not found');
    }
    const movements: InventoryMovementRecord[] =
      await this.prisma.inventoryMovement.findMany({
        select: inventoryMovementSelect,
        where: { organizationId, branchId, branchInventoryId: inventoryId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
    const page = movements.slice(0, query.limit);
    return {
      items:
        context?.role === 'MERCHANT'
          ? page.map(({ createdById: _actor, ...movement }) => {
              void _actor;
              return movement;
            })
          : page,
      nextCursor: movements.length > query.limit ? page.at(-1)!.id : null,
    };
  }

  private async resolveBranch(
    organizationId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId, organizationId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }

  private toRecord<
    T extends {
      sellingPrice: Prisma.Decimal;
      quantity: number;
      lowStockThreshold: number;
    },
  >(
    inventory: T,
  ): Omit<T, 'sellingPrice'> & {
    sellingPrice: string;
    stockStatus: ReturnType<typeof deriveInventoryStockStatus>;
  } {
    return {
      ...inventory,
      sellingPrice: inventory.sellingPrice.toFixed(2),
      stockStatus: deriveInventoryStockStatus(inventory),
    };
  }

  private rethrowKnownError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002')
        throw new ConflictException('Product is already placed in this branch');
      if (error.code === 'P2025')
        throw new NotFoundException('Branch inventory not found');
    }
    throw error;
  }
}
