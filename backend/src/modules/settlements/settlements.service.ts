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
  SettlementStatus,
  SettlementGenerationType,
  SettlementAuditEventType,
  type MerchantAgreement,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  currentPhilippineBusinessDate,
  parseAgreementDate,
} from '../merchant-agreements/dto/agreement-date.validation';
import type { ListSettlementsQueryDto } from './dto/list-settlements-query.dto';
import type { RecordPayoutDto } from './dto/record-payout.dto';
import type { SettlementAdjustmentDto } from './dto/settlement-adjustment.dto';
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
  settlementSummaryInclude,
  type SettlementPageRecord,
  type SettlementRecord,
  type SettlementSummaryRecord,
  type SettlementSummaryRow,
  type SettlementViewRecord,
} from './settlements.types';

interface AgreementSegment {
  id: string;
  agreement: MerchantAgreement;
  start: Date;
  end: Date;
  normalPeriod: DatePeriod;
  grossSales: Prisma.Decimal;
  refundTotal: Prisma.Decimal;
  netSales: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  fixedRentAmount: Prisma.Decimal;
}

interface EligibleSaleItem {
  id: string;
  total: Prisma.Decimal;
  sale: { completedAt: Date };
}

interface SaleAssignment {
  saleItem: EligibleSaleItem;
  segment: AgreementSegment;
}

interface SettlementCalculation {
  schedule: MerchantAgreement['settlementSchedule'];
  segments: AgreementSegment[];
  assignments: SaleAssignment[];
  refundItems: Array<{ id: string; amount: Prisma.Decimal }>;
  grossSales: Prisma.Decimal;
  refundTotal: Prisma.Decimal;
  netSales: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  fixedRentAmount: Prisma.Decimal;
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
    options: {
      generationType?: SettlementGenerationType;
      generationReason?: string;
      generationKey?: string;
      excludeFixedRent?: boolean;
    } = {},
  ): Promise<SettlementViewRecord> {
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

          const calculation = await this.calculateSources(
            transaction,
            organizationId,
            merchantId,
            period,
            undefined,
            options.generationType === SettlementGenerationType.OFF_CYCLE,
            options.excludeFixedRent,
          );
          const netPayout = calculation.grossSales
            .sub(calculation.refundTotal)
            .sub(calculation.commissionAmount)
            .sub(calculation.fixedRentAmount);

          const settlement = await transaction.merchantSettlement.create({
            data: {
              organizationId,
              merchantId,
              periodStart: period.start,
              periodEnd: period.end,
              schedule: calculation.schedule,
              generationType:
                options.generationType ?? SettlementGenerationType.SCHEDULED,
              generationReason: options.generationReason,
              generationKey: options.generationKey,
              grossSales: calculation.grossSales,
              refundTotal: calculation.refundTotal,
              netSales: calculation.netSales,
              commissionAmount: calculation.commissionAmount,
              fixedRentAmount: calculation.fixedRentAmount,
              adjustmentTotal: new Prisma.Decimal(0),
              netPayout,
              calculatedById,
              terms: {
                create: calculation.segments.map((segment) =>
                  this.termData(segment, organizationId, merchantId),
                ),
              },
            },
            select: { id: true },
          });

          if (calculation.assignments.length > 0) {
            await transaction.settlementSaleItem.createMany({
              data: calculation.assignments.map(({ saleItem, segment }) => ({
                settlementId: settlement.id,
                termSnapshotId: segment.id,
                saleItemId: saleItem.id,
                organizationId,
                merchantId,
                grossAmount: saleItem.total,
              })),
            });
          }
          if (calculation.refundItems.length > 0) {
            await transaction.settlementRefundItem.createMany({
              data: calculation.refundItems.map((item) => ({
                settlementId: settlement.id,
                refundItemId: item.id,
                organizationId,
                merchantId,
                refundAmount: item.amount,
              })),
            });
          }
          await transaction.settlementAuditEvent.create({
            data: {
              organizationId,
              settlementId: settlement.id,
              actorId: calculatedById,
              type:
                options.generationType === SettlementGenerationType.OFF_CYCLE
                  ? SettlementAuditEventType.OFF_CYCLE_GENERATED
                  : options.generationKey
                    ? SettlementAuditEventType.AUTO_GENERATED
                    : SettlementAuditEventType.MANUALLY_GENERATED,
              reason: options.generationReason,
            },
          });

          const record = await transaction.merchantSettlement.findUniqueOrThrow(
            {
              where: {
                id_merchantId_organizationId: {
                  id: settlement.id,
                  merchantId,
                  organizationId,
                },
              },
              include: settlementRecordInclude,
            },
          );
          return this.toView(record);
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

  async findAll(
    organizationId: string,
    query: ListSettlementsQueryDto,
  ): Promise<SettlementPageRecord> {
    const periodFrom = query.periodFrom
      ? parseAgreementDate(query.periodFrom, 'periodFrom')
      : undefined;
    const periodTo = query.periodTo
      ? parseAgreementDate(query.periodTo, 'periodTo')
      : undefined;
    if (periodFrom && periodTo && periodFrom > periodTo) {
      throw new BadRequestException(
        'periodFrom must be before or equal to periodTo',
      );
    }

    const where: Prisma.MerchantSettlementWhereInput = {
      organizationId,
      merchantId: query.merchantId,
      status: query.status,
      periodStart: periodFrom ? { gte: periodFrom } : undefined,
      periodEnd: periodTo ? { lte: periodTo } : undefined,
      OR: query.branchId
        ? [
            {
              saleItems: {
                some: { saleItem: { sale: { branchId: query.branchId } } },
              },
            },
            {
              refundItems: {
                some: { refundItem: { refund: { branchId: query.branchId } } },
              },
            },
          ]
        : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.merchantSettlement.findMany({
        where,
        include: settlementSummaryInclude,
        orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.merchantSettlement.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.toSummary(row)),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  async summary(organizationId: string, query: ListSettlementsQueryDto) {
    const periodFrom = query.periodFrom
      ? parseAgreementDate(query.periodFrom, 'periodFrom')
      : undefined;
    const periodTo = query.periodTo
      ? parseAgreementDate(query.periodTo, 'periodTo')
      : undefined;
    if (periodFrom && periodTo && periodFrom > periodTo)
      throw new BadRequestException(
        'periodFrom must be before or equal to periodTo',
      );
    const aggregate = await this.prisma.merchantSettlement.aggregate({
      where: {
        organizationId,
        merchantId: query.merchantId,
        status: query.status,
        periodStart: periodFrom ? { gte: periodFrom } : undefined,
        periodEnd: periodTo ? { lte: periodTo } : undefined,
        OR: query.branchId
          ? [
              {
                saleItems: {
                  some: { saleItem: { sale: { branchId: query.branchId } } },
                },
              },
              {
                refundItems: {
                  some: {
                    refundItem: { refund: { branchId: query.branchId } },
                  },
                },
              },
            ]
          : undefined,
      },
      _sum: {
        grossSales: true,
        refundTotal: true,
        netSales: true,
        commissionAmount: true,
        fixedRentAmount: true,
        adjustmentTotal: true,
        netPayout: true,
      },
      _count: true,
    });
    const zero = new Prisma.Decimal(0);
    const totals = {
      grossSales: aggregate._sum.grossSales ?? zero,
      refunds: aggregate._sum.refundTotal ?? zero,
      netSales: aggregate._sum.netSales ?? zero,
      deductions: (aggregate._sum.commissionAmount ?? zero)
        .add(aggregate._sum.fixedRentAmount ?? zero)
        .sub(aggregate._sum.adjustmentTotal ?? zero),
      amountDue: aggregate._sum.netPayout ?? zero,
    };
    return {
      ...Object.fromEntries(
        Object.entries(totals).map(([key, value]) => [key, value.toFixed(2)]),
      ),
      count: aggregate._count,
    };
  }

  async findOne(
    organizationId: string,
    settlementId: string,
  ): Promise<SettlementViewRecord> {
    const settlement = await this.prisma.merchantSettlement.findFirst({
      where: { id: settlementId, organizationId },
      include: settlementRecordInclude,
    });
    if (!settlement) throw new NotFoundException('Settlement not found');
    return this.toView(settlement);
  }

  async recalculateDraft(
    organizationId: string,
    settlementId: string,
    calculatedById: string,
  ): Promise<SettlementViewRecord> {
    return this.runFinanceMutation(async (transaction) => {
      await this.assertFinanceActor(
        transaction,
        organizationId,
        calculatedById,
      );
      const settlement = await this.requireDraft(
        transaction,
        organizationId,
        settlementId,
      );
      const period = {
        start: settlement.periodStart,
        end: settlement.periodEnd,
      };
      const calculation = await this.calculateSources(
        transaction,
        organizationId,
        settlement.merchantId,
        period,
        settlementId,
      );
      const adjustment = await transaction.settlementAdjustment.aggregate({
        where: { settlementId, organizationId },
        _sum: { amount: true },
      });
      const adjustmentTotal = adjustment._sum.amount ?? new Prisma.Decimal(0);
      const netPayout = calculation.grossSales
        .sub(calculation.refundTotal)
        .sub(calculation.commissionAmount)
        .sub(calculation.fixedRentAmount)
        .add(adjustmentTotal);

      await transaction.settlementSaleItem.deleteMany({
        where: { settlementId },
      });
      await transaction.settlementRefundItem.deleteMany({
        where: { settlementId, organizationId },
      });
      await transaction.settlementTermSnapshot.deleteMany({
        where: { settlementId, organizationId },
      });
      await transaction.settlementTermSnapshot.createMany({
        data: calculation.segments.map((segment) => ({
          ...this.termData(segment, organizationId, settlement.merchantId),
          settlementId,
        })),
      });
      if (calculation.assignments.length > 0) {
        await transaction.settlementSaleItem.createMany({
          data: calculation.assignments.map(({ saleItem, segment }) => ({
            settlementId,
            termSnapshotId: segment.id,
            saleItemId: saleItem.id,
            organizationId,
            merchantId: settlement.merchantId,
            grossAmount: saleItem.total,
          })),
        });
      }
      if (calculation.refundItems.length > 0) {
        await transaction.settlementRefundItem.createMany({
          data: calculation.refundItems.map((item) => ({
            settlementId,
            refundItemId: item.id,
            organizationId,
            merchantId: settlement.merchantId,
            refundAmount: item.amount,
          })),
        });
      }
      const updated = await transaction.merchantSettlement.updateMany({
        where: {
          id: settlementId,
          organizationId,
          status: SettlementStatus.DRAFT,
        },
        data: {
          schedule: calculation.schedule,
          grossSales: calculation.grossSales,
          refundTotal: calculation.refundTotal,
          netSales: calculation.netSales,
          commissionAmount: calculation.commissionAmount,
          fixedRentAmount: calculation.fixedRentAmount,
          adjustmentTotal,
          netPayout,
          calculatedById,
          calculatedAt: new Date(),
        },
      });
      if (updated.count !== 1) this.throwDraftConflict();
      await transaction.settlementAuditEvent.create({
        data: {
          organizationId,
          settlementId,
          actorId: calculatedById,
          type: SettlementAuditEventType.RECALCULATED,
        },
      });
      return this.loadView(transaction, organizationId, settlementId);
    });
  }

  review(
    organizationId: string,
    settlementId: string,
    actorId: string,
  ): Promise<SettlementViewRecord> {
    return this.transitionSettlement(
      organizationId,
      settlementId,
      actorId,
      SettlementStatus.DRAFT,
      SettlementStatus.REVIEWED,
      (now) => ({ reviewedById: actorId, reviewedAt: now }),
    );
  }

  returnToDraft(
    organizationId: string,
    settlementId: string,
    actorId: string,
  ): Promise<SettlementViewRecord> {
    return this.transitionSettlement(
      organizationId,
      settlementId,
      actorId,
      SettlementStatus.REVIEWED,
      SettlementStatus.DRAFT,
      () => ({
        reviewedById: null,
        reviewedAt: null,
        approvedById: null,
        approvedAt: null,
      }),
    );
  }

  approve(
    organizationId: string,
    settlementId: string,
    actorId: string,
  ): Promise<SettlementViewRecord> {
    return this.transitionSettlement(
      organizationId,
      settlementId,
      actorId,
      SettlementStatus.REVIEWED,
      SettlementStatus.APPROVED,
      (now) => ({ approvedById: actorId, approvedAt: now }),
      [OrganizationRole.OWNER],
    );
  }

  async recordPayout(
    organizationId: string,
    settlementId: string,
    actorId: string,
    dto: RecordPayoutDto,
  ): Promise<SettlementViewRecord> {
    const paidAt = new Date(dto.paidAt);
    if (paidAt > new Date()) {
      throw new BadRequestException('Payout date cannot be in the future');
    }

    return this.runFinanceMutation(async (transaction) => {
      await this.assertFinanceActor(transaction, organizationId, actorId, [
        OrganizationRole.OWNER,
      ]);
      const settlement = await transaction.merchantSettlement.findFirst({
        where: { id: settlementId, organizationId },
        select: { status: true, merchantId: true, netPayout: true },
      });
      if (!settlement) throw new NotFoundException('Settlement not found');
      if (settlement.status !== SettlementStatus.APPROVED) {
        throw new ConflictException(
          'Settlement must be approved before it can be paid',
        );
      }
      if (settlement.netPayout.lte(0)) {
        throw new BadRequestException(
          'Only settlements with a positive net payout can be paid',
        );
      }

      const updated = await transaction.merchantSettlement.updateMany({
        where: {
          id: settlementId,
          organizationId,
          status: SettlementStatus.APPROVED,
        },
        data: { status: SettlementStatus.PAID },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Settlement changed concurrently; reload and retry the request',
        );
      }
      await transaction.merchantPayout.create({
        data: {
          organizationId,
          merchantId: settlement.merchantId,
          settlementId,
          amount: settlement.netPayout,
          method: dto.method,
          referenceNumber: dto.referenceNumber,
          note: dto.note,
          paidAt,
          recordedById: actorId,
        },
      });
      await transaction.settlementAuditEvent.create({
        data: {
          organizationId,
          settlementId,
          actorId,
          type: SettlementAuditEventType.PAYOUT_RECORDED,
        },
      });
      return this.loadView(transaction, organizationId, settlementId);
    });
  }

  addAdjustment(
    organizationId: string,
    settlementId: string,
    actorId: string,
    dto: SettlementAdjustmentDto,
  ): Promise<SettlementViewRecord> {
    return this.changeAdjustment(
      organizationId,
      settlementId,
      actorId,
      async (transaction, merchantId) => {
        await transaction.settlementAdjustment.create({
          data: {
            organizationId,
            merchantId,
            settlementId,
            amount: new Prisma.Decimal(dto.amount),
            reason: dto.reason,
            createdById: actorId,
          },
        });
        await transaction.settlementAuditEvent.create({
          data: {
            organizationId,
            settlementId,
            actorId,
            type: SettlementAuditEventType.ADJUSTMENT_ADDED,
            reason: dto.reason,
          },
        });
      },
    );
  }

  updateAdjustment(
    organizationId: string,
    settlementId: string,
    adjustmentId: string,
    actorId: string,
    dto: SettlementAdjustmentDto,
  ): Promise<SettlementViewRecord> {
    return this.changeAdjustment(
      organizationId,
      settlementId,
      actorId,
      async (transaction) => {
        const updated = await transaction.settlementAdjustment.updateMany({
          where: { id: adjustmentId, settlementId, organizationId },
          data: { amount: new Prisma.Decimal(dto.amount), reason: dto.reason },
        });
        if (updated.count !== 1) {
          throw new NotFoundException('Settlement adjustment not found');
        }
        await transaction.settlementAuditEvent.create({
          data: {
            organizationId,
            settlementId,
            actorId,
            type: SettlementAuditEventType.ADJUSTMENT_UPDATED,
            reason: dto.reason,
          },
        });
      },
    );
  }

  removeAdjustment(
    organizationId: string,
    settlementId: string,
    adjustmentId: string,
    actorId: string,
  ): Promise<SettlementViewRecord> {
    return this.changeAdjustment(
      organizationId,
      settlementId,
      actorId,
      async (transaction) => {
        const removed = await transaction.settlementAdjustment.deleteMany({
          where: { id: adjustmentId, settlementId, organizationId },
        });
        if (removed.count !== 1) {
          throw new NotFoundException('Settlement adjustment not found');
        }
        await transaction.settlementAuditEvent.create({
          data: {
            organizationId,
            settlementId,
            actorId,
            type: SettlementAuditEventType.ADJUSTMENT_REMOVED,
          },
        });
      },
    );
  }

  private async changeAdjustment(
    organizationId: string,
    settlementId: string,
    actorId: string,
    operation: (
      transaction: Prisma.TransactionClient,
      merchantId: string,
    ) => Promise<void>,
  ): Promise<SettlementViewRecord> {
    return this.runFinanceMutation(async (transaction) => {
      await this.assertFinanceActor(transaction, organizationId, actorId);
      const settlement = await this.requireDraft(
        transaction,
        organizationId,
        settlementId,
      );
      await operation(transaction, settlement.merchantId);
      const aggregate = await transaction.settlementAdjustment.aggregate({
        where: { settlementId, organizationId },
        _sum: { amount: true },
      });
      const adjustmentTotal = aggregate._sum.amount ?? new Prisma.Decimal(0);
      const netPayout = settlement.grossSales
        .sub(settlement.refundTotal)
        .sub(settlement.commissionAmount)
        .sub(settlement.fixedRentAmount)
        .add(adjustmentTotal);
      const updated = await transaction.merchantSettlement.updateMany({
        where: {
          id: settlementId,
          organizationId,
          status: SettlementStatus.DRAFT,
        },
        data: { adjustmentTotal, netPayout },
      });
      if (updated.count !== 1) this.throwDraftConflict();
      return this.loadView(transaction, organizationId, settlementId);
    });
  }

  private transitionSettlement(
    organizationId: string,
    settlementId: string,
    actorId: string,
    from: SettlementStatus,
    to: SettlementStatus,
    transitionData: (
      now: Date,
    ) => Prisma.MerchantSettlementUpdateManyMutationInput,
    allowedRoles: OrganizationRole[] = [
      OrganizationRole.OWNER,
      OrganizationRole.MANAGER,
    ],
  ): Promise<SettlementViewRecord> {
    return this.runFinanceMutation(async (transaction) => {
      await this.assertFinanceActor(
        transaction,
        organizationId,
        actorId,
        allowedRoles,
      );
      const settlement = await transaction.merchantSettlement.findFirst({
        where: { id: settlementId, organizationId },
        select: { status: true },
      });
      if (!settlement) throw new NotFoundException('Settlement not found');
      if (settlement.status !== from) {
        throw new ConflictException(
          `Settlement must be ${from.toLowerCase()} before it can be ${to.toLowerCase()}`,
        );
      }

      const updated = await transaction.merchantSettlement.updateMany({
        where: { id: settlementId, organizationId, status: from },
        data: { status: to, ...transitionData(new Date()) },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Settlement changed concurrently; reload and retry the request',
        );
      }
      const auditType =
        to === SettlementStatus.REVIEWED
          ? SettlementAuditEventType.REVIEWED
          : to === SettlementStatus.DRAFT
            ? SettlementAuditEventType.RETURNED_TO_DRAFT
            : SettlementAuditEventType.APPROVED;
      await transaction.settlementAuditEvent.create({
        data: { organizationId, settlementId, actorId, type: auditType },
      });
      return this.loadView(transaction, organizationId, settlementId);
    });
  }

  private async calculateSources(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    merchantId: string,
    period: DatePeriod,
    currentSettlementId?: string,
    offCycle = false,
    excludeFixedRent = false,
  ): Promise<SettlementCalculation> {
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
    if (!offCycle) this.assertNormalPeriod(period, agreements[0]);
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
        settlementLinks: currentSettlementId
          ? { none: { settlementId: { not: currentSettlementId } } }
          : { none: {} },
      },
      select: {
        id: true,
        total: true,
        sale: { select: { completedAt: true } },
      },
      orderBy: [{ sale: { completedAt: 'asc' } }, { id: 'asc' }],
    });
    const assignments = this.assignSales(segments, saleItems);
    const refundItems = await transaction.saleRefundItem.findMany({
      where: {
        organizationId,
        merchantId,
        refund: {
          status: 'COMPLETED',
          completedAt: {
            gte: philippineDayStart(period.start),
            lt: philippineDayStart(nextBusinessDate(period.end)),
          },
        },
        settlementLinks: currentSettlementId
          ? { none: { settlementId: { not: currentSettlementId } } }
          : { none: {} },
      },
      select: {
        id: true,
        amount: true,
        refund: { select: { completedAt: true } },
      },
      orderBy: [{ refund: { completedAt: 'asc' } }, { id: 'asc' }],
    });
    for (const refundItem of refundItems) {
      const completedDate = philippineDate(refundItem.refund.completedAt);
      const segment = segments.find(
        ({ start, end }) => completedDate >= start && completedDate <= end,
      );
      if (!segment) {
        throw new ConflictException(
          'One or more merchant refunds are not covered by an effective agreement',
        );
      }
      segment.refundTotal = segment.refundTotal.add(refundItem.amount);
    }
    this.calculateSegments(segments);
    if (excludeFixedRent) {
      for (const segment of segments)
        segment.fixedRentAmount = new Prisma.Decimal(0);
    }
    const grossSales = this.sum(segments.map(({ grossSales }) => grossSales));
    const refundTotal = this.sum(
      segments.map(({ refundTotal }) => refundTotal),
    );
    return {
      schedule: agreements[0].settlementSchedule,
      segments,
      assignments,
      refundItems,
      grossSales,
      refundTotal,
      netSales: grossSales.sub(refundTotal),
      commissionAmount: this.sum(
        segments.map(({ commissionAmount }) => commissionAmount),
      ),
      fixedRentAmount: this.sum(
        segments.map(({ fixedRentAmount }) => fixedRentAmount),
      ),
    };
  }

  private async requireDraft(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    settlementId: string,
  ) {
    const settlement = await transaction.merchantSettlement.findFirst({
      where: { id: settlementId, organizationId },
      select: {
        id: true,
        merchantId: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        grossSales: true,
        refundTotal: true,
        netSales: true,
        commissionAmount: true,
        fixedRentAmount: true,
      },
    });
    if (!settlement) throw new NotFoundException('Settlement not found');
    if (settlement.status !== SettlementStatus.DRAFT) {
      this.throwDraftConflict();
    }
    return settlement;
  }

  private async loadView(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    settlementId: string,
  ): Promise<SettlementViewRecord> {
    const settlement = await transaction.merchantSettlement.findFirstOrThrow({
      where: { id: settlementId, organizationId },
      include: settlementRecordInclude,
    });
    return this.toView(settlement);
  }

  private termData(
    segment: AgreementSegment,
    organizationId: string,
    merchantId: string,
  ) {
    return {
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
      refundTotal: segment.refundTotal,
      netSales: segment.netSales,
      commissionAmount: segment.commissionAmount,
      fixedRentAmount: segment.fixedRentAmount,
    };
  }

  private async runFinanceMutation<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' ||
          error.code === 'P2004' ||
          error.code === 'P2034')
      ) {
        throw new ConflictException(
          'Settlement changed concurrently; reload and retry the request',
        );
      }
      throw error;
    }
  }

  private throwDraftConflict(): never {
    throw new ConflictException('Only draft settlements can be changed');
  }

  private async assertFinanceActor(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    allowedRoles: OrganizationRole[] = [
      OrganizationRole.OWNER,
      OrganizationRole.MANAGER,
    ],
  ): Promise<void> {
    const membership = await transaction.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'Your organization role cannot manage settlements',
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
          refundTotal: new Prisma.Decimal(0),
          netSales: new Prisma.Decimal(0),
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
      segment.netSales = segment.grossSales.sub(segment.refundTotal);
      if (segment.netSales.lt(0)) {
        throw new ConflictException(
          'Refunds cannot exceed gross sales within an agreement segment',
        );
      }
      const commissionRate = segment.agreement.commissionRate;
      segment.commissionAmount = commissionRate
        ? this.roundMoney(segment.netSales.mul(commissionRate).div(100))
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

  private toSummary(settlement: SettlementSummaryRow): SettlementSummaryRecord {
    const { saleItems, refundItems, ...summary } = settlement;
    const branches = new Map<string, { id: string; name: string }>();
    for (const link of saleItems)
      branches.set(link.saleItem.sale.branch.id, link.saleItem.sale.branch);
    for (const link of refundItems)
      branches.set(
        link.refundItem.refund.branch.id,
        link.refundItem.refund.branch,
      );
    return {
      ...summary,
      branches: [...branches.values()].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      grossSales: this.money(settlement.grossSales),
      refundTotal: this.money(settlement.refundTotal),
      netSales: this.money(settlement.netSales),
      commissionAmount: this.money(settlement.commissionAmount),
      fixedRentAmount: this.money(settlement.fixedRentAmount),
      adjustmentTotal: this.money(settlement.adjustmentTotal),
      netPayout: this.money(settlement.netPayout),
    };
  }

  private toView(settlement: SettlementRecord): SettlementViewRecord {
    return {
      ...settlement,
      grossSales: this.money(settlement.grossSales),
      refundTotal: this.money(settlement.refundTotal),
      netSales: this.money(settlement.netSales),
      commissionAmount: this.money(settlement.commissionAmount),
      fixedRentAmount: this.money(settlement.fixedRentAmount),
      adjustmentTotal: this.money(settlement.adjustmentTotal),
      netPayout: this.money(settlement.netPayout),
      terms: settlement.terms.map((term) => ({
        ...term,
        fixedRentRate: term.fixedRentRate
          ? this.money(term.fixedRentRate)
          : null,
        commissionRate: term.commissionRate
          ? term.commissionRate.toFixed(2)
          : null,
        grossSales: this.money(term.grossSales),
        refundTotal: this.money(term.refundTotal),
        netSales: this.money(term.netSales),
        commissionAmount: this.money(term.commissionAmount),
        fixedRentAmount: this.money(term.fixedRentAmount),
      })),
      saleItems: settlement.saleItems.map((link) => ({
        ...link,
        grossAmount: this.money(link.grossAmount),
        saleItem: {
          ...link.saleItem,
          total: this.money(link.saleItem.total),
        },
      })),
      adjustments: settlement.adjustments.map((adjustment) => ({
        ...adjustment,
        amount: this.money(adjustment.amount),
      })),
      payout: settlement.payout
        ? { ...settlement.payout, amount: this.money(settlement.payout.amount) }
        : null,
      refundItems: settlement.refundItems.map((item) => ({
        ...item,
        refundAmount: this.money(item.refundAmount),
      })),
    };
  }

  private money(value: Prisma.Decimal | string): string {
    return typeof value === 'string' ? value : value.toFixed(2);
  }
}
