import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MerchantStatus,
  Prisma,
  ProductStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ListPosProductsQueryDto } from './dto/list-pos-products-query.dto';
import {
  posInventoryInclude,
  type PosInventoryRow,
  type PosProductPageRecord,
  type PosProductRecord,
} from './pos-products.types';

@Injectable()
export class PosProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    branchId: string,
    query: ListPosProductsQueryDto,
  ): Promise<PosProductPageRecord> {
    await this.assertBranch(organizationId, branchId);
    const where = this.sellableWhere(organizationId, branchId, {
      merchantId: query.merchantId,
      search: query.search,
    });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({
        where,
        include: posInventoryInclude,
        orderBy: [{ product: { name: 'asc' } }, { productId: 'asc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.inventory.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.toRecord(row)),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  async findByCode(
    organizationId: string,
    branchId: string,
    code: string,
  ): Promise<PosProductRecord> {
    await this.assertBranch(organizationId, branchId);
    const inventory = await this.prisma.inventory.findFirst({
      where: this.sellableWhere(organizationId, branchId, { code }),
      include: posInventoryInclude,
    });
    if (!inventory) throw new NotFoundException('Sellable product not found');
    return this.toRecord(inventory);
  }

  private sellableWhere(
    organizationId: string,
    branchId: string,
    filters: { merchantId?: string; search?: string; code?: string },
  ): Prisma.InventoryWhereInput {
    const codeFilter: Prisma.ProductWhereInput[] | undefined = filters.code
      ? [
          { sku: { equals: filters.code, mode: 'insensitive' } },
          { barcode: filters.code },
        ]
      : undefined;
    const searchFilter: Prisma.ProductWhereInput[] | undefined = filters.search
      ? [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { sku: { contains: filters.search, mode: 'insensitive' } },
          { barcode: { contains: filters.search, mode: 'insensitive' } },
        ]
      : undefined;
    return {
      organizationId,
      branchId,
      product: {
        status: ProductStatus.ACTIVE,
        merchantId: filters.merchantId,
        merchant: {
          status: MerchantStatus.ACTIVE,
          branches: { some: { organizationId, branchId } },
        },
        OR: codeFilter ?? searchFilter,
      },
    };
  }

  private async assertBranch(
    organizationId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }

  private toRecord(inventory: PosInventoryRow): PosProductRecord {
    return {
      id: inventory.product.id,
      branchId: inventory.branchId,
      merchantId: inventory.product.merchantId,
      name: inventory.product.name,
      sku: inventory.product.sku,
      barcode: inventory.product.barcode,
      sellingPrice: inventory.product.sellingPrice.toFixed(2),
      quantity: inventory.quantity,
      available: inventory.quantity > 0,
      merchant: inventory.product.merchant,
    };
  }
}
