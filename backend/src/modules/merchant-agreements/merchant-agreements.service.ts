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
  previousBusinessDate,
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
    const startDate = parseAgreementDate(dto.startDate, 'startDate');
    const endDate = dto.endDate
      ? parseAgreementDate(dto.endDate, 'endDate')
      : null;
    this.validateDateOrder(startDate, endDate);

    return this.prisma.merchantAgreement.create({
      data: {
        organizationId,
        merchantId,
        startDate,
        endDate,
        fixedRentAmount: this.toDecimal(dto.fixedRentAmount),
        commissionRate: this.toDecimal(dto.commissionRate),
        settlementSchedule: dto.settlementSchedule,
        rentCollectionMethod: dto.rentCollectionMethod,
      },
    });
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

    return this.prisma.merchantAgreement.update({
      where: { id: agreementId, organizationId },
      data: {
        startDate: dto.startDate === undefined ? undefined : startDate,
        endDate: dto.endDate === undefined ? undefined : endDate,
        fixedRentAmount:
          dto.fixedRentAmount === undefined
            ? undefined
            : this.toDecimal(dto.fixedRentAmount),
        commissionRate:
          dto.commissionRate === undefined
            ? undefined
            : this.toDecimal(dto.commissionRate),
        settlementSchedule: dto.settlementSchedule,
        rentCollectionMethod: dto.rentCollectionMethod,
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
        if (agreement.startDate > today) {
          throw new ConflictException(
            'Agreement cannot be activated before its startDate',
          );
        }
        if (agreement.endDate && agreement.endDate < today) {
          throw new ConflictException(
            'An expired agreement cannot be activated',
          );
        }

        const historicalOverlap = await transaction.merchantAgreement.findFirst(
          {
            where: {
              organizationId,
              merchantId: agreement.merchantId,
              id: { not: agreement.id },
              status: AgreementStatus.ENDED,
              startDate: agreement.endDate
                ? { lte: agreement.endDate }
                : undefined,
              endDate: { gte: agreement.startDate },
            },
            select: { id: true },
          },
        );
        if (historicalOverlap) {
          throw new ConflictException(
            'Agreement dates overlap an ended agreement',
          );
        }

        const current = await transaction.merchantAgreement.findFirst({
          where: {
            organizationId,
            merchantId: agreement.merchantId,
            status: AgreementStatus.ACTIVE,
          },
        });
        if (current) {
          if (agreement.startDate <= current.startDate) {
            throw new ConflictException(
              'A replacement agreement must start after the active agreement',
            );
          }
          const replacementBoundary = previousBusinessDate(agreement.startDate);
          const currentEndDate =
            current.endDate && current.endDate < replacementBoundary
              ? current.endDate
              : replacementBoundary;
          await transaction.merchantAgreement.update({
            where: { id: current.id, organizationId },
            data: { status: AgreementStatus.ENDED, endDate: currentEndDate },
          });
        }

        return transaction.merchantAgreement.update({
          where: { id: agreementId, organizationId },
          data: { status: AgreementStatus.ACTIVE },
        });
      });
    } catch (error: unknown) {
      this.rethrowActivationConflict(error);
    }
  }

  async end(
    organizationId: string,
    agreementId: string,
    dto: EndMerchantAgreementDto,
  ): Promise<MerchantAgreementRecord> {
    const agreement = await this.findOne(organizationId, agreementId);
    if (agreement.status !== AgreementStatus.ACTIVE) {
      throw new ConflictException('Only active agreements can be ended');
    }

    const endDate = parseAgreementDate(dto.endDate, 'endDate');
    this.validateDateOrder(agreement.startDate, endDate);
    if (endDate > currentPhilippineBusinessDate()) {
      throw new BadRequestException('endDate cannot be in the future');
    }

    const result = await this.prisma.merchantAgreement.updateMany({
      where: {
        id: agreementId,
        organizationId,
        status: AgreementStatus.ACTIVE,
      },
      data: { status: AgreementStatus.ENDED, endDate },
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
        'An active agreement requires fixed rent, commission, or both',
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
}
