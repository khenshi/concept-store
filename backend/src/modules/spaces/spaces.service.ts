import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SpaceType } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CreateSpaceDto } from './dto/create-space.dto';
import type { UpdateSpaceDto } from './dto/update-space.dto';
import type { SpaceListRecord, SpaceRecord } from './spaces.types';

@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    branchId: string,
    dto: CreateSpaceDto,
  ): Promise<SpaceRecord> {
    await this.requireBranch(organizationId, branchId);
    this.validateCustomType(dto.type, dto.customType ?? null);

    try {
      return await this.prisma.space.create({
        data: {
          organizationId,
          branchId,
          code: dto.code,
          name: dto.name,
          type: dto.type,
          customType: dto.customType ?? null,
          status: dto.status,
        },
      });
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  async findAll(
    organizationId: string,
    branchId: string,
  ): Promise<SpaceListRecord[]> {
    await this.requireBranch(organizationId, branchId);
    const spaces = await this.prisma.space.findMany({
      where: { organizationId, branchId },
      orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
      include: {
        assignments: {
          where: { endDate: null },
          orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            id: true,
            merchant: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    return spaces.map(({ assignments, ...space }) => ({
      ...space,
      currentAssignment: assignments[0] ?? null,
    }));
  }

  async findOne(organizationId: string, spaceId: string): Promise<SpaceRecord> {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, organizationId },
    });
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  async update(
    organizationId: string,
    spaceId: string,
    dto: UpdateSpaceDto,
  ): Promise<SpaceRecord> {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('At least one space field is required');
    }

    const existing = await this.findOne(organizationId, spaceId);
    const type = dto.type ?? existing.type;
    const customType =
      type !== SpaceType.CUSTOM && dto.customType === undefined
        ? null
        : (dto.customType ?? existing.customType);
    this.validateCustomType(type, customType);

    try {
      return await this.prisma.space.update({
        where: { id: spaceId, organizationId },
        data: { ...dto, customType },
      });
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  private async requireBranch(
    organizationId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }

  private validateCustomType(type: SpaceType, customType: string | null): void {
    if (type === SpaceType.CUSTOM && customType === null) {
      throw new BadRequestException(
        'customType is required when space type is CUSTOM',
      );
    }
    if (type !== SpaceType.CUSTOM && customType !== null) {
      throw new BadRequestException(
        'customType is only allowed when space type is CUSTOM',
      );
    }
  }

  private rethrowKnownError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Space code already exists in this branch');
    }
    throw error;
  }
}
