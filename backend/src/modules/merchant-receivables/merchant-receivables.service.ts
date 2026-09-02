import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AgreementStatus,
  MerchantReceivableStatus,
  MerchantReceivableType,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { currentPhilippineBusinessDate } from '../merchant-agreements/dto/agreement-date.validation';
import type { ListMerchantReceivablesQueryDto } from './dto/list-merchant-receivables-query.dto';
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
        type: MerchantReceivableType.RENT,
        sourcePeriod,
        originalAmount: agreement.fixedRentAmount!,
        remainingAmount: agreement.fixedRentAmount!,
        dueDate,
      })),
      skipDuplicates: true,
    });
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
