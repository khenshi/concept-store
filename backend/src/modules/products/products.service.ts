import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { UpdateProductStatusDto } from './dto/update-product-status.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { ProductRecord } from './product.types';

const productMerchantInclude = {
  merchant: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ProductInclude;

type ProductWithMerchant = Prisma.ProductGetPayload<{
  include: typeof productMerchantInclude;
}>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    dto: CreateProductDto,
  ): Promise<ProductRecord> {
    await this.assertMerchantBelongsToOrganization(
      organizationId,
      dto.merchantId,
    );

    try {
      const product = await this.prisma.product.create({
        data: {
          organizationId,
          merchantId: dto.merchantId,
          name: dto.name,
          sku: dto.sku,
          barcode: dto.barcode,
          sellingPrice: dto.sellingPrice,
        },
        include: productMerchantInclude,
      });
      return this.toRecord(product);
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async findAll(
    organizationId: string,
    query: ListProductsQueryDto,
  ): Promise<ProductRecord[]> {
    const searchFilters: Prisma.ProductWhereInput[] | undefined = query.search
      ? [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
          { barcode: { contains: query.search, mode: 'insensitive' } },
        ]
      : undefined;
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        merchantId: query.merchantId,
        status: query.status,
        OR: searchFilters,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: productMerchantInclude,
    });
    return products.map((product) => this.toRecord(product));
  }

  async findOne(
    organizationId: string,
    productId: string,
  ): Promise<ProductRecord> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      include: productMerchantInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.toRecord(product);
  }

  async findByCode(
    organizationId: string,
    code: string,
  ): Promise<ProductRecord> {
    const product = await this.prisma.product.findFirst({
      where: {
        organizationId,
        OR: [{ sku: { equals: code, mode: 'insensitive' } }, { barcode: code }],
      },
      include: productMerchantInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.toRecord(product);
  }

  async update(
    organizationId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductRecord> {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('At least one product field is required');
    }
    await this.findOne(organizationId, productId);

    try {
      const product = await this.prisma.product.update({
        where: { id: productId, organizationId },
        data: dto,
        include: productMerchantInclude,
      });
      return this.toRecord(product);
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
    const product = await this.prisma.product.update({
      where: { id: productId, organizationId },
      data: { status: dto.status },
      include: productMerchantInclude,
    });
    return this.toRecord(product);
  }

  private async assertMerchantBelongsToOrganization(
    organizationId: string,
    merchantId: string,
  ): Promise<void> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, organizationId },
      select: { id: true },
    });
    if (!merchant) {
      throw new BadRequestException(
        'Merchant must belong to the product organization',
      );
    }
  }

  private toRecord(product: ProductWithMerchant): ProductRecord {
    return { ...product, sellingPrice: product.sellingPrice.toFixed(2) };
  }

  private rethrowKnownError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Product SKU or barcode already exists in this organization',
      );
    }
    throw error;
  }
}
