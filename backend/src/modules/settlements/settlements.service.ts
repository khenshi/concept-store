import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AgreementStatus,
  OrganizationRole,
  Prisma,
  type MerchantAgreement,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { currentPhilippineBusinessDate } from '../merchant-agreements/dto/agreement-date.validation';
import {
  daysInclusive,
  nextBusinessDate,
  normalSettlementPeriod,
  parseSettlementPeriod,
  philippineDate,
  philippineDayStart,
  type DatePeriod,
} from './settlement-period';
import {
  settlementRecordInclude,
  type SettlementRecord,
} from './settlements.types';

interface AgreementSegment {
  id: string;
  agreement: MerchantAgreement;
  start: Date;
  end: Date;
  normalPeriod: DatePeriod;
  grossSales: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  fixedRentAmount: Prisma.Decimal;
}

interface EligibleSaleItem {
  id: string;
  total: Prisma.Decimal;
  sale: { completedAt: Date };
}

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateDraft(
    organizationId: string,
    merchantId: string,
    calculatedById: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<SettlementRecord> {
    const period = parseSettlementPeriod(periodStart, periodEnd);
    if (period.end >= currentPhilippineBusinessDate()) {
      throw new BadRequestException(
        'Settlement periods must end before the current business date',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          await this.assertFinanceActor(
            transaction,
            organizationId,
            calculatedById,
          );
          await this.assertMerchant(transaction, organizationId, merchantId);

          const agreements = await transaction.merchantAgreement.findMany({
            where: {
              organizationId,
              merchantId,
              status: { in: [AgreementStatus.ACTIVE, AgreementStatus.ENDED] },
              startDate: { lte: period.end },
              OR: [{ endDate: null }, { endDate: { gte: period.start } }],
            },
            orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
          });
          if (agreements.length === 0) {
            throw new ConflictException(
              'No effective merchant agreement covers this settlement period',
            );
          }

          const schedule = agreements[0].settlementSchedule;
          this.assertNormalPeriod(period, agreements[0]);
          const segments = this.buildSegments(period, agreements);
          const saleItems = await transaction.saleItem.findMany({
            where: {
              organizationId,
              merchantId,
              sale: {
                completedAt: {
                  gte: philippineDayStart(period.start),
                  lt: philippineDayStart(nextBusinessDate(period.end)),
                },
              },
              settlementLinks: { none: {} },
            },
            select: {
              id: true,
              total: true,
              sale: { select: { completedAt: true } },
            },
            orderBy: [{ sale: { completedAt: 'asc' } }, { id: 'asc' }],
          });
          const assignments = this.assignSales(segments, saleItems);
          this.calculateSegments(segments);

          const grossSales = this.sum(
            segments.map((segment) => segment.grossSales),
          );
          const commissionAmount = this.sum(
            segments.map((segment) => segment.commissionAmount),
          );
          const fixedRentAmount = this.sum(
            segments.map((segment) => segment.fixedRentAmount),
          );
          const netPayout = grossSales
            .sub(commissionAmount)
            .sub(fixedRentAmount);

          const settlement = await transaction.merchantSettlement.create({
            data: {
              organizationId,
              merchantId,
              periodStart: period.start,
              periodEnd: period.end,
              schedule,
              grossSales,
              commissionAmount,
              fixedRentAmount,
              adjustmentTotal: new Prisma.Decimal(0),
              netPayout,
              calculatedById,
              terms: {
                create: segments.map((segment) => ({
                  id: segment.id,
                  organizationId,
                  merchantId,
                  agreementId: segment.agreement.id,
                  segmentStart: segment.start,
                  segmentEnd: segment.end,
                  schedule: segment.agreement.settlementSchedule,
                  fixedRentRate: segment.agreement.fixedRentAmount,
                  commissionRate: segment.agreement.commissionRate,
                  grossSales: segment.grossSales,
                  commissionAmount: segment.commissionAmount,
                  fixedRentAmount: segment.fixedRentAmount,
                })),
              },
            },
            select: { id: true },
          });

          if (assignments.length > 0) {
            await transaction.settlementSaleItem.createMany({
              data: assignments.map(({ saleItem, segment }) => ({
                settlementId: settlement.id,
                termSnapshotId: segment.id,
                saleItemId: saleItem.id,
                organizationId,
                merchantId,
                grossAmount: saleItem.total,
              })),
            });
          }

          return transaction.merchantSettlement.findUniqueOrThrow({
            where: {
              id_merchantId_organizationId: {
                id: settlement.id,
                merchantId,
                organizationId,
              },
            },
            include: settlementRecordInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' ||
          error.code === 'P2004' ||
          error.code === 'P2034')
      ) {
        throw new ConflictException(
          'Settlement generation conflicted with another finance operation; retry the request',
        );
      }
      throw error;
    }
  }

  private async assertFinanceActor(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const membership = await transaction.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (
      !membership ||
      (membership.role !== OrganizationRole.OWNER &&
        membership.role !== OrganizationRole.MANAGER)
    ) {
      throw new ForbiddenException(
        'Your organization role cannot generate settlements',
      );
    }
  }

  private async assertMerchant(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    merchantId: string,
  ): Promise<void> {
    const merchant = await transaction.merchant.findFirst({
      where: { id: merchantId, organizationId },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
  }

  private assertNormalPeriod(
    requested: DatePeriod,
    firstAgreement: MerchantAgreement,
  ): void {
    const anchor =
      firstAgreement.startDate > requested.start
        ? firstAgreement.startDate
        : requested.start;
    const expected = normalSettlementPeriod(
      anchor,
      firstAgreement.settlementSchedule,
    );
    if (
      requested.start.getTime() !== expected.start.getTime() ||
      requested.end.getTime() !== expected.end.getTime()
    ) {
      throw new BadRequestException(
        'Settlement dates must match the merchant agreement schedule',
      );
    }
  }

  private buildSegments(
    period: DatePeriod,
    agreements: MerchantAgreement[],
  ): AgreementSegment[] {
    const segments: AgreementSegment[] = [];
    let previousEnd: Date | undefined;

    for (const agreement of agreements) {
      let cursor =
        agreement.startDate > period.start ? agreement.startDate : period.start;
      const agreementEnd =
        agreement.endDate && agreement.endDate < period.end
          ? agreement.endDate
          : period.end;

      if (previousEnd && cursor <= previousEnd) {
        throw new ConflictException(
          'Merchant agreement dates overlap within this settlement period',
        );
      }

      while (cursor <= agreementEnd) {
        const normalPeriod = normalSettlementPeriod(
          cursor,
          agreement.settlementSchedule,
        );
        const end =
          normalPeriod.end < agreementEnd ? normalPeriod.end : agreementEnd;
        segments.push({
          id: randomUUID(),
          agreement,
          start: cursor,
          end,
          normalPeriod,
          grossSales: new Prisma.Decimal(0),
          commissionAmount: new Prisma.Decimal(0),
          fixedRentAmount: new Prisma.Decimal(0),
        });
        previousEnd = end;
        cursor = nextBusinessDate(end);
      }
    }
    return segments;
  }

  private assignSales(
    segments: AgreementSegment[],
    saleItems: EligibleSaleItem[],
  ): Array<{ saleItem: EligibleSaleItem; segment: AgreementSegment }> {
    return saleItems.map((saleItem) => {
      const completedDate = philippineDate(saleItem.sale.completedAt);
      const segment = segments.find(
        ({ start, end }) => completedDate >= start && completedDate <= end,
      );
      if (!segment) {
        throw new ConflictException(
          'One or more merchant sales are not covered by an effective agreement',
        );
      }
      segment.grossSales = segment.grossSales.add(saleItem.total);
      return { saleItem, segment };
    });
  }

  private calculateSegments(segments: AgreementSegment[]): void {
    for (const segment of segments) {
      const commissionRate = segment.agreement.commissionRate;
      segment.commissionAmount = commissionRate
        ? this.roundMoney(segment.grossSales.mul(commissionRate).div(100))
        : new Prisma.Decimal(0);

      const fixedRentRate = segment.agreement.fixedRentAmount;
      segment.fixedRentAmount = fixedRentRate
        ? this.roundMoney(
            fixedRentRate
              .mul(daysInclusive(segment.start, segment.end))
              .div(
                daysInclusive(
                  segment.normalPeriod.start,
                  segment.normalPeriod.end,
                ),
              ),
          )
        : new Prisma.Decimal(0);
    }
  }

  private roundMoney(value: Prisma.Decimal): Prisma.Decimal {
    return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  private sum(values: Prisma.Decimal[]): Prisma.Decimal {
    return values.reduce(
      (total, value) => total.add(value),
      new Prisma.Decimal(0),
    );
  }
}
