import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  InventoryMovementType,
  MerchantStatus,
  OrganizationRole,
  PaymentMethod,
  Prisma,
  ProductStatus,
  SaleStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MerchantFinanceAccrualService } from '../merchant-finance-accrual/merchant-finance-accrual.service';
import type { CreateSaleDto, CreateSaleItemDto } from './dto/create-sale.dto';
import type { ListSalesQueryDto } from './dto/list-sales-query.dto';
import {
  saleResponseInclude,
  saleSummarySelect,
  type SalePageRecord,
  type SaleRecord,
  type SaleResponseRow,
  type SaleSummaryRecord,
  type SaleSummaryRow,
} from './sales.types';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeAccrual: MerchantFinanceAccrualService,
  ) {}

  async findAll(
    organizationId: string,
    branchId: string,
    query: ListSalesQueryDto,
  ): Promise<SalePageRecord> {
    await this.assertBranch(organizationId, branchId);
    const completedFrom = query.completedFrom
      ? new Date(query.completedFrom)
      : undefined;
    const completedTo = query.completedTo
      ? new Date(query.completedTo)
      : undefined;
    if (completedFrom && completedTo && completedFrom > completedTo) {
      throw new BadRequestException(
        'completedFrom must be before or equal to completedTo',
      );
    }
    const where: Prisma.SaleWhereInput = {
      organizationId,
      branchId,
      cashierId: query.cashierId,
      saleNumber: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
      completedAt:
        completedFrom || completedTo
          ? { gte: completedFrom, lte: completedTo }
          : undefined,
      payments: query.paymentMethod
        ? { some: { method: query.paymentMethod } }
        : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        select: saleSummarySelect,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.toSummary(row)),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  async findOne(
    organizationId: string,
    branchId: string,
    saleId: string,
  ): Promise<SaleRecord> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, organizationId, branchId },
      include: saleResponseInclude,
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return this.toRecord(sale);
  }

  async checkout(
    organizationId: string,
    branchId: string,
    cashierId: string,
    dto: CreateSaleDto,
  ): Promise<SaleRecord> {
    const existing = await this.findExisting(
      organizationId,
      branchId,
      dto.clientTransactionId,
    );
    if (existing) return this.toRecord(existing);

    try {
      const sale = await this.prisma.$transaction(
        async (transaction) => {
          const membership =
            await transaction.organizationMembership.findUnique({
              where: {
                organizationId_userId: {
                  organizationId,
                  userId: cashierId,
                },
              },
              select: { role: true },
            });
          if (
            !membership ||
            (membership.role !== OrganizationRole.OWNER &&
              membership.role !== OrganizationRole.MANAGER &&
              membership.role !== OrganizationRole.CASHIER)
          ) {
            throw new ForbiddenException(
              'Your organization role cannot complete sales',
            );
          }

          const branch = await transaction.branch.findFirst({
            where: { id: branchId, organizationId },
            select: { id: true },
          });
          if (!branch) throw new NotFoundException('Branch not found');

          const items = this.aggregateItems(dto.items);
          const inventories = await transaction.inventory.findMany({
            where: {
              organizationId,
              branchId,
              productId: { in: items.map((item) => item.productId) },
            },
            select: {
              productId: true,
              quantity: true,
              product: {
                select: {
                  id: true,
                  merchantId: true,
                  name: true,
                  sku: true,
                  barcode: true,
                  sellingPrice: true,
                  status: true,
                  merchant: {
                    select: {
                      name: true,
                      status: true,
                      branches: {
                        where: { organizationId, branchId },
                        select: { branchId: true },
                      },
                    },
                  },
                },
              },
            },
          });
          const inventoryByProduct = new Map(
            inventories.map((inventory) => [inventory.productId, inventory]),
          );
          if (inventoryByProduct.size !== items.length) {
            throw new ConflictException(
              'One or more products are unavailable in this branch',
            );
          }

          let subtotal = new Prisma.Decimal(0);
          const itemData = items.map((item) => {
            const inventory = inventoryByProduct.get(item.productId);
            if (
              !inventory ||
              inventory.product.status !== ProductStatus.ACTIVE ||
              inventory.product.merchant.status !== MerchantStatus.ACTIVE ||
              inventory.product.merchant.branches.length !== 1
            ) {
              throw new ConflictException(
                'One or more products are no longer sellable in this branch',
              );
            }
            if (inventory.quantity < item.quantity) {
              throw new ConflictException(
                `Insufficient inventory for ${inventory.product.name}`,
              );
            }
            const lineSubtotal = inventory.product.sellingPrice.mul(
              item.quantity,
            );
            subtotal = subtotal.add(lineSubtotal);
            return {
              productId: inventory.productId,
              merchantId: inventory.product.merchantId,
              productName: inventory.product.name,
              productSku: inventory.product.sku,
              productBarcode: inventory.product.barcode,
              merchantName: inventory.product.merchant.name,
              quantity: item.quantity,
              unitPrice: inventory.product.sellingPrice,
              subtotal: lineSubtotal,
              discountAmount: new Prisma.Decimal(0),
              total: lineSubtotal,
            };
          });

          const paymentData = dto.payments.map((payment) => {
            if (
              payment.method !== PaymentMethod.CASH &&
              !payment.referenceNumber
            ) {
              throw new BadRequestException(
                `${payment.method} payments require a reference number`,
              );
            }
            return {
              method: payment.method,
              amount: new Prisma.Decimal(payment.amount),
              referenceNumber: payment.referenceNumber,
              confirmedById: cashierId,
            };
          });
          const paymentTotal = paymentData.reduce(
            (sum, payment) => sum.add(payment.amount),
            new Prisma.Decimal(0),
          );
          if (!paymentTotal.equals(subtotal)) {
            throw new ConflictException(
              'Payment total must equal the server-calculated sale total',
            );
          }

          const completedAt = new Date();
          const accrualBuckets = await this.financeAccrual.prepareCompletedSale(
            transaction,
            organizationId,
            completedAt,
            itemData.map((item) => ({
              merchantId: item.merchantId,
              amount: item.total,
            })),
          );
          const saleId = randomUUID();
          const saleNumber = `S-${saleId.replaceAll('-', '').toUpperCase()}`;
          await transaction.sale.create({
            data: {
              id: saleId,
              organizationId,
              branchId,
              cashierId,
              saleNumber,
              clientTransactionId: dto.clientTransactionId,
              subtotal,
              discountTotal: new Prisma.Decimal(0),
              total: subtotal,
              completedAt,
              items: { create: itemData },
              payments: { create: paymentData },
            },
          });

          for (const item of items) {
            const deducted = await transaction.inventory.updateMany({
              where: {
                organizationId,
                branchId,
                productId: item.productId,
                quantity: { gte: item.quantity },
              },
              data: { quantity: { decrement: item.quantity } },
            });
            if (deducted.count !== 1) {
              throw new ConflictException(
                'Inventory changed during checkout; review the cart and retry',
              );
            }
          }

          await transaction.inventoryMovement.createMany({
            data: items.map((item) => ({
              organizationId,
              branchId,
              productId: item.productId,
              quantityChange: -item.quantity,
              type: InventoryMovementType.SALE,
              referenceId: saleNumber,
              createdById: cashierId,
              saleId,
            })),
          });

          await this.financeAccrual.addCompletedSale(
            transaction,
            accrualBuckets,
          );

          return transaction.sale.findUniqueOrThrow({
            where: { id_organizationId: { id: saleId, organizationId } },
            include: saleResponseInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.toRecord(sale);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        const completed = await this.findExisting(
          organizationId,
          branchId,
          dto.clientTransactionId,
        );
        if (completed) return this.toRecord(completed);
        throw new ConflictException(
          'Checkout changed concurrently; review the cart and retry',
        );
      }
      throw error;
    }
  }

  async voidSale(
    organizationId: string,
    branchId: string,
    saleId: string,
    actorId: string,
    reason: string,
  ): Promise<SaleRecord> {
    return this.prisma
      .$transaction(
        async (transaction) => {
          const sale = await transaction.sale.findFirst({
            where: { id: saleId, organizationId, branchId },
            include: {
              items: {
                include: {
                  settlementLinks: {
                    where: { releasedAt: null },
                    select: { settlementId: true },
                  },
                },
              },
              refunds: { select: { id: true } },
            },
          });
          if (!sale) throw new NotFoundException('Sale not found');
          if (sale.status === SaleStatus.VOIDED) {
            throw new ConflictException('Sale is already voided');
          }
          if (sale.refunds.length > 0) {
            throw new ConflictException('A refunded sale cannot be voided');
          }
          if (sale.items.some((item) => item.settlementLinks.length > 0)) {
            throw new ConflictException('A settled sale cannot be voided');
          }
          const accrualBuckets = await this.financeAccrual.prepareSaleReversal(
            transaction,
            organizationId,
            sale.completedAt,
            sale.items.map((item) => ({
              merchantId: item.merchantId,
              amount: item.total,
            })),
          );

          for (const item of sale.items) {
            const restored = await transaction.inventory.updateMany({
              where: {
                organizationId,
                branchId,
                productId: item.productId,
              },
              data: { quantity: { increment: item.quantity } },
            });
            if (restored.count !== 1) {
              throw new ConflictException(
                'Sale inventory could not be restored',
              );
            }
          }
          await transaction.inventoryMovement.createMany({
            data: sale.items.map((item) => ({
              organizationId,
              branchId,
              productId: item.productId,
              quantityChange: item.quantity,
              type: InventoryMovementType.VOID,
              referenceId: sale.saleNumber,
              note: reason,
              createdById: actorId,
              saleId: sale.id,
            })),
          });
          const changed = await transaction.sale.updateMany({
            where: {
              id: sale.id,
              organizationId,
              branchId,
              status: SaleStatus.COMPLETED,
            },
            data: {
              status: SaleStatus.VOIDED,
              voidedAt: new Date(),
              voidedById: actorId,
              voidReason: reason,
            },
          });
          if (changed.count !== 1)
            throw new ConflictException('Sale is already voided');
          await this.financeAccrual.removeCompletedSale(
            transaction,
            accrualBuckets,
          );
          return transaction.sale.findUniqueOrThrow({
            where: { id_organizationId: { id: sale.id, organizationId } },
            include: saleResponseInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .then((sale) => this.toRecord(sale));
  }

  private aggregateItems(items: CreateSaleItemDto[]): CreateSaleItemDto[] {
    const quantities = new Map<string, number>();
    for (const item of items) {
      const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
      if (quantity > 1_000_000) {
        throw new BadRequestException(
          'Combined product quantity exceeds the checkout limit',
        );
      }
      quantities.set(item.productId, quantity);
    }
    return [...quantities].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
  }

  private findExisting(
    organizationId: string,
    branchId: string,
    clientTransactionId: string,
  ): Promise<SaleResponseRow | null> {
    return this.prisma.sale.findFirst({
      where: { organizationId, branchId, clientTransactionId },
      include: saleResponseInclude,
    });
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

  private toSummary(sale: SaleSummaryRow): SaleSummaryRecord {
    return {
      id: sale.id,
      organizationId: sale.organizationId,
      branchId: sale.branchId,
      cashierId: sale.cashierId,
      saleNumber: sale.saleNumber,
      completedAt: sale.completedAt,
      cashier: sale.cashier,
      subtotal: sale.subtotal.toFixed(2),
      discountTotal: sale.discountTotal.toFixed(2),
      total: sale.total.toFixed(2),
      status: sale.status,
      voidedAt: sale.voidedAt,
      voidReason: sale.voidReason,
      itemCount: sale._count.items,
      paymentMethods: [...new Set(sale.payments.map(({ method }) => method))],
    };
  }

  private toRecord(sale: SaleResponseRow): SaleRecord {
    return {
      ...sale,
      subtotal: sale.subtotal.toFixed(2),
      discountTotal: sale.discountTotal.toFixed(2),
      total: sale.total.toFixed(2),
      items: sale.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toFixed(2),
        subtotal: item.subtotal.toFixed(2),
        discountAmount: item.discountAmount.toFixed(2),
        total: item.total.toFixed(2),
      })),
      payments: sale.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toFixed(2),
      })),
      refunds: (sale.refunds ?? []).map((refund) => ({
        ...refund,
        items: refund.items.map((item) => ({
          ...item,
          amount: item.amount.toFixed(2),
        })),
      })),
    };
  }
}
