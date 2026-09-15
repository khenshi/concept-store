import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  MerchantStatus,
  OrganizationRole,
  Prisma,
} from '../../../generated/prisma/client';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { UpdateProductStatusDto } from './dto/update-product-status.dto';
import type { ProductInventoryRecord, ProductRecord } from './products.types';
import { productSelect } from './products.types';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { inventoryScope, productScope } from '../authorization/resource-access';
import { deriveInventoryStockStatus } from '../inventory/inventory.types';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    dto: CreateProductDto,
    actorId?: string,
  ): Promise<ProductRecord> {
    if (dto.initialInventory) {
      if (!actorId || !dto.requestId)
        throw new BadRequestException(
          'Opening stock requires an authenticated actor and requestId',
        );
      return this.createWithOpeningStock(organizationId, dto, actorId);
    }
    if (dto.requestId !== undefined)
      throw new BadRequestException('requestId requires initialInventory');
    const merchant = await this.resolveMerchant(organizationId, dto.merchantId);
    if (merchant.status !== MerchantStatus.ACTIVE) {
      throw new ConflictException('New products require an active merchant');
    }
    try {
      return await this.prisma.product.create({
        select: productSelect,
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
    context?: OrganizationContext,
  ): Promise<ProductRecord[]> {
    if (query.merchantId)
      await this.resolveMerchant(organizationId, query.merchantId);
    return this.prisma.product.findMany({
      select: productSelect,
      where: {
        organizationId,
        ...(context ? { AND: [productScope(context)] } : {}),
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
    context?: OrganizationContext,
  ): Promise<ProductRecord> {
    const product = await this.prisma.product.findUnique({
      select: productSelect,
      where: {
        id: productId,
        organizationId,
        ...(context ? { AND: [productScope(context)] } : {}),
      },
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
        select: productSelect,
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
        select: productSelect,
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
    context?: OrganizationContext,
  ): Promise<ProductInventoryRecord[]> {
    await this.findOne(organizationId, productId, context);
    const placements = await this.prisma.branchInventory.findMany({
      where: {
        organizationId,
        productId,
        ...(context ? { AND: [inventoryScope(context)] } : {}),
      },
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: [{ branch: { name: 'asc' } }, { id: 'asc' }],
    });
    return placements.map((placement) => ({
      ...placement,
      sellingPrice: placement.sellingPrice.toFixed(2),
      stockStatus: deriveInventoryStockStatus(placement),
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

  private async createWithOpeningStock(
    organizationId: string,
    dto: CreateProductDto,
    actorId: string,
  ): Promise<ProductRecord> {
    const opening = dto.initialInventory!;
    const requestId = dto.requestId!.toLowerCase();
    const command = {
      merchantId: dto.merchantId.toLowerCase(),
      name: dto.name.trim(),
      sku: dto.sku?.trim().toUpperCase() || null,
      barcode: dto.barcode?.trim() || null,
      initialInventory: {
        branchId: opening.branchId.toLowerCase(),
        sellingPrice: new Prisma.Decimal(opening.sellingPrice).toFixed(2),
        quantity: opening.quantity,
        lowStockThreshold: opening.lowStockThreshold ?? 5,
      },
    };
    const authorize = async (tx: Prisma.TransactionClient) => {
      const membership = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId, userId: actorId } },
        select: { role: true, user: { select: { deletedAt: true } } },
      });
      if (
        !membership ||
        membership.role !== OrganizationRole.OWNER ||
        membership.user.deletedAt !== null
      )
        throw new ForbiddenException('Current owner access is required');
      const branch = await tx.branch.findUnique({
        where: { id: command.initialInventory.branchId, organizationId },
        select: { id: true },
      });
      if (!branch) throw new NotFoundException('Branch not found');
    };
    const replay = async (tx: Prisma.TransactionClient) => {
      const existing = await tx.product.findUnique({
        where: {
          organizationId_creationRequestId: {
            organizationId,
            creationRequestId: requestId,
          },
        },
        select: { id: true, creationActorId: true, creationCommand: true },
      });
      if (!existing) return null;
      if (
        existing.creationActorId !== actorId ||
        !isDeepStrictEqual(existing.creationCommand, command)
      )
        throw new ConflictException({
          code: 'PRODUCT_CREATE_REQUEST_CONFLICT',
          message:
            'Request ID was already used for a different product creation command',
        });
      return tx.product.findUniqueOrThrow({
        where: { id: existing.id, organizationId },
        select: productSelect,
      });
    };
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await authorize(tx);
          const existing = await replay(tx);
          if (existing) return existing;
          const merchant = await tx.merchant.findUnique({
            where: { id: command.merchantId, organizationId },
            select: { status: true },
          });
          if (!merchant) throw new NotFoundException('Merchant not found');
          if (merchant.status !== MerchantStatus.ACTIVE)
            throw new ConflictException(
              'New products require an active merchant',
            );
          const product = await tx.product.create({
            select: productSelect,
            data: {
              organizationId,
              merchantId: command.merchantId,
              name: command.name,
              sku: command.sku,
              barcode: command.barcode,
              creationRequestId: requestId,
              creationActorId: actorId,
              creationCommand: command,
            },
          });
          const placement = await tx.branchInventory.create({
            data: {
              organizationId,
              branchId: command.initialInventory.branchId,
              productId: product.id,
              sellingPrice: new Prisma.Decimal(
                command.initialInventory.sellingPrice,
              ),
              quantity: command.initialInventory.quantity,
              lowStockThreshold: command.initialInventory.lowStockThreshold,
            },
            select: { id: true },
          });
          await tx.inventoryMovement.create({
            data: {
              organizationId,
              branchId: command.initialInventory.branchId,
              branchInventoryId: placement.id,
              type: InventoryMovementType.RECEIPT,
              quantityChange: command.initialInventory.quantity,
              quantityAfter: command.initialInventory.quantity,
              reason: 'Initial stock on product creation',
              createdById: actorId,
              requestId: randomUUID(),
            },
          });
          return product;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Read-only recovery of a concurrent committed command; never retry writes automatically.
        return this.prisma.$transaction(
          async (tx) => {
            await authorize(tx);
            const existing = await replay(tx);
            if (existing) return existing;
            throw new ConflictException(
              'Product SKU or barcode already exists in this organization',
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException({
          code: 'PRODUCT_CREATE_RETRY',
          message:
            'Product creation rolled back due to a concurrent change. Retry the same command and request ID.',
        });
      this.rethrowKnownError(error);
    }
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
