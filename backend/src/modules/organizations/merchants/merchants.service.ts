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
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { merchantScope } from '../authorization/resource-access';

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

  async findAll(
    organizationId: string,
    query: ListMerchantsQueryDto,
    context?: OrganizationContext,
  ) {
    const search = query.q;
    const merchants = await this.prisma.merchant.findMany({
      where: {
        organizationId,
        ...(context ? { AND: [merchantScope(context)] } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                ...(context?.role === 'MANAGER'
                  ? []
                  : [
                      {
                        contactName: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        email: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        phone: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    ]),
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return context?.role === 'MANAGER'
      ? merchants.map(({ id, name, code, status }) => ({
          id,
          name,
          code,
          status,
        }))
      : merchants;
  }

  async findOne(
    organizationId: string,
    merchantId: string,
    context?: OrganizationContext,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: {
        id: merchantId,
        organizationId,
        ...(context ? { AND: [merchantScope(context)] } : {}),
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return context?.role === 'MANAGER'
      ? {
          id: merchant.id,
          name: merchant.name,
          code: merchant.code,
          status: merchant.status,
        }
      : merchant;
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
