import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgreementStatus,
  MerchantReceivableStatus,
  MerchantReceivableTransactionType,
  OrganizationRole,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { currentPhilippineBusinessDate } from '../merchant-agreements/dto/agreement-date.validation';
import type { ListMerchantReceivablesQueryDto } from './dto/list-merchant-receivables-query.dto';
import type { RecordReceivablePaymentDto } from './dto/record-receivable-payment.dto';
import type { AdjustReceivableDto } from './dto/adjust-receivable.dto';
import {
  merchantReceivableInclude,
  type MerchantReceivablePageRecord,
  type MerchantReceivableRecord,
} from './merchant-receivables.types';

@Injectable()
export class MerchantReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    query: ListMerchantReceivablesQueryDto,
  ): Promise<MerchantReceivablePageRecord> {
    await this.ensureCurrentRentReceivables(organizationId);
    await this.markOverdue(organizationId);
    const where: Prisma.MerchantReceivableWhereInput = {
      organizationId,
      merchantId: query.merchantId,
      status: query.status,
    };
    const [items, total] = await Promise.all([
      this.prisma.merchantReceivable.findMany({
        where,
        include: merchantReceivableInclude,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.merchantReceivable.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toRecord(item)),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  async findOne(
    organizationId: string,
    receivableId: string,
  ): Promise<MerchantReceivableRecord> {
    await this.markOverdue(organizationId);
    const receivable = await this.prisma.merchantReceivable.findFirst({
      where: { id: receivableId, organizationId },
      include: merchantReceivableInclude,
    });
    if (!receivable)
      throw new NotFoundException('Merchant receivable not found');
    return this.toRecord(receivable);
  }

  async ensureCurrentRentReceivables(organizationId: string): Promise<void> {
    const today = currentPhilippineBusinessDate();
    const sourcePeriod = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const dueDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
    );
    const agreements = await this.prisma.merchantAgreement.findMany({
      where: {
        organizationId,
        status: AgreementStatus.ACTIVE,
        fixedRentAmount: { not: null },
        startDate: { lte: today },
        OR: [{ endDate: null }, { endDate: { gte: sourcePeriod } }],
      },
      select: { id: true, merchantId: true, fixedRentAmount: true },
    });
    if (!agreements.length) return;
    await this.prisma.merchantReceivable.createMany({
      data: agreements.map((agreement) => ({
        organizationId,
        merchantId: agreement.merchantId,
        agreementId: agreement.id,
        sourcePeriod,
        originalAmount: agreement.fixedRentAmount!,
        remainingAmount: agreement.fixedRentAmount!,
        dueDate,
      })),
      skipDuplicates: true,
    });
  }

  async recordPayment(
    organizationId: string,
    receivableId: string,
    actorId: string,
    dto: RecordReceivablePaymentDto,
  ): Promise<MerchantReceivableRecord> {
    const paidAt = new Date(dto.paidAt);
    if (paidAt > new Date()) {
      throw new BadRequestException('Payment date cannot be in the future');
    }
    await this.runMutation(async (transaction) => {
      await this.assertFinanceActor(transaction, organizationId, actorId);
      const receivable = await this.requireAvailableReceivable(
        transaction,
        organizationId,
        receivableId,
      );
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.gt(receivable.availableAmount)) {
        throw new BadRequestException(
          'Payment exceeds the unreserved receivable balance',
        );
      }
      const remainingAmount = receivable.remainingAmount.sub(amount);
      await transaction.merchantReceivable.update({
        where: { id: receivableId },
        data: {
          remainingAmount,
          status: this.statusFor(
            remainingAmount,
            receivable.originalAmount,
            receivable.dueDate,
          ),
        },
      });
      await transaction.merchantReceivableTransaction.create({
        data: {
          organizationId,
          merchantId: receivable.merchantId,
          receivableId,
          type: MerchantReceivableTransactionType.PAYMENT,
          amount,
          paymentMethod: dto.method,
          referenceNumber: dto.referenceNumber,
          note: dto.note,
          occurredAt: paidAt,
          recordedById: actorId,
        },
      });
    });
    return this.findOne(organizationId, receivableId);
  }

  async adjust(
    organizationId: string,
    receivableId: string,
    actorId: string,
    dto: AdjustReceivableDto,
  ): Promise<MerchantReceivableRecord> {
    await this.runMutation(async (transaction) => {
      await this.assertFinanceActor(transaction, organizationId, actorId);
      const receivable = await this.requireAvailableReceivable(
        transaction,
        organizationId,
        receivableId,
      );
      const amount = new Prisma.Decimal(dto.amount);
      const remainingAmount = receivable.remainingAmount.add(amount);
      if (remainingAmount.lt(receivable.reservedAmount)) {
        throw new BadRequestException(
          'Adjustment would reduce rent below the amount reserved by a settlement',
        );
      }
      await transaction.merchantReceivable.update({
        where: { id: receivableId },
        data: {
          remainingAmount,
          status: this.statusFor(
            remainingAmount,
            receivable.originalAmount,
            receivable.dueDate,
          ),
        },
      });
      await transaction.merchantReceivableTransaction.create({
        data: {
          organizationId,
          merchantId: receivable.merchantId,
          receivableId,
          type: MerchantReceivableTransactionType.ADJUSTMENT,
          amount,
          note: dto.reason,
          recordedById: actorId,
        },
      });
    });
    return this.findOne(organizationId, receivableId);
  }

  private async requireAvailableReceivable(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    receivableId: string,
  ) {
    const receivable = await transaction.merchantReceivable.findFirst({
      where: { id: receivableId, organizationId },
      include: {
        allocations: { where: { appliedAt: null }, select: { amount: true } },
      },
    });
    if (!receivable)
      throw new NotFoundException('Merchant receivable not found');
    const reservedAmount = receivable.allocations.reduce(
      (total, allocation) => total.add(allocation.amount),
      new Prisma.Decimal(0),
    );
    return {
      ...receivable,
      reservedAmount,
      availableAmount: receivable.remainingAmount.sub(reservedAmount),
    };
  }

  private statusFor(
    remainingAmount: Prisma.Decimal,
    originalAmount: Prisma.Decimal,
    dueDate: Date,
  ): MerchantReceivableStatus {
    if (remainingAmount.isZero()) return MerchantReceivableStatus.PAID;
    if (dueDate < currentPhilippineBusinessDate())
      return MerchantReceivableStatus.OVERDUE;
    return remainingAmount.lt(originalAmount)
      ? MerchantReceivableStatus.PARTIALLY_PAID
      : MerchantReceivableStatus.OPEN;
  }

  private async assertFinanceActor(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    const membership = await transaction.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId: actorId } },
      select: { role: true },
    });
    if (
      !membership ||
      (membership.role !== OrganizationRole.OWNER &&
        membership.role !== OrganizationRole.MANAGER)
    ) {
      throw new ForbiddenException(
        'Your organization role cannot manage receivables',
      );
    }
  }

  private async runMutation<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2004', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException(
          'Receivable changed concurrently; reload and retry the request',
        );
      }
      throw error;
    }
  }

  private async markOverdue(organizationId: string): Promise<void> {
    await this.prisma.merchantReceivable.updateMany({
      where: {
        organizationId,
        status: {
          in: [
            MerchantReceivableStatus.OPEN,
            MerchantReceivableStatus.PARTIALLY_PAID,
          ],
        },
        remainingAmount: { gt: 0 },
        dueDate: { lt: currentPhilippineBusinessDate() },
      },
      data: { status: MerchantReceivableStatus.OVERDUE },
    });
  }

  private toRecord(
    item: Prisma.MerchantReceivableGetPayload<{
      include: typeof merchantReceivableInclude;
    }>,
  ): MerchantReceivableRecord {
    return {
      ...item,
      originalAmount: item.originalAmount.toFixed(2),
      remainingAmount: item.remainingAmount.toFixed(2),
      agreement: {
        ...item.agreement,
        fixedRentAmount: item.agreement.fixedRentAmount?.toFixed(2) ?? null,
      },
      transactions: item.transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amount.toFixed(2),
      })),
    };
  }
}
