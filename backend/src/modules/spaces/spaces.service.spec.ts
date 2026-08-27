import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, SpaceStatus, SpaceType } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SpacesService } from './spaces.service';

describe('SpacesService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const branchId = '2f671678-91d3-4d04-a8f9-787a2e9f3c1a';
  const spaceId = '82be4f3a-b0a6-44e4-956f-3a62095a40de';
  const space = {
    id: spaceId,
    organizationId,
    branchId,
    code: 'RACK-A01',
    name: 'Front display rack',
    type: SpaceType.RACK,
    customType: null,
    status: SpaceStatus.ACTIVE,
    createdAt: new Date('2026-08-24T00:00:00.000Z'),
    updatedAt: new Date('2026-08-24T00:00:00.000Z'),
  };
  const prisma = {
    branch: { findFirst: jest.fn() },
    space: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  let service: SpacesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [SpacesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SpacesService);
  });

  it('creates a space only after verifying the trusted branch', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: branchId });
    prisma.space.create.mockResolvedValue(space);

    await expect(
      service.create(organizationId, branchId, {
        code: space.code,
        name: space.name,
        type: SpaceType.RACK,
      }),
    ).resolves.toEqual(space);
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: branchId, organizationId },
      select: { id: true },
    });
    expect(prisma.space.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        branchId,
        code: space.code,
        name: space.name,
        type: SpaceType.RACK,
        customType: null,
        status: undefined,
      },
    });
  });

  it('does not reveal a branch outside the organization', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(service.findAll(organizationId, branchId)).rejects.toThrow(
      new NotFoundException('Branch not found'),
    );
    expect(prisma.space.findMany).not.toHaveBeenCalled();
  });

  it('lists spaces only inside the trusted branch and organization', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: branchId });
    prisma.space.findMany.mockResolvedValue([{ ...space, assignments: [] }]);

    await expect(service.findAll(organizationId, branchId)).resolves.toEqual([
      { ...space, currentAssignment: null },
    ]);
    expect(prisma.space.findMany).toHaveBeenCalledWith({
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
  });

  it('does not reveal a space outside the organization', async () => {
    prisma.space.findFirst.mockResolvedValue(null);

    await expect(service.findOne(organizationId, spaceId)).rejects.toThrow(
      new NotFoundException('Space not found'),
    );
    expect(prisma.space.findFirst).toHaveBeenCalledWith({
      where: { id: spaceId, organizationId },
    });
  });

  it('requires a custom type description', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: branchId });

    await expect(
      service.create(organizationId, branchId, {
        code: 'CUSTOM-01',
        name: 'Window area',
        type: SpaceType.CUSTOM,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'customType is required when space type is CUSTOM',
      ),
    );
  });

  it('rejects a custom description for a predefined type', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: branchId });

    await expect(
      service.create(organizationId, branchId, {
        code: 'RACK-01',
        name: 'Window rack',
        type: SpaceType.RACK,
        customType: 'Window area',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'customType is only allowed when space type is CUSTOM',
      ),
    );
  });

  it('clears customType when changing from custom to predefined', async () => {
    const customSpace = {
      ...space,
      type: SpaceType.CUSTOM,
      customType: 'Window bay',
    };
    prisma.space.findFirst.mockResolvedValue(customSpace);
    prisma.space.update.mockResolvedValue(space);

    await service.update(organizationId, spaceId, { type: SpaceType.RACK });

    expect(prisma.space.update).toHaveBeenCalledWith({
      where: { id: spaceId, organizationId },
      data: { type: SpaceType.RACK, customType: null },
    });
  });

  it('rejects an empty update', async () => {
    await expect(service.update(organizationId, spaceId, {})).rejects.toThrow(
      new BadRequestException('At least one space field is required'),
    );
    expect(prisma.space.findFirst).not.toHaveBeenCalled();
  });

  it('maps branch-scoped code conflicts', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: branchId });
    prisma.space.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.9.1',
      }),
    );

    await expect(
      service.create(organizationId, branchId, {
        code: space.code,
        name: space.name,
        type: SpaceType.RACK,
      }),
    ).rejects.toThrow(
      new ConflictException('Space code already exists in this branch'),
    );
  });
});
