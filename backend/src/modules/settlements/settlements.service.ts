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
  PayoutMethod,
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
import type { ListLivePayablesQueryDto } from './dto/list-live-payables-query.dto';
import type { RecordPayoutDto } from './dto/record-payout.dto';
import type { MerchantAccountEntryDto } from './dto/merchant-account-entry.dto';
import type { SettlementReceivableDeductionsDto } from './dto/settlement-receivable-deductions.dto';
import type { CancelSettlementDto } from './dto/cancel-settlement.dto';
import { MerchantReceivablesService } from '../merchant-receivables/merchant-receivables.service';
import { MerchantFinanceAccrualService } from '../merchant-finance-accrual/merchant-finance-accrual.service';
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
  type LiveMerchantPayablePageRecord,
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

interface RequestedRentApplication {
  receivableId: string;
  amount: string;
}

interface ProjectedPayableCalculation {
  grossSales: Prisma.Decimal;
  refundTotal: Prisma.Decimal;
  netSales: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  revision: string;
}

interface PrefetchedLivePayable {
  calculation: ProjectedPayableCalculation;
  rentOutstanding: Prisma.Decimal;
  entries: Array<{
    id: string;
    amount: Prisma.Decimal;
    reason: string;
    occurredAt: Date;
    createdById: string;
  }>;
}

class PayableProjectionMismatchError extends Error {}

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantReceivables: MerchantReceivablesService,
    private readonly financeAccrual: MerchantFinanceAccrualService,
  ) {}

  async findLivePayables(
    organizationId: string,
    query: ListLivePayablesQueryDto,
  ): Promise<LiveMerchantPayablePageRecord> {
    await this.merchantReceivables.ensureCurrentRentReceivables(organizationId);
    const today = currentPhilippineBusinessDate();
    const where: Prisma.MerchantWhereInput = {
      organizationId,
      id: query.merchantId,
      status: MerchantStatus.ACTIVE,
      branches: query.branchId
        ? { some: { organizationId, branchId: query.branchId } }
        : undefined,
    };
    const [merchants, total] = await this.prisma.$transaction([
      this.prisma.merchant.findMany({
        where,
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
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.merchant.count({ where }),
    ]);
    const prefetched = await this.prefetchLivePayables(
      organizationId,
      merchants.map(({ id }) => id),
    );
    const [rows, summary] = await Promise.all([
      this.mapInBatches(merchants, async (merchant) => {
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
              prefetched.get(merchant.id),
            )
          : this.emptyLivePayable(identity, branches, today);
      }),
      this.globalLiveSummary(organizationId),
    ]);
    return {
      items: rows,
      total,
      offset: query.offset,
      limit: query.limit,
      summary: {
        grossSales: this.money(summary.grossSales),
        refunds: this.money(summary.refunds),
        netSales: this.money(summary.netSales),
        commission: this.money(summary.commission),
        adjustments: this.money(summary.adjustments),
        deductions: this.money(summary.deductions),
        amountDue: this.money(summary.amountDue),
        merchantCount: summary.merchantCount,
      },
    };
  }

  async closeLivePayable(
    organizationId: string,
    merchantId: string,
    actorId: string,
    dto: SettlementReceivableDeductionsDto,
  ): Promise<SettlementViewRecord> {
    await this.merchantReceivables.ensureCurrentRentReceivables(organizationId);
    if (dto.requestId) {
      const prior = await this.prisma.merchantSettlement.findFirst({
        where: {
          organizationId,
          merchantId,
          closureRequestId: dto.requestId,
        },
        select: { id: true },
      });
      if (prior) return this.findOne(organizationId, prior.id);
    }
    const context = await this.liveContext(organizationId, merchantId);
    if (context.openSettlement) {
      throw new ConflictException(
        'Finish the existing settlement before closing this live balance',
      );
    }
    try {
      return await this.generateDraft(
        organizationId,
        merchantId,
        actorId,
        context.periodStart.toISOString().slice(0, 10),
        context.asOf.toISOString().slice(0, 10),
        {
          liveClosure: true,
          scheduledDeadline: context.deadline,
          deductOutstandingRent: dto.deductOutstandingRent,
          rentApplications: dto.rentApplications,
          requestId: dto.requestId,
          previewRevision: dto.previewRevision,
        },
      );
    } catch (error: unknown) {
      if (error instanceof PayableProjectionMismatchError) {
        await this.runSerializableTransaction(
          (transaction) =>
            this.financeAccrual.rebuildMerchant(
              transaction,
              organizationId,
              merchantId,
            ),
          3,
        );
        throw new ConflictException(
          'The live payable projection was repaired; refresh the preview before closing',
        );
      }
      if (dto.requestId && error instanceof ConflictException) {
        const prior = await this.prisma.merchantSettlement.findFirst({
          where: {
            organizationId,
            merchantId,
            closureRequestId: dto.requestId,
          },
          select: { id: true },
        });
        if (prior) return this.findOne(organizationId, prior.id);
      }
      throw error;
    }
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
      const calculation = await this.projectedCalculation(
        transaction,
        organizationId,
        merchantId,
      );
      const pending = await transaction.merchantFinanceEntry.aggregate({
        where: {
          organizationId,
          merchantId,
          settlementId: null,
          voidedAt: null,
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
      const rentDeductionEligible = this.rentDeductionEligible(
        receivables,
        merchantPayable,
      );
      const deductions = this.allocateRentDeduction(
        dto.deductOutstandingRent,
        receivables,
        merchantPayable,
        dto.rentApplications,
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
        rentDeductionEligible: rentDeductionEligible.eligible,
        rentDeductionReason: rentDeductionEligible.reason,
        rentApplications: deductions.map((deduction) => ({
          receivableId: deduction.receivableId,
          amount: this.money(deduction.amount),
        })),
        previewRevision: this.previewRevision(
          calculation,
          adjustmentTotal,
          receivables,
          calculation.revision,
        ),
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
      const removed = await transaction.merchantFinanceEntry.updateMany({
        where: {
          id: adjustmentId,
          organizationId,
          merchantId,
          settlementId: null,
          voidedAt: null,
        },
        data: {
          voidedAt: new Date(),
          voidedById: actorId,
          voidReason: 'Removed from live payable',
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
      deductOutstandingRent?: boolean;
      rentApplications?: RequestedRentApplication[];
      requestId?: string;
      previewRevision?: string;
    } = {},
  ): Promise<SettlementViewRecord> {
    const period = parseSettlementPeriod(periodStart, periodEnd);
    if (!options.liveClosure && period.end >= currentPhilippineBusinessDate()) {
      throw new BadRequestException(
        'Settlement periods must end before the current business date',
      );
    }

    try {
      return await this.runSerializableTransaction(async (transaction) => {
        await this.assertFinanceActor(
          transaction,
          organizationId,
          calculatedById,
        );
        await this.assertMerchant(transaction, organizationId, merchantId);

        if (options.requestId) {
          const prior = await transaction.merchantSettlement.findFirst({
            where: {
              organizationId,
              merchantId,
              closureRequestId: options.requestId,
            },
            include: settlementRecordInclude,
          });
          if (prior) return this.toView(prior);
        }

        if (options.liveClosure) {
          const openSettlement = await transaction.merchantSettlement.findFirst(
            {
              where: {
                organizationId,
                merchantId,
                status: {
                  in: [SettlementStatus.DRAFT, SettlementStatus.APPROVED],
                },
              },
              select: { id: true },
            },
          );
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
        const projected = options.liveClosure
          ? await this.projectedCalculation(
              transaction,
              organizationId,
              merchantId,
            )
          : null;
        const pending = options.liveClosure
          ? await transaction.merchantFinanceEntry.aggregate({
              where: {
                organizationId,
                merchantId,
                settlementId: null,
                voidedAt: null,
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
        const receivableDeductions = this.allocateRentDeduction(
          options.deductOutstandingRent,
          receivables,
          merchantPayable,
          options.rentApplications,
        );
        const fixedRentAmount = this.sum(
          receivableDeductions.map(({ amount }) => amount),
        );
        const netPayout = merchantPayable.sub(fixedRentAmount);

        if (options.previewRevision) {
          const expected = this.previewRevision(
            projected ?? calculation,
            adjustmentTotal,
            receivables,
            projected?.revision,
          );
          if (expected !== options.previewRevision) {
            throw new ConflictException(
              'The live payable changed after preview; refresh and review it again',
            );
          }
        }
        if (
          projected &&
          (!projected.grossSales.eq(calculation.grossSales) ||
            !projected.refundTotal.eq(calculation.refundTotal) ||
            !projected.commissionAmount.eq(calculation.commissionAmount))
        ) {
          throw new PayableProjectionMismatchError(
            'Projected payable does not match authoritative sources',
          );
        }

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
            closureRequestId: options.requestId,
          },
          select: { id: true },
        });

        await transaction.settlementTermSnapshot.createMany({
          data: calculation.segments.map((segment) => ({
            ...this.termData(segment),
            settlementId: settlement.id,
            organizationId,
            merchantId,
          })),
        });

        if (options.liveClosure) {
          await transaction.merchantFinanceEntry.updateMany({
            where: {
              organizationId,
              merchantId,
              settlementId: null,
              voidedAt: null,
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
        await this.financeAccrual.rebuildMerchant(
          transaction,
          organizationId,
          merchantId,
        );
        await transaction.settlementAuditEvent.create({
          data: {
            organizationId,
            settlementId: settlement.id,
            actorId: calculatedById,
            type: SettlementAuditEventType.MANUALLY_GENERATED,
            reason: options.liveClosure ? 'Live payable closure' : undefined,
          },
        });

        const record = await transaction.merchantSettlement.findUniqueOrThrow({
          where: {
            id_merchantId_organizationId: {
              id: settlement.id,
              merchantId,
              organizationId,
            },
          },
          include: settlementRecordInclude,
        });
        return this.toView(record);
      }, 3);
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
          status: {
            in: [SettlementStatus.DRAFT],
          },
        },
        data: {
          status: SettlementStatus.APPROVED,
          approvedById: actorId,
          approvedAt: now,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('Only a draft settlement can be approved');
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

  cancel(
    organizationId: string,
    settlementId: string,
    actorId: string,
    dto: CancelSettlementDto,
  ): Promise<SettlementViewRecord> {
    return this.runFinanceMutation(async (transaction) => {
      await this.assertFinanceActor(transaction, organizationId, actorId);
      const settlement = await transaction.merchantSettlement.findFirst({
        where: { id: settlementId, organizationId },
        select: { merchantId: true },
      });
      if (!settlement) throw new NotFoundException('Settlement not found');
      const now = new Date();
      const updated = await transaction.merchantSettlement.updateMany({
        where: {
          id: settlementId,
          organizationId,
          status: { in: [SettlementStatus.DRAFT] },
        },
        data: {
          status: SettlementStatus.CANCELLED,
          cancelledAt: now,
          cancelledById: actorId,
          cancellationReason: dto.reason,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Only an unpaid draft settlement can be cancelled',
        );
      }
      await transaction.settlementReceivableAllocation.updateMany({
        where: {
          organizationId,
          settlementId,
          appliedAt: null,
          releasedAt: null,
        },
        data: { releasedAt: now },
      });
      await transaction.settlementSaleItem.updateMany({
        where: { organizationId, settlementId, releasedAt: null },
        data: { releasedAt: now },
      });
      await transaction.settlementRefundItem.updateMany({
        where: { organizationId, settlementId, releasedAt: null },
        data: { releasedAt: now },
      });
      await transaction.merchantFinanceEntry.updateMany({
        where: { organizationId, settlementId },
        data: { settlementId: null, releasedFromSettlementId: settlementId },
      });
      await this.financeAccrual.rebuildMerchant(
        transaction,
        organizationId,
        settlement.merchantId,
      );
      await transaction.settlementAuditEvent.create({
        data: {
          organizationId,
          settlementId,
          actorId,
          type: SettlementAuditEventType.CANCELLED,
          reason: dto.reason,
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
          where: {
            organizationId,
            settlementId,
            appliedAt: null,
            releasedAt: null,
          },
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
          where: {
            organizationId,
            settlementId,
            appliedAt: null,
            releasedAt: null,
          },
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
          method: settlement.netPayout.isZero()
            ? PayoutMethod.OTHER
            : dto.method,
          referenceNumber: dto.referenceNumber,
          note: settlement.netPayout.isZero()
            ? (dto.note ??
              'No funds transferred; rent application consumed the full merchant payable.')
            : dto.note,
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
      },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
    if (agreements.length === 0) {
      throw new ConflictException(
        'No effective merchant agreement covers this settlement period',
      );
    }
    if (!allowPartialPeriod) {
      const effectiveAgreement =
        agreements.find(
          (agreement) =>
            !agreement.endDate || agreement.endDate >= period.start,
        ) ?? agreements[agreements.length - 1];
      this.assertNormalPeriod(period, effectiveAgreement);
    }
    const segments = this.buildSegments(period, agreements);
    const saleItems = await transaction.saleItem.findMany({
      where: {
        organizationId,
        merchantId,
        sale: {
          status: 'COMPLETED',
          completedAt: {
            gte: philippineDayStart(period.start),
            lt: philippineDayStart(nextBusinessDate(period.end)),
          },
        },
        settlementLinks: currentSettlementId
          ? {
              none: {
                releasedAt: null,
                settlementId: { not: currentSettlementId },
              },
            }
          : { none: { releasedAt: null } },
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
          ? {
              none: {
                releasedAt: null,
                settlementId: { not: currentSettlementId },
              },
            }
          : { none: { releasedAt: null } },
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
        saleItem: { select: { sale: { select: { completedAt: true } } } },
      },
      orderBy: [{ refund: { completedAt: 'asc' } }, { id: 'asc' }],
    });
    let originalAgreementCommissionReversal = new Prisma.Decimal(0);
    let refundOutsideCurrentSegments = new Prisma.Decimal(0);
    for (const refundItem of refundItems) {
      const completedDate = philippineDate(refundItem.refund.completedAt);
      const originalSaleDate = philippineDate(
        refundItem.saleItem?.sale?.completedAt ?? refundItem.refund.completedAt,
      );
      const segment = segments.find(
        ({ start, end }) => completedDate >= start && completedDate <= end,
      );
      if (!segment) {
        throw new ConflictException(
          'One or more merchant refunds are not covered by an effective agreement',
        );
      }
      const originalAgreement = agreements.find(
        (agreement) =>
          originalSaleDate >= agreement.startDate &&
          (!agreement.endDate || originalSaleDate <= agreement.endDate),
      );
      const originalSegment = segments.find(
        ({ start, end }) =>
          originalSaleDate >= start && originalSaleDate <= end,
      );
      if (originalSegment) {
        originalSegment.refundTotal = originalSegment.refundTotal.add(
          refundItem.amount,
        );
      } else {
        refundOutsideCurrentSegments = refundOutsideCurrentSegments.add(
          refundItem.amount,
        );
        if (originalAgreement?.commissionRate) {
          originalAgreementCommissionReversal =
            originalAgreementCommissionReversal.add(
              this.roundMoney(
                refundItem.amount
                  .mul(originalAgreement.commissionRate)
                  .div(100),
              ),
            );
        }
      }
    }
    this.calculateSegments(segments);
    const grossSales = this.sum(segments.map(({ grossSales }) => grossSales));
    const refundTotal = this.sum(
      segments.map(({ refundTotal }) => refundTotal),
    ).add(refundOutsideCurrentSegments);
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
      ).sub(originalAgreementCommissionReversal),
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
    prefetched?: PrefetchedLivePayable,
  ): Promise<LiveMerchantPayableRecord> {
    const context = await this.liveContext(organizationId, merchant.id);
    const liveCalculation =
      context.periodStart <= context.asOf
        ? await this.prisma.$transaction((transaction) =>
            Promise.all([
              prefetched
                ? Promise.resolve(prefetched.calculation)
                : this.projectedCalculation(
                    transaction,
                    organizationId,
                    merchant.id,
                  ),
              prefetched
                ? Promise.resolve({
                    _sum: { remainingAmount: prefetched.rentOutstanding },
                  })
                : transaction.merchantReceivable.aggregate({
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
                ? this.projectedCalculation(
                    transaction,
                    organizationId,
                    merchant.id,
                    context.deadline,
                  )
                : Promise.resolve(null),
            ]),
          )
        : null;
    const calculation = liveCalculation?.[0] ?? null;
    const receivableBalance = liveCalculation?.[1] ?? null;
    const overdueCalculation = liveCalculation?.[2] ?? null;
    const pendingEntries =
      prefetched?.entries ??
      (await this.prisma.merchantFinanceEntry.findMany({
        where: {
          organizationId,
          merchantId: merchant.id,
          settlementId: null,
          voidedAt: null,
        },
        select: {
          id: true,
          amount: true,
          reason: true,
          occurredAt: true,
          createdById: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      }));
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

  private async prefetchLivePayables(
    organizationId: string,
    merchantIds: string[],
  ): Promise<Map<string, PrefetchedLivePayable>> {
    if (merchantIds.length === 0) return new Map();
    const [accruals, rents, entries] = await this.prisma.$transaction([
      this.prisma.merchantFinanceAccrual.groupBy({
        by: ['merchantId'],
        orderBy: { merchantId: 'asc' },
        where: { organizationId, merchantId: { in: merchantIds } },
        _sum: {
          grossSales: true,
          refundTotal: true,
          commissionAmount: true,
          revision: true,
        },
      }),
      this.prisma.merchantReceivable.groupBy({
        by: ['merchantId'],
        orderBy: { merchantId: 'asc' },
        where: {
          organizationId,
          merchantId: { in: merchantIds },
          remainingAmount: { gt: 0 },
        },
        _sum: { remainingAmount: true },
      }),
      this.prisma.merchantFinanceEntry.findMany({
        where: {
          organizationId,
          merchantId: { in: merchantIds },
          settlementId: null,
          voidedAt: null,
        },
        select: {
          id: true,
          merchantId: true,
          amount: true,
          reason: true,
          occurredAt: true,
          createdById: true,
        },
        orderBy: [{ merchantId: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const zero = new Prisma.Decimal(0);
    const accrualByMerchant = new Map(
      accruals.map((row) => [row.merchantId, row]),
    );
    const rentByMerchant = new Map(
      rents.map((row) => [row.merchantId, row._sum?.remainingAmount ?? zero]),
    );
    const entriesByMerchant = new Map<
      string,
      PrefetchedLivePayable['entries']
    >();
    for (const { merchantId, ...entry } of entries) {
      const merchantEntries = entriesByMerchant.get(merchantId) ?? [];
      merchantEntries.push(entry);
      entriesByMerchant.set(merchantId, merchantEntries);
    }
    return new Map(
      merchantIds.map((merchantId) => {
        const row = accrualByMerchant.get(merchantId);
        const grossSales = row?._sum?.grossSales ?? zero;
        const refundTotal = row?._sum?.refundTotal ?? zero;
        const commissionAmount = row?._sum?.commissionAmount ?? zero;
        return [
          merchantId,
          {
            calculation: {
              grossSales,
              refundTotal,
              netSales: grossSales.sub(refundTotal),
              commissionAmount,
              revision: row?._sum?.revision?.toString() ?? '0',
            },
            rentOutstanding: rentByMerchant.get(merchantId) ?? zero,
            entries: entriesByMerchant.get(merchantId) ?? [],
          },
        ];
      }),
    );
  }

  private async projectedCalculation(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    merchantId: string,
    throughPeriodEnd?: Date,
  ): Promise<ProjectedPayableCalculation> {
    const aggregate = await transaction.merchantFinanceAccrual.aggregate({
      where: {
        organizationId,
        merchantId,
        periodEnd: throughPeriodEnd ? { lte: throughPeriodEnd } : undefined,
      },
      _sum: {
        grossSales: true,
        refundTotal: true,
        commissionAmount: true,
        revision: true,
      },
      _max: { updatedAt: true },
    });
    const zero = new Prisma.Decimal(0);
    const grossSales = aggregate._sum.grossSales ?? zero;
    const refundTotal = aggregate._sum.refundTotal ?? zero;
    const commissionAmount = aggregate._sum.commissionAmount ?? zero;
    return {
      grossSales,
      refundTotal,
      netSales: grossSales.sub(refundTotal),
      commissionAmount,
      revision: [
        aggregate._sum.revision?.toString() ?? '0',
        aggregate._max.updatedAt?.toISOString() ?? 'none',
      ].join(':'),
    };
  }

  private async globalLiveSummary(organizationId: string) {
    const activeMerchant = { status: MerchantStatus.ACTIVE } as const;
    const [projection, settlements, adjustments, merchantCount] =
      await this.prisma.$transaction([
        this.prisma.merchantFinanceAccrual.aggregate({
          where: { organizationId, merchant: activeMerchant },
          _sum: {
            grossSales: true,
            refundTotal: true,
            commissionAmount: true,
          },
        }),
        this.prisma.merchantSettlement.aggregate({
          where: {
            organizationId,
            merchant: activeMerchant,
            status: { in: [SettlementStatus.DRAFT, SettlementStatus.APPROVED] },
          },
          _sum: {
            grossSales: true,
            refundTotal: true,
            commissionAmount: true,
            fixedRentAmount: true,
            adjustmentTotal: true,
          },
        }),
        this.prisma.merchantFinanceEntry.aggregate({
          where: {
            organizationId,
            merchant: activeMerchant,
            settlementId: null,
            voidedAt: null,
          },
          _sum: { amount: true },
        }),
        this.prisma.merchant.count({
          where: { organizationId, status: MerchantStatus.ACTIVE },
        }),
      ]);
    const zero = new Prisma.Decimal(0);
    const grossSales = new Prisma.Decimal(
      projection._sum.grossSales ?? zero,
    ).add(settlements._sum.grossSales ?? zero);
    const refunds = new Prisma.Decimal(projection._sum.refundTotal ?? zero).add(
      settlements._sum.refundTotal ?? zero,
    );
    const commission = new Prisma.Decimal(
      projection._sum.commissionAmount ?? zero,
    ).add(settlements._sum.commissionAmount ?? zero);
    const adjustmentsTotal = new Prisma.Decimal(
      settlements._sum.adjustmentTotal ?? zero,
    ).add(adjustments._sum.amount ?? zero);
    const rent = settlements._sum.fixedRentAmount ?? zero;
    return {
      grossSales,
      refunds,
      netSales: grossSales.sub(refunds),
      commission,
      adjustments: adjustmentsTotal,
      deductions: commission.add(rent).sub(adjustmentsTotal),
      amountDue: grossSales
        .sub(refunds)
        .sub(commission)
        .sub(rent)
        .add(adjustmentsTotal),
      merchantCount,
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
            OR: [{ endDate: null }, { endDate: { gte: today } }],
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
              in: [SettlementStatus.DRAFT, SettlementStatus.APPROVED],
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
      return await this.runSerializableTransaction(operation, 3);
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

  private async runSerializableTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    maxAttempts: number,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';
        if (!retryable || attempt === maxAttempts) throw error;
      }
    }
    throw new ConflictException('Finance operation could not be completed');
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
        allocations: {
          where: { appliedAt: null, releasedAt: null },
          select: { amount: true },
        },
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

  private allocateRentDeduction(
    shouldDeduct: boolean | undefined,
    available: AvailableReceivable[],
    merchantPayable: Prisma.Decimal,
    applications?: RequestedRentApplication[],
  ): Array<{ receivableId: string; amount: Prisma.Decimal }> {
    if (merchantPayable.lt(0)) {
      throw new BadRequestException(
        'The merchant payable cannot be negative; correct the adjustments before settlement',
      );
    }
    if (applications) {
      const availableById = new Map(available.map((row) => [row.id, row]));
      const seen = new Set<string>();
      const allocations = applications.map(({ receivableId, amount }) => {
        if (seen.has(receivableId)) {
          throw new BadRequestException(
            'Each rent receivable can only be selected once',
          );
        }
        seen.add(receivableId);
        const row = availableById.get(receivableId);
        if (!row) {
          throw new BadRequestException(
            'One or more selected rent receivables are no longer available',
          );
        }
        const requested = new Prisma.Decimal(amount);
        if (requested.lte(0) || requested.gt(row.availableAmount)) {
          throw new BadRequestException(
            'Rent application must be greater than zero and no more than the available receivable balance',
          );
        }
        return { receivableId, amount: requested };
      });
      const total = this.sum(allocations.map(({ amount }) => amount));
      if (total.gt(merchantPayable)) {
        throw new BadRequestException(
          'Rent applications cannot exceed the merchant payable',
        );
      }
      return allocations;
    }
    if (!shouldDeduct) return [];
    const outstanding = this.sum(
      available.map(({ availableAmount }) => availableAmount),
    );
    if (merchantPayable.lt(outstanding)) {
      throw new BadRequestException(
        'Payout is not enough to clear the full outstanding rent balance',
      );
    }
    let remainingPayable = merchantPayable;
    const allocations: Array<{ receivableId: string; amount: Prisma.Decimal }> =
      [];
    for (const row of available) {
      if (remainingPayable.isZero()) break;
      const amount = Prisma.Decimal.min(row.availableAmount, remainingPayable);
      if (amount.gt(0)) {
        allocations.push({ receivableId: row.id, amount });
        remainingPayable = remainingPayable.sub(amount);
      }
    }
    return allocations;
  }

  private previewRevision(
    calculation: Pick<
      SettlementCalculation,
      'grossSales' | 'refundTotal' | 'commissionAmount'
    >,
    adjustmentTotal: Prisma.Decimal,
    receivables: AvailableReceivable[],
    projectionRevision = 'raw',
  ): string {
    return [
      projectionRevision,
      calculation.grossSales.toFixed(2),
      calculation.refundTotal.toFixed(2),
      calculation.commissionAmount.toFixed(2),
      adjustmentTotal.toFixed(2),
      ...receivables.map((row) =>
        [
          row.id,
          row.remainingAmount.toFixed(2),
          row.reservedAmount.toFixed(2),
        ].join(':'),
      ),
    ].join('|');
  }

  private rentDeductionEligible(
    available: AvailableReceivable[],
    merchantPayable: Prisma.Decimal,
  ): { eligible: boolean; reason: string | null } {
    const outstanding = this.sum(
      available.map(({ availableAmount }) => availableAmount),
    );
    if (outstanding.isZero()) {
      return {
        eligible: false,
        reason: 'There is no outstanding rent to deduct.',
      };
    }
    if (merchantPayable.isZero()) {
      return {
        eligible: false,
        reason: 'The merchant payable is zero, so no rent can be applied.',
      };
    }
    if (merchantPayable.lt(outstanding)) {
      return {
        eligible: true,
        reason:
          'The full rent balance exceeds this payable; partial applications are available.',
      };
    }
    return { eligible: true, reason: null };
  }

  private async mapInBatches<T, R>(
    items: T[],
    mapper: (item: T) => Promise<R>,
    batchSize = 8,
  ): Promise<R[]> {
    const results: R[] = [];
    for (let index = 0; index < items.length; index += batchSize) {
      results.push(
        ...(await Promise.all(
          items.slice(index, index + batchSize).map(mapper),
        )),
      );
    }
    return results;
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
    const {
      terms,
      receivableAllocations,
      releasedFinanceEntries,
      ...settlementWithoutAccrual
    } = settlement;
    const financeEntries = [
      ...settlement.financeEntries,
      ...(releasedFinanceEntries ?? []),
    ].sort(
      (left, right) =>
        left.occurredAt.getTime() - right.occurredAt.getTime() ||
        left.id.localeCompare(right.id),
    );
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
      financeEntries: financeEntries.map((entry) => ({
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
