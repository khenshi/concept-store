import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MerchantStatus, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { UpdateProductStatusDto } from './dto/update-product-status.dto';
import type { ProductInventoryRecord, ProductRecord } from './products.types';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    dto: CreateProductDto,
  ): Promise<ProductRecord> {
    const merchant = await this.resolveMerchant(organizationId, dto.merchantId);
    if (merchant.status !== MerchantStatus.ACTIVE) {
      throw new ConflictException('New products require an active merchant');
    }
    try {
      return await this.prisma.product.create({
        data: {
          organizationId,
          merchantId: dto.merchantId,
          name: dto.name,
          sku: dto.sku,
          barcode: dto.barcode,
        },
      });
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async findAll(
    organizationId: string,
    query: ListProductsQueryDto,
  ): Promise<ProductRecord[]> {
    if (query.merchantId)
      await this.resolveMerchant(organizationId, query.merchantId);
    return this.prisma.product.findMany({
      where: {
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
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(
    organizationId: string,
    productId: string,
  ): Promise<ProductRecord> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(
    organizationId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductRecord> {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException(
        'At least one product profile field is required',
      );
    }
    await this.findOne(organizationId, productId);
    try {
      return await this.prisma.product.update({
        where: { id: productId, organizationId },
        data: { name: dto.name, sku: dto.sku, barcode: dto.barcode },
      });
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async updateStatus(
    organizationId: string,
    productId: string,
    dto: UpdateProductStatusDto,
  ): Promise<ProductRecord> {
    await this.findOne(organizationId, productId);
    try {
      return await this.prisma.product.update({
        where: { id: productId, organizationId },
        data: { status: dto.status },
      });
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async findInventory(
    organizationId: string,
    productId: string,
  ): Promise<ProductInventoryRecord[]> {
    await this.findOne(organizationId, productId);
    const placements = await this.prisma.branchInventory.findMany({
      where: { organizationId, productId },
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: [{ branch: { name: 'asc' } }, { id: 'asc' }],
    });
    return placements.map((placement) => ({
      ...placement,
      sellingPrice: placement.sellingPrice.toFixed(2),
    }));
  }

  private async resolveMerchant(organizationId: string, merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId, organizationId },
      select: { status: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  private rethrowKnownError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Product SKU or barcode already exists in this organization',
        );
      }
      if (error.code === 'P2025')
        throw new NotFoundException('Product not found');
    }
    throw error;
  }
}
