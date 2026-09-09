import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AgreementPrepaymentKind,
  AgreementPrepaymentTransactionType,
  AgreementStatus,
  PaymentMethod,
  Prisma,
  RentDueWeek,
  RentDueWeekday,
  SpaceStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CreateMerchantAgreementDto } from './dto/create-merchant-agreement.dto';
import type { UpdateMerchantAgreementDto } from './dto/update-merchant-agreement.dto';
import {
  CancellationResolution,
  type CancelAgreementDto,
  type RecordDepositDeductionDto,
  type RecordPrepaymentCollectionDto,
  type RecordPrepaymentRefundDto,
} from './dto/agreement-transition.dto';
import type { SpaceAvailabilityQueryDto } from './dto/space-availability-query.dto';

const agreementInclude = {
  merchant: { select: { id: true, name: true, code: true } },
  spaceReservations: {
    include: {
      space: { select: { id: true, code: true, name: true, branchId: true } },
    },
    orderBy: [{ space: { code: 'asc' as const } }],
  },
  prepayments: {
    include: {
      transactions: {
        orderBy: [{ occurredAt: 'asc' as const }, { id: 'asc' as const }],
      },
    },
  },
} satisfies Prisma.MerchantAgreementInclude;

type Tx = Prisma.TransactionClient;
type AgreementView = Prisma.MerchantAgreementGetPayload<{
  include: typeof agreementInclude;
}>;
type AgreementPrepaymentView = AgreementView['prepayments'][number];

@Injectable()
export class MerchantAgreementsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MerchantAgreementsService.name);
  private reconciliationTimer?: NodeJS.Timeout;
  private reconciliationRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    void this.runDailyReconciliation();
  }

  onModuleDestroy(): void {
    if (this.reconciliationTimer) clearTimeout(this.reconciliationTimer);
  }

  async create(
    organizationId: string,
    merchantId: string,
    dto: CreateMerchantAgreementDto,
  ) {
    this.validateTerms(dto);
    const activationAt = this.parseActivation(dto.activationAt);
    const { start, end } = agreementPeriod(activationAt, dto.durationMonths);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await this.requireMerchant(tx, organizationId, merchantId);
            const draftSlot = await this.nextDraftSlot(
              tx,
              organizationId,
              merchantId,
            );
            const spaces = await this.validateSpaces(
              tx,
              organizationId,
              merchantId,
              dto.spaceIds,
            );
            return tx.merchantAgreement.create({
              data: {
                organizationId,
                merchantId,
                activationAt,
                draftSlot,
                startDate: start,
                endDate: end,
                scheduledEndDate: nextDate(end),
                durationMonths: dto.durationMonths,
                fixedRentAmount: decimal(dto.fixedRentAmount),
                commissionRate: decimal(dto.commissionRate),
                securityDepositAmount: decimal(dto.securityDepositAmount),
                firstRentPaymentRequired: dto.firstRentPaymentRequired ?? false,
                rentDueWeek: dto.rentDueWeek,
                rentDueWeekday: dto.rentDueWeekday,
                settlementSchedule: dto.settlementSchedule,
                spaceReservations: {
                  create: spaces.map((space) => ({
                    organizationId,
                    branchId: space.branchId,
                    spaceId: space.id,
                    periodStart: start,
                    periodEnd: end,
                    releasedAt: new Date(),
                  })),
                },
              },
              include: agreementInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034') &&
          attempt < 4
        )
          continue;
        this.rethrowConflict(error, 'The merchant already has five drafts');
      }
    }
    throw new ConflictException('The merchant already has five drafts');
  }

  async update(
    organizationId: string,
    agreementId: string,
    dto: UpdateMerchantAgreementDto,
  ) {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('At least one agreement field is required');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.requireAgreement(
        tx,
        organizationId,
        agreementId,
      );
      if (existing.status !== AgreementStatus.DRAFT)
        throw new ConflictException('Only draft agreements can be edited');
      const merged = {
        activationAt:
          dto.activationAt ?? existing.activationAt.toISOString().slice(0, 10),
        durationMonths: dto.durationMonths ?? existing.durationMonths ?? 1,
        fixedRentAmount:
          dto.fixedRentAmount === undefined
            ? existing.fixedRentAmount?.toFixed(2)
            : dto.fixedRentAmount,
        commissionRate:
          dto.commissionRate === undefined
            ? existing.commissionRate?.toFixed(2)
            : dto.commissionRate,
        securityDepositAmount:
          dto.securityDepositAmount === undefined
            ? existing.securityDepositAmount?.toFixed(2)
            : dto.securityDepositAmount,
        firstRentPaymentRequired:
          dto.firstRentPaymentRequired ?? existing.firstRentPaymentRequired,
        rentDueWeek: dto.rentDueWeek ?? existing.rentDueWeek ?? undefined,
        rentDueWeekday:
          dto.rentDueWeekday ?? existing.rentDueWeekday ?? undefined,
        settlementSchedule:
          dto.settlementSchedule ?? existing.settlementSchedule,
        spaceIds: dto.spaceIds,
      };
      this.validateTerms(merged);
      const paid = await this.hasCollectedMoney(
        tx,
        organizationId,
        agreementId,
      );
      if (
        paid &&
        (dto.fixedRentAmount !== undefined ||
          dto.securityDepositAmount !== undefined ||
          dto.firstRentPaymentRequired !== undefined)
      ) {
        throw new ConflictException(
          'Refund collected agreement payments before changing payment requirements',
        );
      }
      const activationAt = this.parseActivation(merged.activationAt);
      const period = agreementPeriod(activationAt, merged.durationMonths);
      if (dto.spaceIds) {
        const spaces = await this.validateSpaces(
          tx,
          organizationId,
          existing.merchantId,
          dto.spaceIds,
        );
        await tx.merchantAgreementSpace.deleteMany({
          where: { organizationId, agreementId },
        });
        await tx.merchantAgreementSpace.createMany({
          data: spaces.map((space) => ({
            organizationId,
            agreementId,
            branchId: space.branchId,
            spaceId: space.id,
            periodStart: period.start,
            periodEnd: period.end,
            releasedAt: new Date(),
          })),
        });
      } else {
        await tx.merchantAgreementSpace.updateMany({
          where: { organizationId, agreementId },
          data: { periodStart: period.start, periodEnd: period.end },
        });
      }
      await tx.merchantAgreement.update({
        where: { id: agreementId, organizationId },
        data: {
          activationAt,
          startDate: period.start,
          endDate: period.end,
          scheduledEndDate: nextDate(period.end),
          durationMonths: merged.durationMonths,
          fixedRentAmount: decimal(merged.fixedRentAmount),
          commissionRate: decimal(merged.commissionRate),
          securityDepositAmount: decimal(merged.securityDepositAmount),
          firstRentPaymentRequired: merged.firstRentPaymentRequired,
          rentDueWeek: merged.rentDueWeek,
          rentDueWeekday: merged.rentDueWeekday,
          settlementSchedule: merged.settlementSchedule,
          activationFailureReason: null,
        },
      });
      return this.requireAgreementView(tx, organizationId, agreementId);
    });
  }

  async findAll(organizationId: string, merchantId: string) {
    await this.requireMerchant(this.prisma, organizationId, merchantId);
    return this.prisma.merchantAgreement.findMany({
      where: { organizationId, merchantId },
      include: agreementInclude,
      orderBy: [{ activationAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findAllForOrganization(organizationId: string) {
    return this.prisma.merchantAgreement.findMany({
      where: { organizationId },
      include: agreementInclude,
      orderBy: [{ activationAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findOneView(organizationId: string, agreementId: string) {
    return this.requireAgreementView(this.prisma, organizationId, agreementId);
  }

  async findOne(organizationId: string, agreementId: string) {
    return this.requireAgreement(this.prisma, organizationId, agreementId);
  }

  async submit(organizationId: string, agreementId: string, actorId: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const agreement = await this.requireAgreementView(
            tx,
            organizationId,
            agreementId,
          );
          if (agreement.status !== AgreementStatus.DRAFT)
            throw new ConflictException(
              'Only draft agreements can be submitted',
            );
          if (!agreement.spaceReservations.length)
            throw new BadRequestException('Select at least one space');
          if (
            agreement.fixedRentAmount &&
            (!agreement.rentDueWeek || !agreement.rentDueWeekday)
          )
            throw new BadRequestException(
              'Choose the rent collection week and weekday',
            );
          const commercialConflict = await tx.merchantAgreement.findFirst({
            where: {
              organizationId,
              merchantId: agreement.merchantId,
              id: { not: agreementId },
              status: {
                in: [
                  AgreementStatus.PENDING,
                  AgreementStatus.APPROVED,
                  AgreementStatus.ACTIVE,
                ],
              },
              startDate: { lte: agreement.endDate ?? agreement.startDate },
              OR: [
                { endDate: null },
                { endDate: { gte: agreement.startDate } },
              ],
            },
            select: { id: true },
          });
          if (commercialConflict)
            throw new ConflictException(
              'The merchant already has an agreement covering this period',
            );
          await this.assertNoLegacyConflicts(tx, agreement);
          await tx.merchantAgreementSpace.updateMany({
            where: { organizationId, agreementId },
            data: { releasedAt: null },
          });
          await this.ensurePrepayments(tx, agreement);
          await tx.merchantAgreement.update({
            where: { id: agreementId, organizationId },
            data: {
              status: AgreementStatus.PENDING,
              draftSlot: null,
              submittedAt: new Date(),
              submittedById: actorId,
              returnedAt: null,
              returnedById: null,
              returnReason: null,
            },
          });
          return this.requireAgreementView(tx, organizationId, agreementId);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowConflict(
        error,
        'A selected space is unavailable for this period',
      );
    }
  }

  async returnToDraft(
    organizationId: string,
    agreementId: string,
    actorId: string,
    reason: string,
  ) {
    return this.movePendingToDraft(
      organizationId,
      agreementId,
      actorId,
      reason,
    );
  }

  async withdraw(
    organizationId: string,
    agreementId: string,
    actorId: string,
    reason: string,
  ) {
    return this.movePendingToDraft(
      organizationId,
      agreementId,
      actorId,
      reason,
    );
  }

  private async movePendingToDraft(
    organizationId: string,
    agreementId: string,
    actorId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const agreement = await this.requireAgreement(
        tx,
        organizationId,
        agreementId,
      );
      if (agreement.status !== AgreementStatus.PENDING)
        throw new ConflictException(
          'Only pending agreements can return to draft',
        );
      const draftSlot = await this.nextDraftSlot(
        tx,
        organizationId,
        agreement.merchantId,
      );
      await tx.merchantAgreementSpace.updateMany({
        where: { organizationId, agreementId },
        data: { releasedAt: new Date() },
      });
      await tx.merchantAgreement.update({
        where: { id: agreementId, organizationId },
        data: {
          status: AgreementStatus.DRAFT,
          draftSlot,
          returnedAt: new Date(),
          returnedById: actorId,
          returnReason: reason,
        },
      });
      return this.requireAgreementView(tx, organizationId, agreementId);
    });
  }

  async approve(organizationId: string, agreementId: string, actorId: string) {
    const approved = await this.prisma.$transaction(async (tx) => {
      const agreement = await this.requireAgreementView(
        tx,
        organizationId,
        agreementId,
      );
      if (agreement.status !== AgreementStatus.PENDING)
        throw new ConflictException('Only pending agreements can be approved');
      this.assertPrepaymentsComplete(agreement.prepayments);
      await tx.merchantAgreement.update({
        where: { id: agreementId, organizationId },
        data: {
          status: AgreementStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: actorId,
        },
      });
      return this.requireAgreementView(tx, organizationId, agreementId);
    });
    if (approved.activationAt <= businessDate(new Date()))
      return this.activate(organizationId, agreementId, actorId);
    return approved;
  }

  async activate(
    organizationId: string,
    agreementId: string,
    actorId?: string,
    activationAt = businessDate(new Date()),
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const agreement = await this.requireAgreementView(
            tx,
            organizationId,
            agreementId,
          );
          if (agreement.status !== AgreementStatus.APPROVED)
            throw new ConflictException(
              'Only approved agreements can be activated',
            );
          this.assertPrepaymentsComplete(agreement.prepayments);
          const active = await tx.merchantAgreement.findFirst({
            where: {
              organizationId,
              merchantId: agreement.merchantId,
              status: AgreementStatus.ACTIVE,
            },
            select: { id: true },
          });
          if (active)
            throw new ConflictException(
              'The merchant already has an active agreement',
            );
          const period = agreementPeriod(
            activationAt,
            agreement.durationMonths ?? 1,
          );
          const futureAgreementConflict = await tx.merchantAgreement.findFirst({
            where: {
              organizationId,
              merchantId: agreement.merchantId,
              id: { not: agreementId },
              status: {
                in: [AgreementStatus.PENDING, AgreementStatus.APPROVED],
              },
              startDate: { lte: period.end },
              OR: [{ endDate: null }, { endDate: { gte: period.start } }],
            },
            select: { id: true },
          });
          if (futureAgreementConflict)
            throw new ConflictException(
              'Activation would overlap another merchant agreement',
            );
          await tx.merchantAgreementSpace.updateMany({
            where: { organizationId, agreementId },
            data: {
              periodStart: period.start,
              periodEnd: period.end,
              releasedAt: null,
            },
          });
          await this.assertNoLegacyConflicts(tx, {
            ...agreement,
            startDate: period.start,
            endDate: period.end,
          });
          await tx.spaceAssignment.createMany({
            data: agreement.spaceReservations.map((reservation) => ({
              organizationId,
              branchId: reservation.branchId,
              spaceId: reservation.spaceId,
              merchantId: agreement.merchantId,
              agreementId,
              startDate: period.start,
              endDate: period.end,
            })),
          });
          await this.createFirstRent(
            tx,
            agreement,
            period.start,
            period.end,
            actorId ??
              agreement.approvedById ??
              agreement.submittedById ??
              undefined,
          );
          await tx.merchantAgreement.update({
            where: { id: agreementId, organizationId },
            data: {
              status: AgreementStatus.ACTIVE,
              activationAt,
              activatedAt: new Date(),
              startDate: period.start,
              endDate: period.end,
              scheduledEndDate: nextDate(period.end),
              lastActivationAttemptAt: new Date(),
              activationFailureReason: null,
            },
          });
          return this.requireAgreementView(tx, organizationId, agreementId);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Activation failed';
      await this.prisma.merchantAgreement.updateMany({
        where: {
          id: agreementId,
          organizationId,
          status: AgreementStatus.APPROVED,
        },
        data: {
          lastActivationAttemptAt: new Date(),
          activationFailureReason: message.slice(0, 500),
        },
      });
      this.rethrowConflict(
        error,
        'Agreement activation conflicted with current data',
      );
    }
  }

  async suspend(
    organizationId: string,
    agreementId: string,
    actorId: string,
    reason: string,
  ) {
    return this.closeAgreement(
      organizationId,
      agreementId,
      AgreementStatus.SUSPENDED,
      actorId,
      reason,
    );
  }

  async discard(
    organizationId: string,
    agreementId: string,
    actorId: string,
    reason: string,
  ) {
    const agreement = await this.requireAgreementView(
      this.prisma,
      organizationId,
      agreementId,
    );
    if (agreement.status !== AgreementStatus.DRAFT)
      throw new ConflictException('Only drafts can be discarded');
    if (this.totalHeld(agreement.prepayments).gt(0))
      throw new ConflictException(
        'Refund collected payments before discarding this draft',
      );
    return this.closeAgreement(
      organizationId,
      agreementId,
      AgreementStatus.SUSPENDED,
      actorId,
      reason,
    );
  }

  async cancel(
    organizationId: string,
    agreementId: string,
    actorId: string,
    dto: CancelAgreementDto,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const agreement = await this.requireAgreementView(
            tx,
            organizationId,
            agreementId,
          );
          if (agreement.status !== AgreementStatus.APPROVED)
            throw new ConflictException(
              'Only approved agreements can be cancelled',
            );
          for (const prepayment of agreement.prepayments) {
            const held = prepaymentBalance(prepayment.transactions);
            if (held.lte(0)) continue;
            const choice = dto.resolutions.find(
              (item) => item.kind === prepayment.kind,
            );
            if (!choice)
              throw new BadRequestException(
                `Choose how to resolve ${prepayment.kind}`,
              );
            if (
              choice.resolution === CancellationResolution.REFUND &&
              !choice.method
            )
              throw new BadRequestException(
                'Refund payment method is required',
              );
            await tx.agreementPrepaymentTransaction.create({
              data: {
                organizationId,
                merchantId: agreement.merchantId,
                prepaymentId: prepayment.id,
                type:
                  choice.resolution === CancellationResolution.REFUND
                    ? AgreementPrepaymentTransactionType.REFUND
                    : AgreementPrepaymentTransactionType.RETENTION,
                amount: held,
                paymentMethod: choice.method,
                reason: choice.reason,
                recordedById: actorId,
              },
            });
          }
          await this.releaseAgreement(
            tx,
            organizationId,
            agreementId,
            agreement.endDate ?? businessDate(new Date()),
          );
          await tx.merchantAgreement.update({
            where: { id: agreementId, organizationId },
            data: {
              status: AgreementStatus.SUSPENDED,
              suspendedAt: new Date(),
              suspendedById: actorId,
              suspensionReason: dto.reason,
            },
          });
          return this.requireAgreementView(tx, organizationId, agreementId);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowConflict(error, 'Agreement cancellation conflicted');
    }
  }

  async listPrepayments(organizationId: string, agreementId: string) {
    await this.requireAgreement(this.prisma, organizationId, agreementId);
    return this.prisma.agreementPrepayment.findMany({
      where: { organizationId, agreementId },
      include: {
        transactions: { orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }] },
      },
    });
  }

  async collect(
    organizationId: string,
    agreementId: string,
    kind: AgreementPrepaymentKind,
    actorId: string,
    dto: RecordPrepaymentCollectionDto,
  ) {
    return this.recordPrepayment(
      organizationId,
      agreementId,
      kind,
      actorId,
      AgreementPrepaymentTransactionType.COLLECTION,
      dto.amount,
      dto.method,
      dto.referenceNumber,
      undefined,
      dto.occurredAt,
      dto.requestId,
    );
  }

  async refund(
    organizationId: string,
    agreementId: string,
    kind: AgreementPrepaymentKind,
    actorId: string,
    dto: RecordPrepaymentRefundDto,
  ) {
    return this.recordPrepayment(
      organizationId,
      agreementId,
      kind,
      actorId,
      AgreementPrepaymentTransactionType.REFUND,
      dto.amount,
      dto.method,
      dto.referenceNumber,
      dto.reason,
      dto.occurredAt,
      dto.requestId,
    );
  }

  async deductDeposit(
    organizationId: string,
    agreementId: string,
    actorId: string,
    dto: RecordDepositDeductionDto,
  ) {
    return this.recordPrepayment(
      organizationId,
      agreementId,
      AgreementPrepaymentKind.SECURITY_DEPOSIT,
      actorId,
      AgreementPrepaymentTransactionType.DEDUCTION,
      dto.amount,
      undefined,
      undefined,
      dto.reason,
      new Date().toISOString(),
      dto.requestId,
    );
  }

  async availability(organizationId: string, query: SpaceAvailabilityQueryDto) {
    const period = agreementPeriod(
      this.parseActivation(query.activationAt),
      query.durationMonths,
    );
    const spaces = await this.prisma.space.findMany({
      where: { organizationId, status: SpaceStatus.ACTIVE },
      select: {
        id: true,
        branchId: true,
        code: true,
        name: true,
        branch: { select: { id: true, name: true } },
      },
    });
    const conflicts = await this.prisma.merchantAgreementSpace.findMany({
      where: {
        organizationId,
        releasedAt: null,
        agreementId: query.excludeAgreementId
          ? { not: query.excludeAgreementId }
          : undefined,
        periodStart: { lte: period.end },
        periodEnd: { gte: period.start },
      },
      include: { agreement: { select: { id: true, status: true } } },
    });
    const legacy = await this.prisma.spaceAssignment.findMany({
      where: {
        organizationId,
        agreementId: null,
        startDate: { lte: period.end },
        OR: [{ endDate: null }, { endDate: { gte: period.start } }],
      },
      select: { spaceId: true, startDate: true, endDate: true },
    });
    const blocked = new Map<
      string,
      { status: string; startDate: Date; endDate: Date | null }
    >(
      conflicts.map((item) => [
        item.spaceId,
        {
          status: item.agreement.status,
          startDate: item.periodStart,
          endDate: item.periodEnd,
        },
      ]),
    );
    for (const item of legacy)
      blocked.set(item.spaceId, {
        status: 'LEGACY',
        startDate: item.startDate,
        endDate: item.endDate,
      });
    return spaces.map((space) => {
      const conflict = blocked.get(space.id);
      return {
        ...space,
        available: !conflict,
        conflictStatus: conflict?.status ?? null,
        conflictStartDate: conflict?.startDate ?? null,
        conflictEndDate: conflict?.endDate ?? null,
      };
    });
  }

  private async recordPrepayment(
    organizationId: string,
    agreementId: string,
    kind: AgreementPrepaymentKind,
    actorId: string,
    type: AgreementPrepaymentTransactionType,
    amountInput: string,
    method?: PaymentMethod,
    referenceNumber?: string,
    reason?: string,
    occurredAt?: string,
    requestId?: string,
  ) {
    if (!requestId)
      throw new BadRequestException('An idempotency request ID is required');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const prior = await tx.agreementPrepaymentTransaction.findFirst({
            where: { organizationId, requestId },
          });
          if (prior) return prior;
          const agreement = await this.requireAgreement(
            tx,
            organizationId,
            agreementId,
          );
          const allowed =
            type === AgreementPrepaymentTransactionType.COLLECTION
              ? agreement.status === AgreementStatus.PENDING
              : type === AgreementPrepaymentTransactionType.REFUND
                ? agreement.status === AgreementStatus.DRAFT ||
                  agreement.status === AgreementStatus.PENDING ||
                  (kind === AgreementPrepaymentKind.SECURITY_DEPOSIT &&
                    (agreement.status === AgreementStatus.ACTIVE ||
                      agreement.status === AgreementStatus.ENDED ||
                      agreement.status === AgreementStatus.SUSPENDED))
                : true;
          if (!allowed)
            throw new ConflictException(
              'This payment action is not allowed for the agreement status',
            );
          if (
            type === AgreementPrepaymentTransactionType.DEDUCTION &&
            agreement.status !== AgreementStatus.ACTIVE &&
            agreement.status !== AgreementStatus.ENDED &&
            agreement.status !== AgreementStatus.SUSPENDED
          )
            throw new ConflictException(
              'Deposit deductions require an activated agreement',
            );
          const prepayment = await tx.agreementPrepayment.findFirst({
            where: { organizationId, agreementId, kind },
            include: { transactions: true },
          });
          if (!prepayment)
            throw new NotFoundException('Agreement prepayment was not found');
          const amount = new Prisma.Decimal(amountInput);
          const balance = prepaymentBalance(prepayment.transactions);
          if (
            type === AgreementPrepaymentTransactionType.COLLECTION &&
            balance.add(amount).gt(prepayment.requiredAmount)
          )
            throw new ConflictException(
              'Collection exceeds the required amount',
            );
          if (
            type !== AgreementPrepaymentTransactionType.COLLECTION &&
            amount.gt(balance)
          )
            throw new ConflictException(
              'Amount exceeds the currently held balance',
            );
          return tx.agreementPrepaymentTransaction.create({
            data: {
              organizationId,
              merchantId: agreement.merchantId,
              prepaymentId: prepayment.id,
              type,
              amount,
              paymentMethod: method,
              referenceNumber,
              reason,
              requestId,
              occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
              recordedById: actorId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const prior =
          await this.prisma.agreementPrepaymentTransaction.findFirst({
            where: { organizationId, requestId },
          });
        if (prior) return prior;
      }
      this.rethrowConflict(error, 'Payment recording conflicted');
    }
  }

  private async closeAgreement(
    organizationId: string,
    agreementId: string,
    status: AgreementStatus,
    actorId: string | undefined,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const agreement = await this.requireAgreement(
        tx,
        organizationId,
        agreementId,
      );
      if (
        agreement.status !== AgreementStatus.DRAFT &&
        agreement.status !== AgreementStatus.ACTIVE
      )
        throw new ConflictException(
          'Agreement cannot be closed from its current status',
        );
      const today = businessDate(new Date());
      const end =
        status === AgreementStatus.ENDED && agreement.endDate
          ? agreement.endDate
          : today;
      const reservationEnd =
        agreement.status === AgreementStatus.DRAFT && agreement.endDate
          ? agreement.endDate
          : end;
      await this.releaseAgreement(
        tx,
        organizationId,
        agreementId,
        reservationEnd,
      );
      await tx.merchantAgreement.update({
        where: { id: agreementId, organizationId },
        data:
          status === AgreementStatus.ENDED
            ? {
                status,
                endDate: end,
                endedAt: new Date(),
                endedById: actorId,
                endReason: reason,
                draftSlot: null,
              }
            : {
                status,
                endDate:
                  agreement.status === AgreementStatus.ACTIVE
                    ? end
                    : agreement.endDate,
                suspendedAt: new Date(),
                suspendedById: actorId,
                suspensionReason: reason,
                draftSlot: null,
              },
      });
      return this.requireAgreementView(tx, organizationId, agreementId);
    });
  }

  private async releaseAgreement(
    tx: Tx,
    organizationId: string,
    agreementId: string,
    endDate: Date,
  ) {
    await tx.merchantAgreementSpace.updateMany({
      where: { organizationId, agreementId, releasedAt: null },
      data: { releasedAt: new Date(), periodEnd: endDate },
    });
    await tx.spaceAssignment.updateMany({
      where: {
        organizationId,
        agreementId,
        OR: [{ endDate: null }, { endDate: { gt: endDate } }],
      },
      data: { endDate },
    });
  }

  private async ensurePrepayments(tx: Tx, agreement: AgreementView) {
    const rows: Array<{
      kind: AgreementPrepaymentKind;
      requiredAmount: Prisma.Decimal;
    }> = [];
    if (agreement.securityDepositAmount)
      rows.push({
        kind: AgreementPrepaymentKind.SECURITY_DEPOSIT,
        requiredAmount: agreement.securityDepositAmount,
      });
    if (agreement.firstRentPaymentRequired && agreement.fixedRentAmount)
      rows.push({
        kind: AgreementPrepaymentKind.FIRST_RENT,
        requiredAmount: agreement.fixedRentAmount,
      });
    for (const row of rows)
      await tx.agreementPrepayment.upsert({
        where: {
          organizationId_agreementId_kind: {
            organizationId: agreement.organizationId,
            agreementId: agreement.id,
            kind: row.kind,
          },
        },
        create: {
          organizationId: agreement.organizationId,
          merchantId: agreement.merchantId,
          agreementId: agreement.id,
          ...row,
        },
        update: { requiredAmount: row.requiredAmount },
      });
  }

  private assertPrepaymentsComplete(
    prepayments: AgreementPrepaymentView[],
  ): void {
    for (const item of prepayments)
      if (!prepaymentBalance(item.transactions).eq(item.requiredAmount))
        throw new ConflictException(
          `${item.kind} must be fully collected before approval`,
        );
  }

  private async createFirstRent(
    tx: Tx,
    agreement: AgreementView,
    periodStart: Date,
    periodEnd: Date,
    actorId?: string,
  ) {
    if (!agreement.fixedRentAmount) return;
    const firstRent = agreement.prepayments.find(
      (item) => item.kind === AgreementPrepaymentKind.FIRST_RENT,
    );
    const prepaid =
      firstRent &&
      prepaymentBalance(firstRent.transactions).eq(firstRent.requiredAmount);
    const receivable = await tx.merchantReceivable.create({
      data: {
        organizationId: agreement.organizationId,
        merchantId: agreement.merchantId,
        agreementId: agreement.id,
        sourcePeriod: periodStart,
        periodStart,
        periodEnd,
        cycleNumber: 1,
        originalAmount: agreement.fixedRentAmount,
        remainingAmount: prepaid
          ? new Prisma.Decimal(0)
          : agreement.fixedRentAmount,
        dueDate: periodStart,
        status: prepaid ? 'PAID' : 'OPEN',
      },
    });
    if (prepaid && actorId) {
      const collection = firstRent.transactions.find(
        (item) => item.type === AgreementPrepaymentTransactionType.COLLECTION,
      );
      await tx.merchantReceivableTransaction.create({
        data: {
          organizationId: agreement.organizationId,
          merchantId: agreement.merchantId,
          receivableId: receivable.id,
          type: 'PAYMENT',
          amount: agreement.fixedRentAmount,
          paymentMethod: collection?.paymentMethod ?? PaymentMethod.OTHER,
          referenceNumber: collection?.referenceNumber,
          note: 'Applied from agreement first-rent prepayment',
          recordedById: actorId,
        },
      });
      await tx.agreementPrepayment.update({
        where: { id: firstRent.id },
        data: { appliedAt: new Date() },
      });
      await tx.agreementPrepaymentTransaction.create({
        data: {
          organizationId: agreement.organizationId,
          merchantId: agreement.merchantId,
          prepaymentId: firstRent.id,
          type: AgreementPrepaymentTransactionType.APPLICATION,
          amount: agreement.fixedRentAmount,
          reason: 'Applied to the first rent receivable',
          recordedById: actorId,
        },
      });
    }
  }

  private validateTerms(dto: {
    fixedRentAmount?: string;
    commissionRate?: string;
    firstRentPaymentRequired?: boolean;
    rentDueWeek?: RentDueWeek;
    rentDueWeekday?: RentDueWeekday;
  }) {
    if (!dto.fixedRentAmount && !dto.commissionRate)
      throw new BadRequestException(
        'An agreement requires fixed rent, commission, or both',
      );
    if (
      !dto.fixedRentAmount &&
      (dto.firstRentPaymentRequired || dto.rentDueWeek || dto.rentDueWeekday)
    )
      throw new BadRequestException('Rent payment options require fixed rent');
    if (dto.fixedRentAmount && !!dto.rentDueWeek !== !!dto.rentDueWeekday)
      throw new BadRequestException(
        'Rent week and weekday must be selected together',
      );
  }

  private async nextDraftSlot(
    tx: Tx,
    organizationId: string,
    merchantId: string,
  ) {
    const rows = await tx.merchantAgreement.findMany({
      where: { organizationId, merchantId, status: AgreementStatus.DRAFT },
      select: { draftSlot: true },
    });
    const used = new Set(rows.map((row) => row.draftSlot));
    for (let slot = 1; slot <= 5; slot += 1) if (!used.has(slot)) return slot;
    throw new ConflictException('The merchant already has five drafts');
  }

  private async validateSpaces(
    tx: Tx,
    organizationId: string,
    merchantId: string,
    spaceIds: string[],
  ) {
    if (new Set(spaceIds).size !== spaceIds.length)
      throw new BadRequestException('Each space can only be selected once');
    const spaces = await tx.space.findMany({
      where: {
        organizationId,
        id: { in: spaceIds },
        status: SpaceStatus.ACTIVE,
      },
      select: { id: true, branchId: true },
    });
    if (spaces.length !== spaceIds.length)
      throw new NotFoundException('One or more spaces were not found');
    const branchIds = [...new Set(spaces.map((space) => space.branchId))];
    const memberships = await tx.merchantBranch.count({
      where: { organizationId, merchantId, branchId: { in: branchIds } },
    });
    if (memberships !== branchIds.length)
      throw new ConflictException(
        'Merchant must participate in every selected space branch',
      );
    return spaces;
  }

  private async assertNoLegacyConflicts(tx: Tx, agreement: AgreementView) {
    const conflict = await tx.spaceAssignment.findFirst({
      where: {
        organizationId: agreement.organizationId,
        agreementId: null,
        spaceId: {
          in: agreement.spaceReservations.map((item) => item.spaceId),
        },
        startDate: { lte: agreement.endDate ?? agreement.startDate },
        OR: [{ endDate: null }, { endDate: { gte: agreement.startDate } }],
      },
      select: { id: true },
    });
    if (conflict)
      throw new ConflictException(
        'A selected space has a conflicting legacy assignment',
      );
  }

  private async requireMerchant(
    tx: Pick<Tx, 'merchant'>,
    organizationId: string,
    merchantId: string,
  ) {
    const merchant = await tx.merchant.findFirst({
      where: { id: merchantId, organizationId },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
  }

  private async requireAgreement(
    tx: Pick<Tx, 'merchantAgreement'>,
    organizationId: string,
    agreementId: string,
  ) {
    const agreement = await tx.merchantAgreement.findFirst({
      where: { id: agreementId, organizationId },
    });
    if (!agreement) throw new NotFoundException('Merchant agreement not found');
    return agreement;
  }

  private async requireAgreementView(
    tx: Pick<Tx, 'merchantAgreement'>,
    organizationId: string,
    agreementId: string,
  ) {
    const agreement = await tx.merchantAgreement.findFirst({
      where: { id: agreementId, organizationId },
      include: agreementInclude,
    });
    if (!agreement) throw new NotFoundException('Merchant agreement not found');
    return agreement;
  }

  private parseActivation(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException('activationAt must be a valid ISO date');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.valueOf()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('activationAt must be a valid ISO date');
    return date;
  }

  private async hasCollectedMoney(
    tx: Tx,
    organizationId: string,
    agreementId: string,
  ) {
    return (
      (await tx.agreementPrepaymentTransaction.count({
        where: {
          organizationId,
          prepayment: { agreementId },
          type: AgreementPrepaymentTransactionType.COLLECTION,
        },
      })) > 0
    );
  }

  private totalHeld(prepayments: AgreementPrepaymentView[]): Prisma.Decimal {
    return prepayments.reduce(
      (sum, item) => sum.add(prepaymentBalance(item.transactions)),
      new Prisma.Decimal(0),
    );
  }

  private rethrowConflict(error: unknown, fallback: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    )
      throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2004', 'P2034'].includes(error.code)
    )
      throw new ConflictException(fallback);
    throw error;
  }

  private async runDailyReconciliation(): Promise<void> {
    try {
      await this.reconcileLifecycle();
    } catch (error) {
      this.logger.error('Agreement lifecycle reconciliation failed', error);
    } finally {
      const delay = millisecondsUntilNextPhilippineDay(new Date());
      this.reconciliationTimer = setTimeout(
        () => void this.runDailyReconciliation(),
        delay,
      );
      this.reconciliationTimer.unref();
    }
  }

  private async reconcileLifecycle() {
    if (this.reconciliationRunning) return;
    this.reconciliationRunning = true;
    try {
      const now = new Date();
      const today = businessDate(now);
      const expired = await this.prisma.merchantAgreement.findMany({
        where: { status: AgreementStatus.ACTIVE, endDate: { lt: today } },
        select: { id: true, organizationId: true },
      });
      for (const agreement of expired) {
        try {
          await this.closeAgreement(
            agreement.organizationId,
            agreement.id,
            AgreementStatus.ENDED,
            undefined,
            'Agreement term completed',
          );
        } catch {
          /* retried on the next startup or Philippine business day */
        }
      }
      const due = await this.prisma.merchantAgreement.findMany({
        where: {
          status: AgreementStatus.APPROVED,
          activationAt: { lte: today },
        },
        select: { id: true, organizationId: true, activationAt: true },
      });
      for (const agreement of due) {
        try {
          await this.activate(
            agreement.organizationId,
            agreement.id,
            undefined,
            agreement.activationAt,
          );
        } catch {
          /* persisted for operator review and retried on the next run */
        }
      }
    } finally {
      this.reconciliationRunning = false;
    }
  }
}

function decimal(value?: string | null) {
  return value ? new Prisma.Decimal(value) : null;
}

function businessDate(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return new Date(
    `${value('year')}-${value('month')}-${value('day')}T00:00:00.000Z`,
  );
}

function agreementPeriod(activationAt: Date, durationMonths: number) {
  const start = businessDate(activationAt);
  const exclusiveEnd = addMonthsAnchored(start, durationMonths);
  const end = new Date(exclusiveEnd);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start, end };
}

function addMonthsAnchored(anchor: Date, months: number) {
  const result = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
  return result;
}

function nextDate(date: Date) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

function millisecondsUntilNextPhilippineDay(now: Date): number {
  const nextBusinessDate = nextDate(businessDate(now));
  const nextManilaMidnight = nextBusinessDate.getTime() - 8 * 60 * 60 * 1000;
  return Math.max(1_000, nextManilaMidnight - now.getTime());
}

function prepaymentBalance(
  transactions: Array<{
    type: AgreementPrepaymentTransactionType;
    amount: Prisma.Decimal;
  }>,
) {
  return transactions.reduce(
    (sum, item) =>
      item.type === AgreementPrepaymentTransactionType.COLLECTION
        ? sum.add(item.amount)
        : sum.sub(item.amount),
    new Prisma.Decimal(0),
  );
}
