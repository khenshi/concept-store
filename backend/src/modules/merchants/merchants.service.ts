import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CreateMerchantDto } from './dto/create-merchant.dto';
import type { ListMerchantsQueryDto } from './dto/list-merchants-query.dto';
import type { UpdateMerchantStatusDto } from './dto/update-merchant-status.dto';
import type { UpdateMerchantBranchesDto } from './dto/update-merchant-branches.dto';
import type { UpdateMerchantDto } from './dto/update-merchant.dto';
import type { MerchantRecord } from './merchant.types';

const merchantBranchesInclude = {
  branches: {
    select: {
      branch: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.MerchantInclude;

type MerchantWithBranches = Prisma.MerchantGetPayload<{
  include: typeof merchantBranchesInclude;
}>;

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    dto: CreateMerchantDto,
  ): Promise<MerchantRecord> {
    const { branchIds, ...profile } = dto;
    try {
      const merchant = await this.prisma.$transaction(async (transaction) => {
        await this.assertBranchesBelongToOrganization(
          transaction,
          organizationId,
          branchIds,
        );
        const data = {
          ...profile,
          organization: { connect: { id: organizationId } },
          branches: {
            create: branchIds.map((branchId) => ({
              branch: {
                connect: {
                  id_organizationId: { id: branchId, organizationId },
                },
              },
            })),
          },
        } satisfies Prisma.MerchantCreateInput;
        return transaction.merchant.create({
          data,
          include: merchantBranchesInclude,
        });
      });
      return this.toRecord(merchant);
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async findAll(
    organizationId: string,
    query: ListMerchantsQueryDto,
  ): Promise<MerchantRecord[]> {
    const searchFilters: Prisma.MerchantWhereInput[] | undefined = query.search
      ? [
          { name: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
          { contactName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search, mode: 'insensitive' } },
        ]
      : undefined;

    const merchants = await this.prisma.merchant.findMany({
      where: {
        organizationId,
        status: query.status,
        OR: searchFilters,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: merchantBranchesInclude,
    });
    return merchants.map((merchant) => this.toRecord(merchant));
  }

  async findOne(
    organizationId: string,
    merchantId: string,
  ): Promise<MerchantRecord> {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id: merchantId, organizationId },
      include: merchantBranchesInclude,
    });

    if (!merchant) throw new NotFoundException('Merchant not found');
    return this.toRecord(merchant);
  }

  async update(
    organizationId: string,
    merchantId: string,
    dto: UpdateMerchantDto,
  ): Promise<MerchantRecord> {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('At least one merchant field is required');
    }

    await this.findOne(organizationId, merchantId);

    try {
      const merchant = await this.prisma.merchant.update({
        where: { id: merchantId, organizationId },
        data: dto,
        include: merchantBranchesInclude,
      });
      return this.toRecord(merchant);
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async updateStatus(
    organizationId: string,
    merchantId: string,
    dto: UpdateMerchantStatusDto,
  ): Promise<MerchantRecord> {
    await this.findOne(organizationId, merchantId);
    const merchant = await this.prisma.merchant.update({
      where: { id: merchantId, organizationId },
      data: { status: dto.status },
      include: merchantBranchesInclude,
    });
    return this.toRecord(merchant);
  }

  async updateBranches(
    organizationId: string,
    merchantId: string,
    dto: UpdateMerchantBranchesDto,
  ): Promise<MerchantRecord> {
    const merchant = await this.prisma.$transaction(
      async (transaction) => {
        const exists = await transaction.merchant.findFirst({
          where: { id: merchantId, organizationId },
          select: { id: true },
        });
        if (!exists) throw new NotFoundException('Merchant not found');

        await this.assertBranchesBelongToOrganization(
          transaction,
          organizationId,
          dto.branchIds,
        );
        const currentAssignmentCount = await transaction.spaceAssignment.count({
          where: {
            organizationId,
            merchantId,
            branchId: { notIn: dto.branchIds },
            endDate: null,
          },
        });
        if (currentAssignmentCount > 0) {
          throw new ConflictException(
            'End current space assignments before removing their branches',
          );
        }
        await transaction.merchantBranch.deleteMany({
          where: { organizationId, merchantId },
        });
        await transaction.merchantBranch.createMany({
          data: dto.branchIds.map((branchId) => ({
            organizationId,
            merchantId,
            branchId,
          })),
        });

        return transaction.merchant.findFirstOrThrow({
          where: { id: merchantId, organizationId },
          include: merchantBranchesInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.toRecord(merchant);
  }

  private async assertBranchesBelongToOrganization(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    branchIds: string[],
  ): Promise<void> {
    const branchCount = await transaction.branch.count({
      where: { organizationId, id: { in: branchIds } },
    });
    if (branchCount !== branchIds.length) {
      throw new BadRequestException(
        'Every branch must belong to the merchant organization',
      );
    }
  }

  private toRecord(merchant: MerchantWithBranches): MerchantRecord {
    const { branches, ...profile } = merchant;
    return {
      ...profile,
      branches: branches
        .map(({ branch }) => branch)
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  private rethrowKnownError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Merchant code already exists in this organization',
      );
    }

    throw error;
  }
}
