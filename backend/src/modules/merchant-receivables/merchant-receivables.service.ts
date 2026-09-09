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
  RentDueWeek,
  RentDueWeekday,
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

function previousDate(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

function addMonthsAnchored(anchor: Date, months: number): Date {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const day = anchor.getUTCDate();
  const result = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

const weekdayNumber: Record<RentDueWeekday, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 0,
};

export function rentDueDate(
  activationDate: Date,
  cycle: number,
  week: RentDueWeek,
  weekday: RentDueWeekday,
): Date {
  if (cycle === 0) return activationDate;
  const month = new Date(
    Date.UTC(
      activationDate.getUTCFullYear(),
      activationDate.getUTCMonth() + cycle,
      1,
    ),
  );
  const wanted = weekdayNumber[weekday];
  if (week === RentDueWeek.LAST) {
    const last = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    );
    last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() - wanted + 7) % 7));
    return last;
  }
  const ordinal =
    [
      RentDueWeek.FIRST,
      RentDueWeek.SECOND,
      RentDueWeek.THIRD,
      RentDueWeek.FOURTH,
    ].indexOf(week) + 1;
  month.setUTCDate(
    1 + ((wanted - month.getUTCDay() + 7) % 7) + (ordinal - 1) * 7,
  );
  return month;
}

@Injectable()
export class MerchantReceivablesService {
  private readonly rentGenerationByOrganization = new Map<string, string>();
  private readonly overdueMarkByOrganization = new Map<string, string>();

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
    const dayKey = today.toISOString().slice(0, 10);
    if (this.rentGenerationByOrganization.get(organizationId) === dayKey) {
      return;
    }
    const agreements = await this.prisma.merchantAgreement.findMany({
      where: {
        organizationId,
        status: { in: [AgreementStatus.ACTIVE, AgreementStatus.ENDED] },
        fixedRentAmount: { not: null },
        startDate: { lte: today },
      },
      select: {
        id: true,
        merchantId: true,
        fixedRentAmount: true,
        startDate: true,
        endDate: true,
        scheduledEndDate: true,
        durationMonths: true,
        rentDueWeek: true,
        rentDueWeekday: true,
      },
    });
    for (const agreement of agreements) {
      if (!agreement.startDate) {
        const sourcePeriod = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
        );
        const dueDate = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0),
        );
        await this.prisma.merchantReceivable.createMany({
          data: [
            {
              organizationId,
              merchantId: agreement.merchantId,
              agreementId: agreement.id,
              sourcePeriod,
              periodStart: sourcePeriod,
              periodEnd: dueDate,
              cycleNumber: 1,
              originalAmount: agreement.fixedRentAmount!,
              remainingAmount: agreement.fixedRentAmount!,
              dueDate,
            },
          ],
          skipDuplicates: true,
        });
        continue;
      }
      const durationMonths = agreement.durationMonths ?? 1;
      const agreementEnd =
        agreement.endDate ??
        (agreement.scheduledEndDate
          ? previousDate(agreement.scheduledEndDate)
          : null);
      const rows: Array<{
        organizationId: string;
        merchantId: string;
        agreementId: string;
        sourcePeriod: Date;
        periodStart: Date;
        periodEnd: Date;
        cycleNumber: number;
        originalAmount: Prisma.Decimal;
        remainingAmount: Prisma.Decimal;
        dueDate: Date;
      }> = [];
      for (let cycle = 0; cycle < durationMonths; cycle += 1) {
        const periodStart = addMonthsAnchored(agreement.startDate, cycle);
        const dueDate =
          agreement.rentDueWeek && agreement.rentDueWeekday
            ? rentDueDate(
                agreement.startDate,
                cycle,
                agreement.rentDueWeek,
                agreement.rentDueWeekday,
              )
            : periodStart;
        if (dueDate > today) break;
        const nextPeriodStart = addMonthsAnchored(
          agreement.startDate,
          cycle + 1,
        );
        let periodEnd = previousDate(nextPeriodStart);
        if (agreementEnd && periodEnd > agreementEnd) periodEnd = agreementEnd;
        if (periodEnd < periodStart) break;
        rows.push({
          organizationId,
          merchantId: agreement.merchantId,
          agreementId: agreement.id,
          sourcePeriod: periodStart,
          periodStart,
          periodEnd,
          cycleNumber: cycle + 1,
          originalAmount: agreement.fixedRentAmount!,
          remainingAmount: agreement.fixedRentAmount!,
          dueDate,
        });
      }
      if (rows.length) {
        await this.prisma.merchantReceivable.createMany({
          data: rows,
          skipDuplicates: true,
        });
      }
    }
    this.rentGenerationByOrganization.set(organizationId, dayKey);
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
      if (dto.requestId) {
        const prior = await transaction.merchantReceivableTransaction.findFirst(
          {
            where: { organizationId, requestId: dto.requestId },
            select: { receivableId: true },
          },
        );
        if (prior && prior.receivableId !== receivableId) {
          throw new ConflictException(
            'This payment request was already used for another receivable',
          );
        }
        if (prior) return;
      }
      const receivable = await this.requireAvailableReceivable(
        transaction,
        organizationId,
        receivableId,
      );
      if (receivable.reservedAmount.gt(0) && !dto.amount) {
        throw new BadRequestException(
          'This rent receivable is reserved by an unpaid settlement; enter an explicit amount from the unreserved balance',
        );
      }
      const amount = dto.amount
        ? new Prisma.Decimal(dto.amount)
        : receivable.availableAmount;
      if (amount.lte(0)) {
        throw new BadRequestException('This rent receivable is already paid');
      }
      if (amount.gt(receivable.availableAmount)) {
        throw new BadRequestException(
          'Payment amount cannot exceed the available receivable balance',
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
          ...(dto.requestId ? { requestId: dto.requestId } : {}),
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
        allocations: {
          where: { appliedAt: null, releasedAt: null },
          select: { amount: true },
        },
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
    const dayKey = currentPhilippineBusinessDate().toISOString().slice(0, 10);
    if (this.overdueMarkByOrganization.get(organizationId) === dayKey) return;
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
    this.overdueMarkByOrganization.set(organizationId, dayKey);
  }

  private toRecord(
    item: Prisma.MerchantReceivableGetPayload<{
      include: typeof merchantReceivableInclude;
    }>,
  ): MerchantReceivableRecord {
    const transactions = item.transactions ?? [];
    const collectedAmount = transactions
      .filter(
        (transaction) =>
          transaction.type === MerchantReceivableTransactionType.PAYMENT ||
          transaction.type ===
            MerchantReceivableTransactionType.SETTLEMENT_DEDUCTION,
      )
      .reduce(
        (total, transaction) => total.add(transaction.amount),
        new Prisma.Decimal(0),
      );
    return {
      ...item,
      originalAmount: item.originalAmount.toFixed(2),
      remainingAmount: item.remainingAmount.toFixed(2),
      accruedAmount: item.originalAmount.toFixed(2),
      collectedAmount: collectedAmount.toFixed(2),
      outstandingAmount: item.remainingAmount.toFixed(2),
      agreement: item.agreement
        ? {
            ...item.agreement,
            fixedRentAmount: item.agreement.fixedRentAmount?.toFixed(2) ?? null,
          }
        : item.agreement,
      transactions: transactions.map((transaction) => ({
        ...transaction,
        amount: transaction.amount.toFixed(2),
      })),
    };
  }
}
