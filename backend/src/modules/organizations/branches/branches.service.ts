import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { CreateBranchDto } from './dto/create-branch.dto';
import type { ListBranchDirectoryQueryDto } from './dto/list-branch-directory-query.dto';
import type { UpdateBranchDto } from './dto/update-branch.dto';
import type { UpdateBranchStatusDto } from './dto/update-branch-status.dto';
import type { BranchDirectoryPage, BranchRecord } from './branches.types';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { branchScope } from '../authorization/resource-access';
import { BranchStatus } from '../../../generated/prisma/client';

const BRANCH_DIRECTORY_PAGE_SIZE = 15;

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

  async findDirectory(
    context: OrganizationContext,
    query: ListBranchDirectoryQueryDto,
  ): Promise<BranchDirectoryPage> {
    const accessibleWhere = branchScope(context);
    const filteredWhere = this.directoryWhere(context, query);
    const skip = (query.page - 1) * BRANCH_DIRECTORY_PAGE_SIZE;

    const [total, branches, summaryTotal, active, inactive] =
      await this.prisma.$transaction([
        this.prisma.branch.count({ where: filteredWhere }),
        this.prisma.branch.findMany({
          where: filteredWhere,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip,
          take: BRANCH_DIRECTORY_PAGE_SIZE,
          select: {
            id: true,
            organizationId: true,
            name: true,
            code: true,
            status: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            province: true,
            postalCode: true,
            countryCode: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                merchants: {
                  where: {
                    status: 'ACTIVE',
                    organizationId: context.organizationId,
                  },
                },
              },
            },
          },
        }),
        this.prisma.branch.count({ where: accessibleWhere }),
        this.prisma.branch.count({
          where: { AND: [accessibleWhere, { status: BranchStatus.ACTIVE }] },
        }),
        this.prisma.branch.count({
          where: {
            AND: [accessibleWhere, { status: BranchStatus.INACTIVE }],
          },
        }),
      ]);

    const totalPages = Math.ceil(total / BRANCH_DIRECTORY_PAGE_SIZE);
    return {
      items: branches.map(({ _count, ...branch }) => ({
        ...branch,
        merchantCount: _count.merchants,
      })),
      page: query.page,
      limit: BRANCH_DIRECTORY_PAGE_SIZE,
      total,
      totalPages,
      hasNext: query.page < totalPages,
      summary: {
        total: summaryTotal,
        active,
        inactive,
      },
    };
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

  async updateStatus(
    organizationId: string,
    branchId: string,
    context: OrganizationContext,
    dto: UpdateBranchStatusDto,
  ): Promise<BranchRecord> {
    const branch = await this.prisma.branch.findFirst({
      where: { AND: [branchScope(context), { id: branchId }] },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.prisma.branch.update({
      where: { id: branchId, organizationId },
      data: { status: dto.status },
    });
  }

  private directoryWhere(
    context: OrganizationContext,
    query: ListBranchDirectoryQueryDto,
  ): Prisma.BranchWhereInput {
    const search = query.q;
    return {
      AND: [
        branchScope(context),
        ...(query.status ? [{ status: query.status }] : []),
        ...(search
          ? [
              {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { code: { contains: search, mode: 'insensitive' as const } },
                  { city: { contains: search, mode: 'insensitive' as const } },
                  {
                    province: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    addressLine1: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    addressLine2: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    postalCode: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
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
