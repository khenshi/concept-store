import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalePaymentMethod } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { branchScope } from '../authorization/resource-access';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import type { CheckoutDto } from './dto/checkout.dto';
import { completedSaleResponse, completedSaleSelect } from './sales.types';

const ExactDecimal = Prisma.Decimal.clone({ precision: 40 });
const originalSelect = {
  ...completedSaleSelect,
  createdById: true,
  checkoutCommand: true,
} satisfies Prisma.SaleSelect;
type OriginalSale = Prisma.SaleGetPayload<{ select: typeof originalSelect }>;

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async complete(
    context: OrganizationContext,
    branchId: string,
    dto: CheckoutDto,
  ) {
    if (
      new Set(dto.items.map((item) => item.branchInventoryId)).size !==
      dto.items.length
    )
      throw new BadRequestException(
        'Duplicate branch inventory lines are not allowed',
      );
    const command = this.canonicalCommand(dto);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const branch = await this.authorize(tx, context, branchId);
          const original = await this.original(
            tx,
            context.organizationId,
            dto.requestId,
          );
          if (original)
            return this.replay(original, context, branchId, command);
          const lines = await tx.branchInventory.findMany({
            where: {
              organizationId: context.organizationId,
              branchId,
              id: { in: dto.items.map((item) => item.branchInventoryId) },
            },
            select: {
              id: true,
              productId: true,
              quantity: true,
              sellingPrice: true,
              product: {
                select: {
                  name: true,
                  sku: true,
                  barcode: true,
                  status: true,
                  merchantId: true,
                  merchant: { select: { name: true, status: true } },
                },
              },
            },
            orderBy: { id: 'asc' },
          });
          if (lines.length !== dto.items.length)
            throw new NotFoundException('Branch inventory not found');
          const quantities = new Map(
            dto.items.map((item) => [item.branchInventoryId, item]),
          );
          const priced = lines.map((line) => {
            const item = quantities.get(line.id)!;
            if (
              line.product.status !== 'ACTIVE' ||
              line.product.merchant.status !== 'ACTIVE'
            )
              throw new ConflictException({
                message: 'Checkout requires active products and merchants',
                code: 'PRODUCT_UNAVAILABLE',
                branchInventoryId: line.id,
              });
            if (!line.sellingPrice.equals(item.expectedUnitPrice))
              throw new ConflictException({
                message:
                  'Branch price changed; review the cart before checkout',
                code: 'PRICE_CHANGED',
                branchInventoryId: line.id,
                sellingPrice: line.sellingPrice.toFixed(2),
              });
            if (line.quantity < item.quantity)
              throw new ConflictException({
                message: 'Insufficient stock',
                code: 'INSUFFICIENT_STOCK',
                branchInventoryId: line.id,
                quantity: line.quantity,
              });
            return {
              line,
              quantity: item.quantity,
              lineTotal: new ExactDecimal(line.sellingPrice.toString()).times(
                item.quantity,
              ),
            };
          });
          const total = priced.reduce(
            (sum, item) => sum.plus(item.lineTotal),
            new ExactDecimal(0),
          );
          const cashTender =
            dto.paymentMethod === SalePaymentMethod.CASH
              ? new ExactDecimal(dto.cashTender!)
              : null;
          if (cashTender && cashTender.lessThan(total))
            throw new BadRequestException(
              'Cash tender must cover the sale total',
            );
          const cashier = await tx.user.findFirst({
            where: { id: context.userId, deletedAt: null },
            select: { firstName: true, lastName: true },
          });
          if (!cashier) throw new NotFoundException('Account not found');
          const sale = await tx.sale.create({
            data: {
              organizationId: context.organizationId,
              branchId,
              createdById: context.userId,
              requestId: dto.requestId,
              receiptCode: `SALE-${randomUUID().toUpperCase()}`,
              organizationName: branch.organization.name,
              branchName: branch.name,
              branchCode: branch.code,
              cashierName: `${cashier.firstName} ${cashier.lastName}`,
              paymentMethod: dto.paymentMethod,
              total,
              cashTender,
              cashChange: cashTender?.minus(total) ?? null,
              paymentReference:
                dto.paymentMethod === SalePaymentMethod.CASH
                  ? null
                  : dto.paymentReference!,
              checkoutCommand: command,
            },
          });
          // Stable placement order avoids opposite-cart lock ordering. SERIALIZABLE
          // protects read prices/lifecycle and rejects stale competing stock writes.
          for (const { line, quantity, lineTotal } of priced) {
            const changed = await tx.branchInventory.updateMany({
              where: {
                id: line.id,
                organizationId: context.organizationId,
                branchId,
                quantity: { gte: quantity },
              },
              data: { quantity: { decrement: quantity } },
            });
            if (changed.count !== 1)
              throw new ConflictException({
                message: 'Insufficient stock',
                code: 'INSUFFICIENT_STOCK',
                branchInventoryId: line.id,
              });
            const balance = await tx.branchInventory.findUniqueOrThrow({
              where: {
                id: line.id,
                organizationId: context.organizationId,
                branchId,
              },
              select: { quantity: true },
            });
            const item = await tx.saleItem.create({
              data: {
                organizationId: context.organizationId,
                branchId,
                saleId: sale.id,
                branchInventoryId: line.id,
                productId: line.productId,
                merchantId: line.product.merchantId,
                quantity,
                productName: line.product.name,
                sku: line.product.sku,
                barcode: line.product.barcode,
                merchantName: line.product.merchant.name,
                unitPrice: line.sellingPrice,
                lineTotal,
              },
            });
            await tx.inventoryMovement.create({
              data: {
                organizationId: context.organizationId,
                branchId,
                branchInventoryId: line.id,
                saleItemId: item.id,
                type: 'SALE',
                quantityChange: -quantity,
                quantityAfter: balance.quantity,
                reason: 'Point-of-sale checkout',
                createdById: context.userId,
                requestId: randomUUID(),
                createdAt: sale.completedAt,
              },
            });
          }
          return completedSaleResponse(
            await tx.sale.findUniqueOrThrow({
              where: {
                id: sale.id,
                organizationId: context.organizationId,
                branchId,
              },
              select: completedSaleSelect,
            }),
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30000,
        },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        // The rejected transaction is fully rolled back. A fresh snapshot checks
        // permissions before resolving a simultaneously committed original.
        return this.prisma.$transaction(
          async (tx) => {
            await this.authorize(tx, context, branchId);
            const original = await this.original(
              tx,
              context.organizationId,
              dto.requestId,
            );
            if (original)
              return this.replay(original, context, branchId, command);
            throw new ConflictException({
              message:
                'Concurrent checkout conflict; retry the unchanged command',
              code: 'CHECKOUT_RETRY',
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      }
      throw error;
    }
  }

  private async authorize(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    branchId: string,
  ) {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        user: { deletedAt: null },
      },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('Organization not found');
    if (!['OWNER', 'MANAGER', 'CASHIER'].includes(membership.role))
      throw new ForbiddenException(
        'Your organization role cannot complete checkout',
      );
    const branch = await tx.branch.findFirst({
      where: {
        AND: [
          branchScope({ ...context, role: membership.role }),
          { id: branchId },
        ],
      },
      include: { organization: { select: { name: true } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  private canonicalCommand(dto: CheckoutDto): Prisma.InputJsonObject {
    return {
      items: [...dto.items]
        .sort((a, b) => a.branchInventoryId.localeCompare(b.branchInventoryId))
        .map((item) => ({
          branchInventoryId: item.branchInventoryId,
          quantity: item.quantity,
          expectedUnitPrice: new ExactDecimal(item.expectedUnitPrice).toFixed(
            2,
          ),
        })),
      paymentMethod: dto.paymentMethod,
      ...(dto.paymentMethod === SalePaymentMethod.CASH
        ? { cashTender: new ExactDecimal(dto.cashTender!).toFixed(2) }
        : { paymentReference: dto.paymentReference! }),
    };
  }
  private original(
    tx: Prisma.TransactionClient,
    organizationId: string,
    requestId: string,
  ) {
    return tx.sale.findUnique({
      where: { organizationId_requestId: { organizationId, requestId } },
      select: originalSelect,
    });
  }
  private replay(
    original: OriginalSale,
    context: OrganizationContext,
    branchId: string,
    command: Prisma.InputJsonObject,
  ) {
    if (
      original.branchId !== branchId ||
      original.createdById !== context.userId ||
      !isDeepStrictEqual(original.checkoutCommand, command)
    )
      throw new ConflictException({
        message:
          'Request ID was already used for a different checkout command or actor',
        code: 'REQUEST_ID_CONFLICT',
      });
    return completedSaleResponse(original);
  }
}
