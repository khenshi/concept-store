import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, SpaceStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SpaceAssignmentsService } from './space-assignments.service';
import { spaceAssignmentInclude } from './space-assignments.types';

describe('SpaceAssignmentsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const branchId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const spaceId = '82be4f3a-b0a6-44e4-956f-3a62095a40de';
  const merchantId = '44c7fe4b-9342-4bf7-9d72-33842ac5ca80';
  const assignmentId = 'cad19536-c64f-4595-9529-40e1f6b0523e';
  const assignment = {
    id: assignmentId,
    organizationId,
    branchId,
    spaceId,
    merchantId,
    startDate: new Date('2026-08-25T00:00:00.000Z'),
    endDate: null,
    createdAt: new Date('2026-08-25T00:00:00.000Z'),
    updatedAt: new Date('2026-08-25T00:00:00.000Z'),
    merchant: { id: merchantId, name: 'Amihan Goods', code: 'AMIHAN-01' },
  };
  const prisma = {
    $transaction: jest.fn(),
    space: { findFirst: jest.fn() },
    merchantBranch: { findFirst: jest.fn() },
    spaceAssignment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
  };
  let service: SpaceAssignmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (operation: (transaction: typeof prisma) => unknown) => operation(prisma),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        SpaceAssignmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(SpaceAssignmentsService);
  });

  function allowAssignment(): void {
    prisma.space.findFirst.mockResolvedValue({
      id: spaceId,
      branchId,
      status: SpaceStatus.ACTIVE,
    });
    prisma.merchantBranch.findFirst.mockResolvedValue({ merchantId });
    prisma.spaceAssignment.findFirst.mockResolvedValue(null);
  }

  it('creates a current assignment with trusted tenant and branch values', async () => {
    allowAssignment();
    prisma.spaceAssignment.create.mockResolvedValue(assignment);

    await expect(
      service.create(organizationId, spaceId, {
        merchantId,
        startDate: '2026-08-25',
      }),
    ).resolves.toEqual(assignment);
    expect(prisma.merchantBranch.findFirst).toHaveBeenCalledWith({
      where: { organizationId, branchId, merchantId },
      select: { merchantId: true },
    });
    expect(prisma.spaceAssignment.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        branchId,
        spaceId,
        merchantId,
        startDate: new Date('2026-08-25T00:00:00.000Z'),
      },
      include: spaceAssignmentInclude,
    });
  });

  it('conceals a space outside the organization', async () => {
    prisma.space.findFirst.mockResolvedValue(null);

    await expect(
      service.create(organizationId, spaceId, {
        merchantId,
        startDate: '2026-08-25',
      }),
    ).rejects.toThrow(new NotFoundException('Space not found'));
    expect(prisma.merchantBranch.findFirst).not.toHaveBeenCalled();
  });

  it('rejects assignment to an inactive space', async () => {
    prisma.space.findFirst.mockResolvedValue({
      id: spaceId,
      branchId,
      status: SpaceStatus.INACTIVE,
    });

    await expect(
      service.create(organizationId, spaceId, {
        merchantId,
        startDate: '2026-08-25',
      }),
    ).rejects.toThrow(
      new ConflictException('Inactive spaces cannot be assigned'),
    );
  });

  it('requires merchant participation in the same branch', async () => {
    prisma.space.findFirst.mockResolvedValue({
      id: spaceId,
      branchId,
      status: SpaceStatus.ACTIVE,
    });
    prisma.merchantBranch.findFirst.mockResolvedValue(null);

    await expect(
      service.create(organizationId, spaceId, {
        merchantId,
        startDate: '2026-08-25',
      }),
    ).rejects.toThrow(
      new NotFoundException('Merchant is not available in this branch'),
    );
  });

  it('rejects a second current assignment', async () => {
    allowAssignment();
    prisma.spaceAssignment.findFirst.mockResolvedValue({ id: assignmentId });

    await expect(
      service.create(organizationId, spaceId, {
        merchantId,
        startDate: '2026-08-25',
      }),
    ).rejects.toThrow(
      new ConflictException('Space already has a current assignment'),
    );
  });

  it('maps a concurrent unique constraint failure to a conflict', async () => {
    allowAssignment();
    prisma.spaceAssignment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.9.1',
      }),
    );

    await expect(
      service.create(organizationId, spaceId, {
        merchantId,
        startDate: '2026-08-25',
      }),
    ).rejects.toThrow(
      new ConflictException('Space already has a current assignment'),
    );
  });

  it('lists assignment history inside the trusted organization', async () => {
    prisma.space.findFirst.mockResolvedValue({
      id: spaceId,
      branchId,
      status: SpaceStatus.ACTIVE,
    });
    prisma.spaceAssignment.findMany.mockResolvedValue([assignment]);

    await expect(service.findAll(organizationId, spaceId)).resolves.toEqual([
      assignment,
    ]);
    expect(prisma.spaceAssignment.findMany).toHaveBeenCalledWith({
      where: { organizationId, spaceId },
      include: spaceAssignmentInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('ends a current assignment without changing its history', async () => {
    prisma.spaceAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
      startDate: assignment.startDate,
      endDate: null,
    });
    const ended = {
      ...assignment,
      endDate: new Date('2026-09-30T00:00:00.000Z'),
    };
    prisma.spaceAssignment.updateMany.mockResolvedValue({ count: 1 });
    prisma.spaceAssignment.findFirstOrThrow.mockResolvedValue(ended);

    await expect(
      service.end(organizationId, assignmentId, { endDate: '2026-09-30' }),
    ).resolves.toEqual(ended);
    expect(prisma.spaceAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: assignmentId, organizationId, endDate: null },
      data: { endDate: new Date('2026-09-30T00:00:00.000Z') },
    });
    expect(prisma.spaceAssignment.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: assignmentId, organizationId },
      include: spaceAssignmentInclude,
    });
  });

  it('rejects an end date before the assignment start date', async () => {
    prisma.spaceAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
      startDate: assignment.startDate,
      endDate: null,
    });

    await expect(
      service.end(organizationId, assignmentId, { endDate: '2026-08-24' }),
    ).rejects.toThrow(
      new BadRequestException(
        'endDate cannot be earlier than the assignment startDate',
      ),
    );
  });

  it('rejects an assignment that has already ended', async () => {
    prisma.spaceAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
      startDate: assignment.startDate,
      endDate: new Date('2026-09-30T00:00:00.000Z'),
    });

    await expect(
      service.end(organizationId, assignmentId, { endDate: '2026-10-01' }),
    ).rejects.toThrow(
      new ConflictException('Space assignment has already ended'),
    );
  });

  it('does not overwrite an end date recorded by a concurrent request', async () => {
    prisma.spaceAssignment.findFirst.mockResolvedValue({
      id: assignmentId,
      startDate: assignment.startDate,
      endDate: null,
    });
    prisma.spaceAssignment.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.end(organizationId, assignmentId, { endDate: '2026-09-30' }),
    ).rejects.toThrow(
      new ConflictException('Space assignment has already ended'),
    );
    expect(prisma.spaceAssignment.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('rejects impossible calendar dates', async () => {
    allowAssignment();

    await expect(
      service.create(organizationId, spaceId, {
        merchantId,
        startDate: '2026-02-30',
      }),
    ).rejects.toThrow(
      new BadRequestException('startDate must be a valid ISO date'),
    );
  });
});
