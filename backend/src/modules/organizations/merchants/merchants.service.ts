import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateMerchantDto } from './dto/create-merchant.dto';
import type { ListMerchantsQueryDto } from './dto/list-merchants-query.dto';
import type { UpdateMerchantStatusDto } from './dto/update-merchant-status.dto';
import type { UpdateMerchantDto } from './dto/update-merchant.dto';
import type { MerchantRecord } from './merchants.types';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    dto: CreateMerchantDto,
  ): Promise<MerchantRecord> {
    try {
      return await this.prisma.merchant.create({
        data: { organizationId, ...dto },
      });
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  findAll(
    organizationId: string,
    query: ListMerchantsQueryDto,
  ): Promise<MerchantRecord[]> {
    const search = query.q;
    return this.prisma.merchant.findMany({
      where: {
        organizationId,
        ...(query.status ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(
    organizationId: string,
    merchantId: string,
  ): Promise<MerchantRecord> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId, organizationId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  async update(
    organizationId: string,
    merchantId: string,
    dto: UpdateMerchantDto,
  ): Promise<MerchantRecord> {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException(
        'At least one merchant profile field is required',
      );
    }
    await this.findOne(organizationId, merchantId);
    try {
      return await this.prisma.merchant.update({
        where: { id: merchantId, organizationId },
        data: dto,
      });
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
    return this.prisma.merchant.update({
      where: { id: merchantId, organizationId },
      data: { status: dto.status },
    });
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
