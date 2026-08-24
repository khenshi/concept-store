import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateBranchDto } from './dto/create-branch.dto';
import type { UpdateBranchDto } from './dto/update-branch.dto';
import type { BranchRecord } from './branches.types';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    dto: CreateBranchDto,
  ): Promise<BranchRecord> {
    try {
      return await this.prisma.branch.create({
        data: { organizationId, ...dto },
      });
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  findAll(organizationId: string): Promise<BranchRecord[]> {
    return this.prisma.branch.findMany({
      where: { organizationId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(
    organizationId: string,
    branchId: string,
  ): Promise<BranchRecord> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });

    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(
    organizationId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ): Promise<BranchRecord> {
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('At least one branch field is required');
    }

    await this.findOne(organizationId, branchId);

    try {
      return await this.prisma.branch.update({
        where: { id: branchId, organizationId },
        data: dto,
      });
    } catch (error: unknown) {
      this.rethrowKnownError(error);
    }
  }

  private rethrowKnownError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Branch name or code already exists in this organization',
      );
    }

    throw error;
  }
}
