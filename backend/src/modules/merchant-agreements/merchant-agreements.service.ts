import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgreementStatus,
  Prisma,
  type MerchantAgreement,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  currentPhilippineBusinessDate,
  parseAgreementDate,
} from './dto/agreement-date.validation';
import type { CreateMerchantAgreementDto } from './dto/create-merchant-agreement.dto';
import type { EndMerchantAgreementDto } from './dto/end-merchant-agreement.dto';
import type { UpdateMerchantAgreementDto } from './dto/update-merchant-agreement.dto';
import {
  merchantAgreementViewInclude,
  type MerchantAgreementRecord,
  type MerchantAgreementViewRecord,
} from './merchant-agreements.types';

@Injectable()
export class MerchantAgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    merchantId: string,
    dto: CreateMerchantAgreementDto,
  ): Promise<MerchantAgreementRecord> {
    await this.requireMerchant(organizationId, merchantId);
    if (!dto.fixedRentAmount && !dto.commissionRate) {
      throw new BadRequestException(
        'An agreement requires fixed rent, commission, or both',
      );
    }
    if (!dto.durationMonths && !dto.startDate) {
      throw new BadRequestException('durationMonths is required');
    }
    const startDate = dto.durationMonths
      ? currentPhilippineBusinessDate()
      : parseAgreementDate(dto.startDate!, 'startDate');
    if (!dto.durationMonths && dto.endDate) {
      this.validateDateOrder(
        startDate,
        parseAgreementDate(dto.endDate, 'endDate'),
      );
    }
    const durationMonths = dto.durationMonths ?? this.legacyDuration(dto);
    const data = {
      organizationId,
      merchantId,
      startDate,
      endDate: dto.durationMonths
        ? null
        : dto.endDate
          ? parseAgreementDate(dto.endDate, 'endDate')
          : null,
      fixedRentAmount: this.toDecimal(dto.fixedRentAmount),
      commissionRate: this.toDecimal(dto.commissionRate),
      settlementSchedule: dto.settlementSchedule,
      ...(durationMonths == null ? {} : { durationMonths }),
    };
    return this.prisma.merchantAgreement.create({ data });
  }

  async findAll(
    organizationId: string,
    merchantId: string,
  ): Promise<MerchantAgreementRecord[]> {
    await this.requireMerchant(organizationId, merchantId);
    return this.prisma.merchantAgreement.findMany({
      where: { organizationId, merchantId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  findAllForOrganization(
    organizationId: string,
  ): Promise<MerchantAgreementViewRecord[]> {
    return this.prisma.merchantAgreement.findMany({
      where: { organizationId },
      include: merchantAgreementViewInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  async findOneView(
    organizationId: string,
    agreementId: string,
  ): Promise<MerchantAgreementViewRecord> {
    const agreement = await this.prisma.merchantAgreement.findFirst({
      where: { id: agreementId, organizationId },
      include: merchantAgreementViewInclude,
    });
    if (!agreement) throw new NotFoundException('Merchant agreement not found');
    return agreement;
  }

  async findOne(
    organizationId: string,
    agreementId: string,
  ): Promise<MerchantAgreementRecord> {
    const agreement = await this.prisma.merchantAgreement.findFirst({
      where: { id: agreementId, organizationId },
    });
    if (!agreement) throw new NotFoundException('Merchant agreement not found');
    return agreement;
  }

  async update(
    organizationId: string,
    agreementId: string,
    dto: UpdateMerchantAgreementDto,
  ): Promise<MerchantAgreementRecord> {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('At least one agreement field is required');
    }

    const agreement = await this.findOne(organizationId, agreementId);
    if (agreement.status !== AgreementStatus.DRAFT) {
      throw new ConflictException('Only draft agreements can be edited');
    }

    const startDate = dto.startDate
      ? parseAgreementDate(dto.startDate, 'startDate')
      : agreement.startDate;
    const endDate =
      dto.endDate === undefined
        ? agreement.endDate
        : dto.endDate === null
          ? null
          : parseAgreementDate(dto.endDate, 'endDate');
    this.validateDateOrder(startDate, endDate);
    const fixedRentAmount =
      dto.fixedRentAmount === undefined
        ? agreement.fixedRentAmount
        : this.toDecimal(dto.fixedRentAmount);
    const commissionRate =
      dto.commissionRate === undefined
        ? agreement.commissionRate
        : this.toDecimal(dto.commissionRate);
    if (fixedRentAmount === null && commissionRate === null) {
      throw new BadRequestException(
        'An agreement requires fixed rent, commission, or both',
      );
    }

    return this.prisma.merchantAgreement.update({
      where: { id: agreementId, organizationId },
      data: {
        startDate: dto.startDate === undefined ? undefined : startDate,
        endDate: dto.endDate === undefined ? undefined : endDate,
        fixedRentAmount:
          dto.fixedRentAmount === undefined ? undefined : fixedRentAmount,
        commissionRate:
          dto.commissionRate === undefined ? undefined : commissionRate,
        settlementSchedule: dto.settlementSchedule,
        durationMonths: dto.durationMonths,
      },
    });
  }

  async activate(
    organizationId: string,
    agreementId: string,
  ): Promise<MerchantAgreementRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const agreement = await this.requireAgreement(
          transaction,
          organizationId,
          agreementId,
        );
        if (agreement.status !== AgreementStatus.DRAFT) {
          throw new ConflictException('Only draft agreements can be activated');
        }
        this.validateCompleteTerms(agreement);

        const today = currentPhilippineBusinessDate();
        await transaction.merchantAgreement.updateMany({
          where: {
            organizationId,
            merchantId: agreement.merchantId,
            status: AgreementStatus.ACTIVE,
            endDate: { lt: today },
          },
          data: {
            status: AgreementStatus.ENDED,
            endedAt: new Date(),
            endReason: 'Agreement term completed',
          },
        });
        const agreementEndingToday =
          await transaction.merchantAgreement.findFirst({
            where: {
              organizationId,
              merchantId: agreement.merchantId,
              status: AgreementStatus.ENDED,
              endDate: { gte: today },
            },
            orderBy: [{ endDate: 'desc' }, { id: 'asc' }],
            select: { id: true },
          });
        if (agreementEndingToday) {
          throw new ConflictException(
            'A previous agreement covers today; activate the replacement on the next business date',
          );
        }
        const current = await transaction.merchantAgreement.findFirst({
          where: {
            organizationId,
            merchantId: agreement.merchantId,
            status: AgreementStatus.ACTIVE,
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
        });
        if (current) {
          throw new ConflictException(
            'End the active agreement explicitly before activating a replacement',
          );
        }

        const durationMonths = agreement.durationMonths ?? 1;
        const scheduledEndDate = addMonthsAnchored(today, durationMonths);
        const endDate = previousDate(scheduledEndDate);

        const activated = await transaction.merchantAgreement.update({
          where: { id: agreementId, organizationId },
          data: {
            status: AgreementStatus.ACTIVE,
            startDate: today,
            endDate,
            durationMonths,
            activatedAt: new Date(),
            scheduledEndDate,
          },
        });
        if (activated.fixedRentAmount && transaction.merchantReceivable) {
          const existing = await transaction.merchantReceivable.findFirst({
            where: { organizationId, agreementId, cycleNumber: 1 },
          });
          if (!existing) {
            await transaction.merchantReceivable.create({
              data: {
                organizationId,
                merchantId: activated.merchantId,
                agreementId,
                sourcePeriod: today,
                periodStart: today,
                periodEnd: previousDate(addMonthsAnchored(today, 1)),
                cycleNumber: 1,
                originalAmount: activated.fixedRentAmount,
                remainingAmount: activated.fixedRentAmount,
                dueDate: today,
              },
            });
          }
        }
        return activated;
      });
    } catch (error: unknown) {
      this.rethrowActivationConflict(error);
    }
  }

  async end(
    organizationId: string,
    agreementId: string,
    dto: EndMerchantAgreementDto,
    actorId?: string,
  ): Promise<MerchantAgreementRecord> {
    const agreement = await this.findOne(organizationId, agreementId);
    if (agreement.status !== AgreementStatus.ACTIVE) {
      throw new ConflictException('Only active agreements can be ended');
    }

    const endDate = currentPhilippineBusinessDate();
    this.validateDateOrder(agreement.startDate, endDate);

    const result = await this.prisma.merchantAgreement.updateMany({
      where: {
        id: agreementId,
        organizationId,
        status: AgreementStatus.ACTIVE,
      },
      data: {
        status: AgreementStatus.ENDED,
        endDate,
        endedAt: new Date(),
        endedById: actorId,
        endReason: dto.reason,
      },
    });
    if (result.count !== 1) {
      throw new ConflictException('Only active agreements can be ended');
    }

    return this.prisma.merchantAgreement.findFirstOrThrow({
      where: { id: agreementId, organizationId },
    });
  }

  private async requireMerchant(
    organizationId: string,
    merchantId: string,
  ): Promise<void> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, organizationId },
      select: { id: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
  }

  private async requireAgreement(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    agreementId: string,
  ): Promise<MerchantAgreement> {
    const agreement = await transaction.merchantAgreement.findFirst({
      where: { id: agreementId, organizationId },
    });
    if (!agreement) throw new NotFoundException('Merchant agreement not found');
    return agreement;
  }

  private validateDateOrder(startDate: Date, endDate: Date | null): void {
    if (endDate && endDate < startDate) {
      throw new BadRequestException('endDate cannot be earlier than startDate');
    }
  }

  private validateCompleteTerms(agreement: MerchantAgreement): void {
    if (
      agreement.fixedRentAmount === null &&
      agreement.commissionRate === null
    ) {
      throw new BadRequestException(
        'An agreement requires fixed rent, commission, or both',
      );
    }
  }

  private toDecimal(value: string | null | undefined): Prisma.Decimal | null {
    return value == null ? null : new Prisma.Decimal(value);
  }

  private rethrowActivationConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Merchant already has an active agreement');
    }
    throw error;
  }

  private legacyDuration(dto: CreateMerchantAgreementDto): number | null {
    if (!dto.startDate || !dto.endDate) return null;
    const start = parseAgreementDate(dto.startDate, 'startDate');
    const end = parseAgreementDate(dto.endDate, 'endDate');
    const months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      start.getUTCMonth() +
      1;
    return Math.min(Math.max(months, 1), 60);
  }
}

function previousDate(date: Date): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

function addMonthsAnchored(anchor: Date, months: number): Date {
  const result = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(anchor.getUTCDate(), lastDay));
  return result;
}
