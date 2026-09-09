import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { parseBusinessDate } from './dto/assignment-date.validation';
import type { EndSpaceAssignmentDto } from './dto/end-space-assignment.dto';
import {
  branchSpaceAssignmentInclude,
  spaceAssignmentInclude,
  type BranchSpaceAssignmentRecord,
  type SpaceAssignmentRecord,
} from './space-assignments.types';

@Injectable()
export class SpaceAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findAllForBranch(
    organizationId: string,
    branchId: string,
  ): Promise<BranchSpaceAssignmentRecord[]> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.spaceAssignment.findMany({
      where: { organizationId, branchId },
      include: branchSpaceAssignmentInclude,
      orderBy: [{ endDate: 'asc' }, { startDate: 'desc' }, { id: 'asc' }],
    });
  }

  async end(
    organizationId: string,
    assignmentId: string,
    dto: EndSpaceAssignmentDto,
  ): Promise<SpaceAssignmentRecord> {
    const assignment = await this.prisma.spaceAssignment.findFirst({
      where: { id: assignmentId, organizationId },
      select: { id: true, startDate: true, endDate: true, agreementId: true },
    });
    if (!assignment) throw new NotFoundException('Space assignment not found');
    if (assignment.agreementId) {
      throw new ConflictException(
        'Agreement assignments can only be ended through the agreement lifecycle',
      );
    }
    if (assignment.endDate !== null) {
      throw new ConflictException('Space assignment has already ended');
    }

    const endDate = parseBusinessDate(dto.endDate, 'endDate');
    if (endDate < assignment.startDate) {
      throw new BadRequestException(
        'endDate cannot be earlier than the assignment startDate',
      );
    }

    const result = await this.prisma.spaceAssignment.updateMany({
      where: { id: assignmentId, organizationId, endDate: null },
      data: { endDate },
    });
    if (result.count !== 1) {
      throw new ConflictException('Space assignment has already ended');
    }

    return this.prisma.spaceAssignment.findFirstOrThrow({
      where: { id: assignmentId, organizationId },
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
}
