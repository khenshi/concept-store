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
  MerchantReceivableStatus,
  MerchantReceivableTransactionType,
  MerchantStatus,
  OrganizationRole,
  Prisma,
  SettlementStatus,
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
import type { MerchantAccountEntryDto } from './dto/merchant-account-entry.dto';
import type {
  SettlementReceivableDeductionDto,
  SettlementReceivableDeductionsDto,
} from './dto/settlement-receivable-deductions.dto';
import { MerchantReceivablesService } from '../merchant-receivables/merchant-receivables.service';
import {
  nextBusinessDate,
  nextScheduledDeadline,
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
  type LiveMerchantPayableRecord,
  type SettlementPreviewRecord,
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
  sale: { completedAt: Date; branch?: { id: string; name: string } };
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
  branches: Array<{ id: string; name: string }>;
}

interface AvailableReceivable {
  id: string;
  sourcePeriod: Date;
  dueDate: Date;
  status: string;
  remainingAmount: Prisma.Decimal;
  reservedAmount: Prisma.Decimal;
  availableAmount: Prisma.Decimal;
}

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantReceivables: MerchantReceivablesService,
  ) {}

  async findLivePayables(
    organizationId: string,
    merchantId?: string,
    branchId?: string,
  ): Promise<LiveMerchantPayableRecord[]> {
    await this.merchantReceivables.ensureCurrentRentReceivables(organizationId);
    const today = currentPhilippineBusinessDate();
    const merchants = await this.prisma.merchant.findMany({
      where: {
        organizationId,
        id: merchantId,
        status: MerchantStatus.ACTIVE,
        branches: branchId ? { some: { organizationId, branchId } } : undefined,
      },
      select: {
        id: true,
        name: true,
        code: true,
        agreements: {
          where: {
            status: AgreementStatus.ACTIVE,
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
          select: { id: true },
          take: 1,
        },
        branches: {
          select: { branch: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const rows = await Promise.all(
      merchants.map(async (merchant) => {
        const branches = merchant.branches.map(({ branch }) => branch);
        const identity = {
          id: merchant.id,
          name: merchant.name,
          code: merchant.code,
        };
        return merchant.agreements.length
          ? await this.livePayableForMerchant(
              organizationId,
              identity,
              branches,
            )
          : this.emptyLivePayable(identity, branches, today);
      }),
    );
    return rows;
  }

  async closeLivePayable(
    organizationId: string,
    merchantId: string,
    actorId: string,
    dto: SettlementReceivableDeductionsDto,
  ): Promise<SettlementViewRecord> {
    await this.merchantReceivables.ensureCurrentRentReceivables(organizationId);
    const context = await this.liveContext(organizationId, merchantId);
    if (context.openSettlement) {
      throw new ConflictException(
        'Finish the existing settlement before closing this live balance',
      );
    }
    return this.generateDraft(
      organizationId,
      merchantId,
      actorId,
      context.periodStart.toISOString().slice(0, 10),
      context.asOf.toISOString().slice(0, 10),
      {
        liveClosure: true,
        scheduledDeadline: context.deadline,
        receivableDeductions: dto.receivableDeductions,
      },
    );
  }

  async previewLivePayable(
    organizationId: string,
    merchantId: string,
    dto: SettlementReceivableDeductionsDto,
  ): Promise<SettlementPreviewRecord> {
    await this.merchantReceivables.ensureCurrentRentReceivables(organizationId);
    const context = await this.liveContext(organizationId, merchantId);
    if (context.openSettlement) {
      throw new ConflictException(
        'Finish the existing settlement before previewing a new closure',
      );
    }
    return this.prisma.$transaction(async (transaction) => {
      const calculation = await this.calculateSources(
        transaction,
        organizationId,
        merchantId,
        { start: context.periodStart, end: context.asOf },
        undefined,
        true,
      );
      const pending = await transaction.merchantFinanceEntry.aggregate({
        where: {
          organizationId,
          merchantId,
          settlementId: null,
        },
        _sum: { amount: true },
      });
      const adjustmentTotal = pending._sum.amount ?? new Prisma.Decimal(0);
      const merchantPayable = calculation.netSales
        .sub(calculation.commissionAmount)
        .add(adjustmentTotal);
      const receivables = await this.availableReceivables(
        transaction,
        organizationId,
        merchantId,
      );
      const deductions = this.validateReceivableDeductions(
        dto.receivableDeductions,
        receivables,
        merchantPayable,
      );
      const deductionTotal = this.sum(deductions.map(({ amount }) => amount));
      const merchant = await transaction.merchant.findFirstOrThrow({
        where: { id: merchantId, organizationId },
        select: { id: true, name: true, code: true },
      });
      return {
        merchant,
        periodStart: context.periodStart.toISOString().slice(0, 10),
        cutoff: context.asOf.toISOString().slice(0, 10),
        scheduledDeadline: context.deadline.toISOString().slice(0, 10),
        grossSales: this.money(calculation.grossSales),
        refundTotal: this.money(calculation.refundTotal),
        netSales: this.money(calculation.netSales),
        commissionAmount: this.money(calculation.commissionAmount),
        adjustmentTotal: this.money(adjustmentTotal),
        merchantPayable: this.money(merchantPayable),
        receivables: receivables.map((receivable) => ({
          id: receivable.id,
          sourcePeriod: receivable.sourcePeriod,
          dueDate: receivable.dueDate,
          status: receivable.status,
          remainingAmount: this.money(receivable.remainingAmount),
          reservedAmount: this.money(receivable.reservedAmount),
          availableAmount: this.money(receivable.availableAmount),
        })),
        receivableDeductionTotal: this.money(deductionTotal),
        finalPayout: this.money(merchantPayable.sub(deductionTotal)),
      };
    });
  }

  async addAccountEntry(
    organizationId: string,
    merchantId: string,
    actorId: string,
    dto: MerchantAccountEntryDto,
  ): Promise<LiveMerchantPayableRecord> {
    await this.runFinanceMutation(async (transaction) => {
      await this.assertFinanceActor(transaction, organizationId, actorId);
      await this.assertMerchant(transaction, organizationId, merchantId);
      const amount = new Prisma.Decimal(dto.amount);
      await transaction.merchantFinanceEntry.create({
        data: {
          organizationId,
          merchantId,
          amount,
          reason: dto.reason,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
          createdById: actorId,
        },
      });
    });
    return this.livePayableForMerchantById(organizationId, merchantId);
  }

  async removeAccountEntry(
    organizationId: string,
    merchantId: string,
    adjustmentId: string,
    actorId: string,
  ): Promise<LiveMerchantPayableRecord> {
    await this.runFinanceMutation(async (transaction) => {
      await this.assertFinanceActor(transaction, organizationId, actorId);
      const removed = await transaction.merchantFinanceEntry.deleteMany({
        where: {
          id: adjustmentId,
          organizationId,
          merchantId,
          settlementId: null,
        },
      });
      if (removed.count !== 1)
        throw new NotFoundException('Live adjustment not found');
    });
    return this.livePayableForMerchantById(organizationId, merchantId);
  }

  async generateDraft(
    organizationId: string,
    merchantId: string,
    calculatedById: string,
    periodStart: string,
    periodEnd: string,
    options: {
      liveClosure?: boolean;
      scheduledDeadline?: Date;
      receivableDeductions?: SettlementReceivableDeductionDto[];
    } = {},
  ): Promise<SettlementViewRecord> {
    const period = parseSettlementPeriod(periodStart, periodEnd);
    if (!options.liveClosure && period.end >= currentPhilippineBusinessDate()) {
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

          if (options.liveClosure) {
            const openSettlement =
              await transaction.merchantSettlement.findFirst({
                where: {
                  organizationId,
                  merchantId,
                  status: {
                    in: [
                      SettlementStatus.DRAFT,
                      SettlementStatus.REVIEWED,
                      SettlementStatus.APPROVED,
                    ],
                  },
                },
                select: { id: true },
              });
            if (openSettlement)
              throw new ConflictException(
                'Finish the existing settlement before closing this live balance',
              );
          }

          const calculation = await this.calculateSources(
            transaction,
            organizationId,
            merchantId,
            period,
            undefined,
            options.liveClosure,
          );
          const pending = options.liveClosure
            ? await transaction.merchantFinanceEntry.aggregate({
                where: {
                  organizationId,
                  merchantId,
                  settlementId: null,
                },
                _sum: { amount: true },
              })
            : null;
          const adjustmentTotal = pending?._sum.amount ?? new Prisma.Decimal(0);
          const merchantPayable = calculation.netSales
            .sub(calculation.commissionAmount)
            .add(adjustmentTotal);
          const receivables = options.liveClosure
            ? await this.availableReceivables(
                transaction,
                organizationId,
                merchantId,
              )
            : [];
          const receivableDeductions = this.validateReceivableDeductions(
            options.receivableDeductions ?? [],
            receivables,
            merchantPayable,
          );
          const fixedRentAmount = this.sum(
            receivableDeductions.map(({ amount }) => amount),
          );
          const netPayout = merchantPayable.sub(fixedRentAmount);

          const settlement = await transaction.merchantSettlement.create({
            data: {
              organizationId,
              merchantId,
              periodStart: period.start,
              periodEnd: period.end,
              scheduledDeadline: options.scheduledDeadline ?? period.end,
              schedule: calculation.schedule,
              grossSales: calculation.grossSales,
              refundTotal: calculation.refundTotal,
              netSales: calculation.netSales,
              commissionAmount: calculation.commissionAmount,
              fixedRentAmount,
              adjustmentTotal,
              netPayout,
              calculatedById,
              terms: {
                create: calculation.segments.map((segment) =>
                  this.termData(segment),
                ),
              },
            },
            select: { id: true },
          });

          if (options.liveClosure) {
            await transaction.merchantFinanceEntry.updateMany({
              where: {
                organizationId,
                merchantId,
                settlementId: null,
              },
              data: { settlementId: settlement.id },
            });
            if (receivableDeductions.length) {
              await transaction.settlementReceivableAllocation.createMany({
                data: receivableDeductions.map((deduction) => ({
                  organizationId,
                  merchantId,
                  settlementId: settlement.id,
                  receivableId: deduction.receivableId,
                  amount: deduction.amount,
                })),
              });
            }
          }

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
              type: SettlementAuditEventType.MANUALLY_GENERATED,
              reason: options.liveClosure ? 'Live payable closure' : undefined,
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

  approve(
    organizationId: string,
    settlementId: string,
    actorId: string,
  ): Promise<SettlementViewRecord> {
    return this.runFinanceMutation(async (transaction) => {
      await this.assertFinanceActor(transaction, organizationId, actorId, [
        OrganizationRole.OWNER,
      ]);
      const now = new Date();
      const updated = await transaction.merchantSettlement.updateMany({
        where: {
          id: settlementId,
          organizationId,
          status: SettlementStatus.REVIEWED,
        },
        data: {
          status: SettlementStatus.APPROVED,
          approvedById: actorId,
          approvedAt: now,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'Settlement must be reviewed before it can be approved',
        );
      await transaction.settlementAuditEvent.create({
        data: {
          organizationId,
          settlementId,
          actorId,
          type: SettlementAuditEventType.APPROVED,
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
    return this.runFinanceMutation(async (transaction) => {
      await this.assertFinanceActor(transaction, organizationId, actorId);
      const now = new Date();
      const updated = await transaction.merchantSettlement.updateMany({
        where: {
          id: settlementId,
          organizationId,
          status: SettlementStatus.DRAFT,
        },
        data: {
          status: SettlementStatus.REVIEWED,
          reviewedById: actorId,
          reviewedAt: now,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('Only a draft settlement can be reviewed');
      await transaction.settlementAuditEvent.create({
        data: {
          organizationId,
          settlementId,
          actorId,
          type: SettlementAuditEventType.REVIEWED,
        },
      });
      return this.loadView(transaction, organizationId, settlementId);
    });
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
      if (settlement.netPayout.lt(0)) {
        throw new BadRequestException(
          'A settlement with a negative payout cannot be paid',
        );
      }

      const allocations =
        await transaction.settlementReceivableAllocation.findMany({
          where: { organizationId, settlementId, appliedAt: null },
        });
      const appliedAt = new Date();
      for (const allocation of allocations) {
        const updatedReceivable =
          await transaction.merchantReceivable.updateMany({
            where: {
              id: allocation.receivableId,
              organizationId,
              merchantId: settlement.merchantId,
              remainingAmount: { gte: allocation.amount },
              status: { not: MerchantReceivableStatus.PAID },
            },
            data: { remainingAmount: { decrement: allocation.amount } },
          });
        if (updatedReceivable.count !== 1) {
          throw new ConflictException(
            'A rent receivable changed after settlement approval; reload and review it',
          );
        }
        const receivable =
          await transaction.merchantReceivable.findUniqueOrThrow({
            where: { id: allocation.receivableId },
          });
        await transaction.merchantReceivable.update({
          where: { id: allocation.receivableId },
          data: {
            status: receivable.remainingAmount.isZero()
              ? MerchantReceivableStatus.PAID
              : receivable.dueDate < currentPhilippineBusinessDate()
                ? MerchantReceivableStatus.OVERDUE
                : MerchantReceivableStatus.PARTIALLY_PAID,
          },
        });
        await transaction.merchantReceivableTransaction.create({
          data: {
            organizationId,
            merchantId: settlement.merchantId,
            receivableId: allocation.receivableId,
            settlementId,
            type: MerchantReceivableTransactionType.SETTLEMENT_DEDUCTION,
            amount: allocation.amount,
            occurredAt: paidAt,
            recordedById: actorId,
          },
        });
      }
      if (allocations.length) {
        await transaction.settlementReceivableAllocation.updateMany({
          where: { organizationId, settlementId, appliedAt: null },
          data: { appliedAt },
        });
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

  private async calculateSources(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    merchantId: string,
    period: DatePeriod,
    currentSettlementId?: string,
    allowPartialPeriod = false,
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
    if (!allowPartialPeriod) this.assertNormalPeriod(period, agreements[0]);
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
        sale: {
          select: {
            completedAt: true,
            branch: { select: { id: true, name: true } },
          },
        },
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
        refund: {
          select: {
            completedAt: true,
            branch: { select: { id: true, name: true } },
          },
        },
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
    const grossSales = this.sum(segments.map(({ grossSales }) => grossSales));
    const refundTotal = this.sum(
      segments.map(({ refundTotal }) => refundTotal),
    );
    const branches = new Map<string, { id: string; name: string }>();
    for (const item of saleItems)
      if (item.sale.branch) branches.set(item.sale.branch.id, item.sale.branch);
    for (const item of refundItems)
      if (item.refund.branch)
        branches.set(item.refund.branch.id, item.refund.branch);
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
      branches: [...branches.values()].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    };
  }

  private async livePayableForMerchantById(
    organizationId: string,
    merchantId: string,
  ): Promise<LiveMerchantPayableRecord> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, organizationId },
      select: { id: true, name: true, code: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return this.livePayableForMerchant(organizationId, merchant);
  }

  private async livePayableForMerchant(
    organizationId: string,
    merchant: { id: string; name: string; code: string | null },
    configuredBranches: Array<{ id: string; name: string }> = [],
  ): Promise<LiveMerchantPayableRecord> {
    const context = await this.liveContext(organizationId, merchant.id);
    const liveCalculation =
      context.periodStart <= context.asOf
        ? await this.prisma.$transaction((transaction) =>
            Promise.all([
              this.calculateSources(
                transaction,
                organizationId,
                merchant.id,
                { start: context.periodStart, end: context.asOf },
                undefined,
                true,
              ),
              transaction.merchantReceivable.aggregate({
                where: {
                  organizationId,
                  merchantId: merchant.id,
                  remainingAmount: { gt: 0 },
                },
                _sum: { remainingAmount: true },
              }),
              !context.openSettlement &&
              context.deadline < context.asOf &&
              context.periodStart <= context.deadline
                ? this.calculateSources(
                    transaction,
                    organizationId,
                    merchant.id,
                    { start: context.periodStart, end: context.deadline },
                    undefined,
                    true,
                  )
                : Promise.resolve(null),
            ]),
          )
        : null;
    const calculation = liveCalculation?.[0] ?? null;
    const receivableBalance = liveCalculation?.[1] ?? null;
    const overdueCalculation = liveCalculation?.[2] ?? null;
    const pendingEntries = await this.prisma.merchantFinanceEntry.findMany({
      where: {
        organizationId,
        merchantId: merchant.id,
        settlementId: null,
      },
      select: {
        id: true,
        amount: true,
        reason: true,
        occurredAt: true,
        createdById: true,
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
    const zero = new Prisma.Decimal(0);
    const open = context.openSettlement;
    const grossSales = new Prisma.Decimal(open?.grossSales ?? zero).add(
      calculation?.grossSales ?? zero,
    );
    const refunds = new Prisma.Decimal(open?.refundTotal ?? zero).add(
      calculation?.refundTotal ?? zero,
    );
    const commission = new Prisma.Decimal(open?.commissionAmount ?? zero).add(
      calculation?.commissionAmount ?? zero,
    );
    const pendingAdjustments = this.sum(
      pendingEntries.map(({ amount }) => amount),
    );
    const rent = open ? new Prisma.Decimal(open.fixedRentAmount) : zero;
    const rentOutstanding =
      receivableBalance?._sum.remainingAmount ?? new Prisma.Decimal(0);
    const adjustments = new Prisma.Decimal(open?.adjustmentTotal ?? zero).add(
      pendingAdjustments,
    );
    const branches = new Map<string, { id: string; name: string }>();
    for (const branch of configuredBranches) branches.set(branch.id, branch);
    for (const branch of open?.branches ?? []) branches.set(branch.id, branch);
    for (const branch of calculation?.branches ?? [])
      branches.set(branch.id, branch);
    const amountDue = grossSales
      .sub(refunds)
      .sub(commission)
      .sub(rent)
      .add(adjustments);
    const deadlineIsOverdue = context.deadline < context.asOf;
    const overdueAdjustments = deadlineIsOverdue
      ? this.sum(
          pendingEntries
            .filter(
              (entry) => philippineDate(entry.occurredAt) <= context.deadline,
            )
            .map(({ amount }) => amount),
        )
      : zero;
    const overdueAmount = context.openSettlement
      ? deadlineIsOverdue
        ? new Prisma.Decimal(context.openSettlement.netPayout)
        : zero
      : overdueCalculation
        ? overdueCalculation.netSales
            .sub(overdueCalculation.commissionAmount)
            .add(overdueAdjustments)
        : zero;
    const hasActivity =
      !grossSales.isZero() ||
      !refunds.isZero() ||
      !commission.isZero() ||
      !rentOutstanding.isZero() ||
      !adjustments.isZero() ||
      Boolean(open);
    return {
      merchant,
      financeStatus: hasActivity
        ? deadlineIsOverdue
          ? 'OVERDUE'
          : 'READY'
        : 'NO_ACTIVITY',
      periodStart: context.displayPeriodStart.toISOString().slice(0, 10),
      asOf: context.asOf.toISOString().slice(0, 10),
      nextSettlementDeadline: context.deadline.toISOString().slice(0, 10),
      schedule: context.schedule,
      grossSales: this.money(grossSales),
      refundTotal: this.money(refunds),
      netSales: this.money(grossSales.sub(refunds)),
      commissionAmount: this.money(commission),
      fixedRentAmount: this.money(rent),
      rentOutstandingAmount: this.money(rentOutstanding),
      adjustmentTotal: this.money(adjustments),
      amountDue: this.money(amountDue),
      overdueAmount: this.money(overdueAmount),
      newActivityAmount: this.money(amountDue.sub(overdueAmount)),
      branches: [...branches.values()].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      pendingSettlement: open ? { id: open.id, status: open.status } : null,
      accountEntries: pendingEntries.map((entry) => ({
        id: entry.id,
        amount: this.money(entry.amount),
        reason: entry.reason,
        occurredAt: entry.occurredAt,
        createdById: entry.createdById,
      })),
    };
  }

  private emptyLivePayable(
    merchant: { id: string; name: string; code: string | null },
    branches: Array<{ id: string; name: string }>,
    asOf: Date,
  ): LiveMerchantPayableRecord {
    return {
      merchant,
      financeStatus: 'AGREEMENT_REQUIRED',
      periodStart: null,
      asOf: asOf.toISOString().slice(0, 10),
      nextSettlementDeadline: null,
      schedule: null,
      grossSales: '0.00',
      refundTotal: '0.00',
      netSales: '0.00',
      commissionAmount: '0.00',
      fixedRentAmount: '0.00',
      rentOutstandingAmount: '0.00',
      adjustmentTotal: '0.00',
      amountDue: '0.00',
      overdueAmount: '0.00',
      newActivityAmount: '0.00',
      branches,
      pendingSettlement: null,
      accountEntries: [],
    };
  }

  private async liveContext(organizationId: string, merchantId: string) {
    const today = currentPhilippineBusinessDate();
    const [agreement, firstAgreement, paid, openSettlement] = await Promise.all(
      [
        this.prisma.merchantAgreement.findFirst({
          where: {
            organizationId,
            merchantId,
            status: AgreementStatus.ACTIVE,
            startDate: { lte: today },
          },
          orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        }),
        this.prisma.merchantAgreement.findFirst({
          where: {
            organizationId,
            merchantId,
            status: { in: [AgreementStatus.ACTIVE, AgreementStatus.ENDED] },
            startDate: { lte: today },
          },
          orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.merchantSettlement.findFirst({
          where: { organizationId, merchantId, status: SettlementStatus.PAID },
          orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.merchantSettlement.findFirst({
          where: {
            organizationId,
            merchantId,
            status: {
              in: [
                SettlementStatus.DRAFT,
                SettlementStatus.REVIEWED,
                SettlementStatus.APPROVED,
              ],
            },
          },
          include: settlementSummaryInclude,
          orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
        }),
      ],
    );
    if (!agreement)
      throw new ConflictException('Merchant has no active agreement');
    const paidDeadline = paid?.scheduledDeadline ?? paid?.periodEnd;
    const deadline = openSettlement
      ? (openSettlement.scheduledDeadline ?? openSettlement.periodEnd)
      : paidDeadline
        ? nextScheduledDeadline(paidDeadline, agreement.settlementSchedule)
        : normalSettlementPeriod(today, agreement.settlementSchedule).end;
    const baseStart = paid
      ? nextBusinessDate(paid.periodEnd)
      : (firstAgreement?.startDate ?? agreement.startDate);
    const periodStart = openSettlement
      ? nextBusinessDate(openSettlement.periodEnd)
      : baseStart;
    return {
      schedule: agreement.settlementSchedule,
      deadline,
      asOf: today,
      periodStart,
      displayPeriodStart: baseStart,
      openSettlement: openSettlement
        ? {
            ...this.toSummary(openSettlement),
            branches: this.toSummary(openSettlement).branches,
          }
        : null,
    };
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

  private termData(segment: AgreementSegment) {
    return {
      id: segment.id,
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
      const commissionRate = segment.agreement.commissionRate;
      segment.commissionAmount =
        commissionRate && segment.netSales.gt(0)
          ? this.roundMoney(segment.netSales.mul(commissionRate).div(100))
          : new Prisma.Decimal(0);

      segment.fixedRentAmount = new Prisma.Decimal(0);
    }
  }

  private async availableReceivables(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    merchantId: string,
  ): Promise<AvailableReceivable[]> {
    const rows = await transaction.merchantReceivable.findMany({
      where: {
        organizationId,
        merchantId,
        remainingAmount: { gt: 0 },
        status: { not: MerchantReceivableStatus.PAID },
      },
      include: {
        allocations: { where: { appliedAt: null }, select: { amount: true } },
      },
      orderBy: [{ sourcePeriod: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => {
      const reservedAmount = this.sum(
        row.allocations.map(({ amount }) => amount),
      );
      return {
        id: row.id,
        sourcePeriod: row.sourcePeriod,
        dueDate: row.dueDate,
        status: row.status,
        remainingAmount: row.remainingAmount,
        reservedAmount,
        availableAmount: Prisma.Decimal.max(
          row.remainingAmount.sub(reservedAmount),
          0,
        ),
      };
    });
  }

  private validateReceivableDeductions(
    requested: SettlementReceivableDeductionDto[],
    available: AvailableReceivable[],
    merchantPayable: Prisma.Decimal,
  ): Array<{ receivableId: string; amount: Prisma.Decimal }> {
    if (merchantPayable.lt(0)) {
      throw new BadRequestException(
        'The merchant payable cannot be negative; correct the adjustments before settlement',
      );
    }
    const unique = new Set(requested.map(({ receivableId }) => receivableId));
    if (unique.size !== requested.length) {
      throw new BadRequestException(
        'Each receivable may be selected only once',
      );
    }
    const rows = requested.map((deduction) => {
      const receivable = available.find(
        ({ id }) => id === deduction.receivableId,
      );
      const amount = new Prisma.Decimal(deduction.amount);
      if (!receivable || amount.gt(receivable.availableAmount)) {
        throw new BadRequestException(
          'A selected receivable is unavailable or exceeds its remaining balance',
        );
      }
      return { receivableId: deduction.receivableId, amount };
    });
    if (this.sum(rows.map(({ amount }) => amount)).gt(merchantPayable)) {
      throw new BadRequestException(
        'Receivable deductions cannot exceed the merchant payable',
      );
    }
    return rows;
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
    const { terms, receivableAllocations, ...settlementWithoutAccrual } =
      settlement;
    return {
      ...settlementWithoutAccrual,
      grossSales: this.money(settlement.grossSales),
      refundTotal: this.money(settlement.refundTotal),
      netSales: this.money(settlement.netSales),
      commissionAmount: this.money(settlement.commissionAmount),
      fixedRentAmount: this.money(settlement.fixedRentAmount),
      adjustmentTotal: this.money(settlement.adjustmentTotal),
      netPayout: this.money(settlement.netPayout),
      terms: terms.map((term) => {
        return {
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
        };
      }),
      saleItems: settlement.saleItems.map((link) => ({
        ...link,
        grossAmount: this.money(link.grossAmount),
        saleItem: {
          ...link.saleItem,
          total: this.money(link.saleItem.total),
        },
      })),
      financeEntries: settlement.financeEntries.map((entry) => ({
        ...entry,
        amount: this.money(entry.amount),
      })),
      payout: settlement.payout
        ? { ...settlement.payout, amount: this.money(settlement.payout.amount) }
        : null,
      refundItems: settlement.refundItems.map((item) => ({
        ...item,
        refundAmount: this.money(item.refundAmount),
      })),
      receivableAllocations: receivableAllocations.map((allocation) => ({
        ...allocation,
        amount: this.money(allocation.amount),
        receivable: {
          ...allocation.receivable,
          originalAmount: this.money(allocation.receivable.originalAmount),
          remainingAmount: this.money(allocation.receivable.remainingAmount),
        },
      })),
    };
  }

  private money(value: Prisma.Decimal | string): string {
    return typeof value === 'string' ? value : value.toFixed(2);
  }
}
