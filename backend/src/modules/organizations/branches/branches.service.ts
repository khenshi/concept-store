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
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { branchScope } from '../authorization/resource-access';

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

  async findAll(organizationId: string, context?: OrganizationContext) {
    const branches = await this.prisma.branch.findMany({
      where: context ? branchScope(context) : { organizationId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return context?.role === 'MERCHANT'
      ? branches.map(({ id, name, code }) => ({ id, name, code }))
      : branches;
  }

  async findOne(
    organizationId: string,
    branchId: string,
    context?: OrganizationContext,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: context
        ? { AND: [branchScope(context), { id: branchId }] }
        : { id: branchId, organizationId },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return context?.role === 'MERCHANT'
      ? { id: branch.id, name: branch.name, code: branch.code }
      : branch;
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
