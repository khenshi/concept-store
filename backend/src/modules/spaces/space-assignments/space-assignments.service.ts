import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SpaceStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { parseBusinessDate } from './dto/assignment-date.validation';
import type { CreateSpaceAssignmentDto } from './dto/create-space-assignment.dto';
import type { EndSpaceAssignmentDto } from './dto/end-space-assignment.dto';
import {
  spaceAssignmentInclude,
  type SpaceAssignmentRecord,
} from './space-assignments.types';

@Injectable()
export class SpaceAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    spaceId: string,
    dto: CreateSpaceAssignmentDto,
  ): Promise<SpaceAssignmentRecord> {
    const space = await this.requireSpace(organizationId, spaceId);
    if (space.status !== SpaceStatus.ACTIVE) {
      throw new ConflictException('Inactive spaces cannot be assigned');
    }

    const participation = await this.prisma.merchantBranch.findFirst({
      where: {
        organizationId,
        branchId: space.branchId,
        merchantId: dto.merchantId,
      },
      select: { merchantId: true },
    });
    if (!participation) {
      throw new NotFoundException('Merchant is not available in this branch');
    }

    const currentAssignment = await this.prisma.spaceAssignment.findFirst({
      where: { organizationId, spaceId, endDate: null },
      select: { id: true },
    });
    if (currentAssignment) {
      throw new ConflictException('Space already has a current assignment');
    }

    const startDate = parseBusinessDate(dto.startDate, 'startDate');
    try {
      return await this.prisma.spaceAssignment.create({
        data: {
          organizationId,
          branchId: space.branchId,
          spaceId,
          merchantId: dto.merchantId,
          startDate,
        },
        include: spaceAssignmentInclude,
      });
    } catch (error: unknown) {
      this.rethrowKnownCreateError(error);
    }
  }

  async findAll(
    organizationId: string,
    spaceId: string,
  ): Promise<SpaceAssignmentRecord[]> {
    await this.requireSpace(organizationId, spaceId);
    return this.prisma.spaceAssignment.findMany({
      where: { organizationId, spaceId },
      include: spaceAssignmentInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  async end(
    organizationId: string,
    assignmentId: string,
    dto: EndSpaceAssignmentDto,
  ): Promise<SpaceAssignmentRecord> {
    const assignment = await this.prisma.spaceAssignment.findFirst({
      where: { id: assignmentId, organizationId },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!assignment) throw new NotFoundException('Space assignment not found');
    if (assignment.endDate !== null) {
      throw new ConflictException('Space assignment has already ended');
    }

    const endDate = parseBusinessDate(dto.endDate, 'endDate');
    if (endDate < assignment.startDate) {
      throw new BadRequestException(
        'endDate cannot be earlier than the assignment startDate',
      );
    }

    return this.prisma.spaceAssignment.update({
      where: { id: assignmentId, organizationId },
      data: { endDate },
      include: spaceAssignmentInclude,
    });
  }

  private async requireSpace(organizationId: string, spaceId: string) {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, organizationId },
      select: { id: true, branchId: true, status: true },
    });
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  private rethrowKnownCreateError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Space already has a current assignment');
    }
    throw error;
  }
}
