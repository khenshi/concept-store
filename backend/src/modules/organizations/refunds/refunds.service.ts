import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { branchScope } from '../authorization/resource-access';
import type { CreateRefundDto } from './dto/create-refund.dto';
import {
  completedRefundResponse,
  completedRefundSelect,
} from './refunds.types';
const Exact = Prisma.Decimal.clone({ precision: 40 });
const originalSelect = {
  ...completedRefundSelect,
  createdById: true,
  refundCommand: true,
} satisfies Prisma.RefundSelect;
type Original = Prisma.RefundGetPayload<{ select: typeof originalSelect }>;
@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}
  async complete(
    context: OrganizationContext,
    branchId: string,
    saleId: string,
    dto: CreateRefundDto,
  ) {
    const items = dto.items.map((item) => ({
      saleItemId: item.saleItemId.toLowerCase(),
      quantity: item.quantity,
      restockQuantity: item.restockQuantity ?? 0,
    }));
    if (
      new Set(items.map((item) => item.saleItemId)).size !== items.length ||
      items.some((item) => item.restockQuantity > item.quantity)
    )
      throw new BadRequestException(
        'Duplicate lines or restock quantity greater than returned quantity',
      );
    if (dto.refundConfirmed !== true)
      throw new BadRequestException(
        'Confirm that the manual refund was issued',
      );
    const command: Prisma.InputJsonObject = {
      items: items.sort((a, b) => a.saleItemId.localeCompare(b.saleItemId)),
      reason: dto.reason.trim(),
      paymentMethod: dto.paymentMethod,
      refundConfirmed: true,
      ...(dto.paymentMethod === 'CASH'
        ? {}
        : { paymentReference: dto.paymentReference!.trim() }),
    };
    const requestId = dto.requestId.toLowerCase();
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.authorize(tx, context, branchId);
          const original = await this.original(
            tx,
            context.organizationId,
            requestId,
          );
          if (original)
            return this.replay(original, context, branchId, saleId, command);
          // Serialize refunds of one sale; SSI also rejects a waiter’s stale snapshot.
          const locked = await tx.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT "id" FROM "Sale" WHERE "organizationId" = ${context.organizationId} AND "branchId" = ${branchId} AND "id" = ${saleId} FOR UPDATE`,
          );
          if (!locked.length) throw new NotFoundException('Sale not found');
          const lines = await tx.saleItem.findMany({
            where: {
              organizationId: context.organizationId,
              branchId,
              saleId,
              id: { in: items.map((item) => item.saleItemId) },
            },
            select: {
              id: true,
              branchInventoryId: true,
              merchantId: true,
              quantity: true,
              unitPrice: true,
            },
            orderBy: { branchInventoryId: 'asc' },
          });
          if (lines.length !== items.length)
            throw new NotFoundException('Sale item not found');
          const prior = await tx.refundItem.groupBy({
            by: ['saleItemId'],
            where: {
              organizationId: context.organizationId,
              branchId,
              saleId,
              saleItemId: { in: items.map((item) => item.saleItemId) },
            },
            _sum: { quantity: true },
          });
          const quantities = new Map(
            items.map((item) => [item.saleItemId, item]),
          );
          const returned = new Map(
            prior.map((item) => [item.saleItemId, item._sum.quantity ?? 0]),
          );
          const priced = lines.map((line) => {
            const item = quantities.get(line.id)!;
            if (
              BigInt(returned.get(line.id) ?? 0) + BigInt(item.quantity) >
              BigInt(line.quantity)
            )
              throw new ConflictException({
                message:
                  'Return quantity exceeds remaining sold units; refresh and review',
                code: 'RETURN_QUANTITY_EXCEEDED',
                saleItemId: line.id,
              });
            return {
              line,
              ...item,
              lineTotal: new Exact(line.unitPrice.toString()).times(
                item.quantity,
              ),
            };
          });
          const refund = await tx.refund.create({
            data: {
              organizationId: context.organizationId,
              branchId,
              saleId,
              createdById: context.userId,
              requestId,
              refundCode: `REFUND-${randomUUID().toUpperCase()}`,
              reason: dto.reason.trim(),
              paymentMethod: dto.paymentMethod,
              paymentReference:
                dto.paymentMethod === 'CASH'
                  ? null
                  : dto.paymentReference!.trim(),
              total: priced.reduce(
                (sum, item) => sum.plus(item.lineTotal),
                new Exact(0),
              ),
              refundCommand: command,
            },
            select: { id: true, completedAt: true },
          });
          // Stable placement order matches checkout; inactive records stay inactive.
          for (const { line, quantity, restockQuantity, lineTotal } of priced) {
            const item = await tx.refundItem.create({
              data: {
                organizationId: context.organizationId,
                branchId,
                saleId,
                refundId: refund.id,
                saleItemId: line.id,
                branchInventoryId: line.branchInventoryId,
                merchantId: line.merchantId,
                quantity,
                restockQuantity,
                unitPrice: line.unitPrice,
                lineTotal,
              },
              select: { id: true },
            });
            if (!restockQuantity) continue;
            const changed = await tx.branchInventory.updateMany({
              where: {
                id: line.branchInventoryId,
                organizationId: context.organizationId,
                branchId,
                quantity: { lte: 2147483647 - restockQuantity },
              },
              data: { quantity: { increment: restockQuantity } },
            });
            if (changed.count !== 1)
              throw new ConflictException({
                message:
                  'Restocking would exceed the stock limit; refresh and review',
                code: 'STOCK_OVERFLOW',
                saleItemId: line.id,
              });
            const balance = await tx.branchInventory.findUniqueOrThrow({
              where: {
                id: line.branchInventoryId,
                organizationId: context.organizationId,
                branchId,
              },
              select: { quantity: true },
            });
            await tx.inventoryMovement.create({
              data: {
                organizationId: context.organizationId,
                branchId,
                branchInventoryId: line.branchInventoryId,
                refundItemId: item.id,
                type: 'RETURN',
                quantityChange: restockQuantity,
                quantityAfter: balance.quantity,
                reason: 'Returned goods restocked',
                createdById: context.userId,
                requestId: randomUUID(),
                createdAt: refund.completedAt,
              },
            });
          }
          return completedRefundResponse(
            await tx.refund.findUniqueOrThrow({
              where: {
                id: refund.id,
                organizationId: context.organizationId,
                branchId,
                saleId,
              },
              select: completedRefundSelect,
            }),
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30000,
        },
      );
    } catch (error: unknown) {
      if (!this.retryable(error)) throw error;
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await this.authorize(tx, context, branchId);
            const original = await this.original(
              tx,
              context.organizationId,
              requestId,
            );
            if (original)
              return this.replay(original, context, branchId, saleId, command);
            throw this.retry();
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (recovery: unknown) {
        if (this.retryable(recovery)) throw this.retry();
        throw recovery;
      }
    }
  }
  private async authorize(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    branchId: string,
  ) {
    const member = await tx.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        user: { deletedAt: null },
      },
      select: { role: true },
    });
    if (!member) throw new NotFoundException('Organization not found');
    if (!['OWNER', 'MANAGER'].includes(member.role))
      throw new ForbiddenException(
        'Your organization role cannot issue refunds',
      );
    const branch = await tx.branch.findFirst({
      where: {
        AND: [branchScope({ ...context, role: member.role }), { id: branchId }],
      },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }
  private original(
    tx: Prisma.TransactionClient,
    organizationId: string,
    requestId: string,
  ) {
    return tx.refund.findUnique({
      where: { organizationId_requestId: { organizationId, requestId } },
      select: originalSelect,
    });
  }
  private replay(
    original: Original,
    context: OrganizationContext,
    branchId: string,
    saleId: string,
    command: Prisma.InputJsonObject,
  ) {
    if (
      original.branchId !== branchId ||
      original.saleId !== saleId ||
      original.createdById !== context.userId ||
      !isDeepStrictEqual(original.refundCommand, command)
    )
      throw new ConflictException({
        message:
          'Request ID was already used for another refund command or actor',
        code: 'REQUEST_ID_CONFLICT',
      });
    return completedRefundResponse(original);
  }
  private retry() {
    return new ConflictException({
      message: 'Concurrent refund conflict; retry the unchanged command',
      code: 'REFUND_RETRY',
    });
  }
  private retryable(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    const adapter = error.meta?.driverAdapterError as
      { cause?: { originalCode?: string } } | undefined;
    const pgCode =
      typeof error.meta?.code === 'string'
        ? error.meta.code
        : adapter?.cause?.originalCode;
    return (
      ['P2002', 'P2034'].includes(error.code) ||
      (error.code === 'P2010' && ['40001', '40P01'].includes(pgCode ?? ''))
    );
  }
}
