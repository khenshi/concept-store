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
import type { BranchOverview, BranchRecord } from './branches.types';

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

  async overview(
    organizationId: string,
    branchId: string,
  ): Promise<BranchOverview> {
    const branch = await this.findOne(organizationId, branchId);
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const start = new Date(`${today}T00:00:00+08:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const [
      sales,
      inventory,
      outOfStockProducts,
      totalSpaces,
      occupiedSpaces,
      merchants,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          organizationId,
          branchId,
          status: 'COMPLETED',
          completedAt: { gte: start, lt: end },
        },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.inventory.aggregate({
        where: { organizationId, branchId },
        _sum: { quantity: true },
      }),
      this.prisma.inventory.count({
        where: { organizationId, branchId, quantity: 0 },
      }),
      this.prisma.space.count({ where: { organizationId, branchId } }),
      this.prisma.space.count({
        where: {
          organizationId,
          branchId,
          assignments: { some: { endDate: null } },
        },
      }),
      this.prisma.spaceAssignment.findMany({
        where: {
          organizationId,
          branchId,
          endDate: null,
          merchant: { status: 'ACTIVE' },
        },
        distinct: ['merchantId'],
        select: { merchantId: true },
      }),
    ]);

    return {
      branch,
      statistics: {
        todaySaleCount: sales._count._all,
        todayGrossSales: (sales._sum.total ?? new Prisma.Decimal(0)).toFixed(2),
        inventoryUnits: inventory._sum.quantity ?? 0,
        outOfStockProducts,
        totalSpaces,
        occupiedSpaces,
        vacantSpaces: totalSpaces - occupiedSpaces,
        activeMerchants: merchants.length,
      },
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
