import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { inventoryScope } from '../authorization/resource-access';
import {
  inventoryProductSelect,
  inventoryMovementSelect,
  deriveInventoryStockStatus,
  InventoryStockStatus,
  type BranchInventoryRecord,
  type InventoryHealthSummary,
  type InventoryMovementRecord,
} from './inventory.types';

@Injectable()
export class BranchInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    branchId: string,
    dto: CreateBranchInventoryDto,
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
      const inventory = await this.prisma.branchInventory.create({
        data: {
          organizationId,
          branchId,
          productId: dto.productId,
          sellingPrice: new Prisma.Decimal(dto.sellingPrice),
          lowStockThreshold: dto.lowStockThreshold ?? 5,
        },
        include: { product: { select: inventoryProductSelect } },
      });
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
  ): Promise<BranchInventoryRecord[]> {
    await this.resolveBranch(organizationId, branchId);
    if (query.merchantId) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: query.merchantId, organizationId },
        select: { id: true },
      });
      if (!merchant) throw new NotFoundException('Merchant not found');
    }
    const inventory = await this.prisma.branchInventory.findMany({
      where: {
        organizationId,
        branchId,
        ...(context ? { AND: [inventoryScope(context)] } : {}),
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
      },
      include: { product: { select: inventoryProductSelect } },
      orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
    });
    return inventory
      .map((item) => this.toRecord(item))
      .filter(
        (item) => !query.stockStatus || item.stockStatus === query.stockStatus,
      );
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
    const placements = await this.prisma.branchInventory.findMany({
      where: {
        organizationId,
        branchId,
        ...(context ? { AND: [inventoryScope(context)] } : {}),
      },
      select: { quantity: true, lowStockThreshold: true },
    });
    return placements.reduce<InventoryHealthSummary>(
      (summary, placement) => {
        const status = deriveInventoryStockStatus(placement);
        if (status === InventoryStockStatus.OUT_OF_STOCK) summary.outOfStock++;
        else if (status === InventoryStockStatus.LOW_STOCK) summary.lowStock++;
        else summary.inStock++;
        return summary;
      },
      { inStock: 0, lowStock: 0, outOfStock: 0 },
    );
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
  ) {
    await this.findOne(organizationId, branchId, inventoryId, context);
    const movements: InventoryMovementRecord[] =
      await this.prisma.inventoryMovement.findMany({
        select: inventoryMovementSelect,
        where: { organizationId, branchId, branchInventoryId: inventoryId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    return context?.role === 'MERCHANT'
      ? movements.map(({ createdById: _actor, ...movement }) => {
          void _actor;
          return movement;
        })
      : movements;
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
