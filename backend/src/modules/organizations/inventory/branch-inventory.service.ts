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
import type { ListProductsQueryDto } from '../products/dto/list-products-query.dto';
import type { CreateBranchInventoryDto } from './dto/create-branch-inventory.dto';
import type { InventoryPriceDto } from './dto/inventory-price.dto';
import {
  inventoryProductSelect,
  type BranchInventoryRecord,
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
        },
        include: { product: { select: inventoryProductSelect } },
      });
      return { ...inventory, sellingPrice: inventory.sellingPrice.toFixed(2) };
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async findAll(
    organizationId: string,
    branchId: string,
    query: ListProductsQueryDto,
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
    return inventory.map((item) => ({
      ...item,
      sellingPrice: item.sellingPrice.toFixed(2),
    }));
  }

  async findOne(
    organizationId: string,
    branchId: string,
    inventoryId: string,
  ): Promise<BranchInventoryRecord> {
    const inventory = await this.prisma.branchInventory.findUnique({
      where: { id: inventoryId, organizationId, branchId },
      include: { product: { select: inventoryProductSelect } },
    });
    if (!inventory) throw new NotFoundException('Branch inventory not found');
    return { ...inventory, sellingPrice: inventory.sellingPrice.toFixed(2) };
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
      return { ...inventory, sellingPrice: inventory.sellingPrice.toFixed(2) };
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async findMovements(
    organizationId: string,
    branchId: string,
    inventoryId: string,
  ): Promise<InventoryMovementRecord[]> {
    await this.findOne(organizationId, branchId, inventoryId);
    return this.prisma.inventoryMovement.findMany({
      where: { organizationId, branchId, branchInventoryId: inventoryId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
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
